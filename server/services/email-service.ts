import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { Contract } from '@shared/schema';
import { storage } from "../storage";

/**
 * Professional transactional email sender backed by Resend with a verified domain.
 * Replaces the previous raw SMTP/Gmail sender, which was prone to spam scoring
 * and could not pass SPF/DKIM/DMARC alignment with the company domain.
 *
 * Required environment:
 *   - RESEND_API_KEY      Resend API key (secret)
 *   - EMAIL_FROM_ADDRESS  Verified sender address on the company domain (e.g. no-reply@tuodominio.it)
 *
 * The sender display name is read dynamically from companySettings.companyName,
 * so each tenant appears with their own brand. The technical address stays the
 * shared verified one.
 */

const FALLBACK_DISPLAY_NAME = "Turbo Contract";

function requireConfig(): { resend: Resend; fromAddress: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY non configurata. Aggiungi la chiave Resend nei Secrets per inviare email."
    );
  }
  if (!fromAddress) {
    throw new Error(
      "EMAIL_FROM_ADDRESS non configurata. Imposta l'indirizzo mittente verificato (es. no-reply@tuodominio.it)."
    );
  }
  return { resend: new Resend(apiKey), fromAddress };
}

function buildFrom(displayName: string, address: string): string {
  // Sanitize display name: strip CR/LF, quote-escape internal quotes.
  const safeName = displayName.replace(/[\r\n]+/g, " ").replace(/"/g, "'").trim() || FALLBACK_DISPLAY_NAME;
  return `${safeName} <${address}>`;
}

/**
 * Resolve the sender display name for a given seller, using their company name
 * from company_settings. Falls back to FALLBACK_DISPLAY_NAME if anything is missing.
 */
async function resolveSenderName(sellerId?: number | null): Promise<string> {
  try {
    if (!sellerId) return FALLBACK_DISPLAY_NAME;
    const seller = await storage.getUser(sellerId);
    if (!seller?.companyId) return FALLBACK_DISPLAY_NAME;
    const settings = await storage.getCompanySettings(seller.companyId);
    return settings?.companyName?.trim() || FALLBACK_DISPLAY_NAME;
  } catch (err) {
    console.warn("⚠️ Impossibile risolvere il nome azienda per il mittente, uso fallback:", err);
    return FALLBACK_DISPLAY_NAME;
  }
}

function getBaseUrl(): string {
  const base = process.env.BASE_URL || process.env.DEV_URL;
  if (base) return base.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    return `https://${process.env.REPL_SLUG || "workspace"}.${process.env.REPL_OWNER || "yirok79246"}.repl.co`;
  }
  return "http://localhost:5000";
}

export async function sendContractEmail(
  contract: Contract,
  contractCode: string,
  emailTo?: string,
): Promise<void> {
  const { resend, fromAddress } = requireConfig();

  const clientData = contract.clientData as any;
  const clientEmail = emailTo || clientData?.email;
  const clientName = clientData?.cliente_nome || clientData?.nome || "Cliente";

  if (!clientEmail) {
    throw new Error("Email destinatario mancante per l'invio del contratto.");
  }

  const senderName = await resolveSenderName(contract.sellerId);
  const baseUrl = getBaseUrl();
  const contractUrl = `${baseUrl}/client/${contractCode}?email=${encodeURIComponent(clientEmail)}`;

  const html = renderContractRequestHtml({ clientName, contractUrl, contractCode, senderName });

  console.log("📤 Invio email contratto via Resend", {
    to: clientEmail,
    from: buildFrom(senderName, fromAddress),
    contractCode,
  });

  const { data, error } = await resend.emails.send({
    from: buildFrom(senderName, fromAddress),
    to: clientEmail,
    subject: `Nuovo contratto da firmare — ${senderName}`,
    html,
  });

  if (error) {
    console.error("❌ Resend error (sendContractEmail):", error);
    throw new Error(`Failed to send contract email: ${error.message || JSON.stringify(error)}`);
  }
  console.log("✅ Email contratto inviata, id:", data?.id);
}

export async function sendOTPEmail(email: string, otpCode: string): Promise<void> {
  const { resend, fromAddress } = requireConfig();
  if (!email) throw new Error("Email destinatario mancante per OTP.");

  // OTP emails are not contract-bound; we use the platform fallback display name
  // unless a future call wires a sellerId in. Keeps signature backward-compatible.
  const senderName = FALLBACK_DISPLAY_NAME;
  const html = renderOtpHtml(otpCode, senderName);

  const { data, error } = await resend.emails.send({
    from: buildFrom(senderName, fromAddress),
    to: email,
    subject: `Codice di verifica — ${senderName}`,
    html,
  });

  if (error) {
    console.error("❌ Resend error (sendOTPEmail):", error);
    throw new Error(`Failed to send OTP email: ${error.message || JSON.stringify(error)}`);
  }
  console.log("✅ Email OTP inviata, id:", data?.id);
}

export async function sendContractSignedNotification(contract: Contract): Promise<void> {
  const { resend, fromAddress } = requireConfig();

  const clientData = contract.clientData as any;
  const clientEmail = contract.sentToEmail || clientData?.email;
  const clientName = clientData?.cliente_nome || clientData?.nome || "Cliente";

  if (!clientEmail) {
    console.warn("⚠️ Notifica firma: email destinatario mancante, skip.");
    return;
  }

  const senderName = await resolveSenderName(contract.sellerId);
  const html = renderSignedHtml({ clientName, senderName });

  // Attach signed PDF if available
  const attachments: { filename: string; content: string }[] = [];
  if (contract.pdfPath) {
    try {
      let pdfPath = contract.pdfPath;
      if (!path.isAbsolute(pdfPath)) {
        pdfPath = pdfPath.includes("/")
          ? path.resolve(pdfPath)
          : path.join(process.cwd(), "generated-pdfs", pdfPath);
      }
      if (fs.existsSync(pdfPath)) {
        attachments.push({
          filename: `contratto-firmato-${contract.contractCode}.pdf`,
          content: fs.readFileSync(pdfPath).toString("base64"),
        });
      } else {
        console.warn("⚠️ PDF firmato non trovato per allegato:", pdfPath);
      }
    } catch (err) {
      console.error("❌ Errore lettura PDF per allegato:", err);
    }
  }

  const { data, error } = await resend.emails.send({
    from: buildFrom(senderName, fromAddress),
    to: clientEmail,
    subject: `Contratto firmato con successo — ${senderName}`,
    html,
    attachments: attachments.length ? attachments : undefined,
  });

  if (error) {
    console.error("❌ Resend error (sendContractSignedNotification):", error);
    // Notification failure must not break the signing flow — match prior behavior.
    return;
  }
  console.log("✅ Notifica firma inviata, id:", data?.id);
}

// ---------- HTML templates (same look-and-feel as before, dynamic sender) ----------

function renderContractRequestHtml(opts: {
  clientName: string;
  contractUrl: string;
  contractCode: string;
  senderName: string;
}): string {
  const { clientName, contractUrl, contractCode, senderName } = opts;
  return `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; }
      .button { display: inline-block; background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${escapeHtml(senderName)}</h1>
          <p>Sistema di gestione contratti</p>
        </div>
        <div class="content">
          <h2>Ciao ${escapeHtml(clientName)},</h2>
          <p>Hai ricevuto un nuovo contratto da firmare. Per procedere alla visualizzazione e alla firma elettronica, clicca sul pulsante qui sotto:</p>
          <div style="text-align: center;">
            <a href="${contractUrl}" class="button">Visualizza e firma il contratto</a>
          </div>
          <p><strong>Codice contratto:</strong> ${escapeHtml(contractCode)}</p>
          <p>Il processo di firma è completamente digitale e legalmente valido. Ti verrà richiesto di:</p>
          <ul>
            <li>Visualizzare il documento completo</li>
            <li>Confermare il tuo numero di telefono</li>
            <li>Inserire il codice OTP ricevuto</li>
            <li>Apporre la firma elettronica</li>
          </ul>
          <p><em>Questo link è personale e sicuro. Non condividerlo con altre persone.</em></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${escapeHtml(senderName)}. Tutti i diritti riservati.</p>
          <p>Email generata automaticamente dal sistema.</p>
        </div>
      </div>
    </body></html>
  `;
}

function renderOtpHtml(otpCode: string, senderName: string): string {
  return `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; text-align: center; }
      .otp-code { display: inline-block; background-color: #F3F4F6; color: #1F2937; padding: 20px 30px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 10px; margin: 20px 0; border: 2px dashed #3B82F6; }
      .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
      .warning { background-color: #FEF3C7; color: #92400E; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Codice di verifica</h1>
          <p>${escapeHtml(senderName)}</p>
        </div>
        <div class="content">
          <h2>Il tuo codice OTP</h2>
          <p>Utilizza il seguente codice per completare la firma del contratto:</p>
          <div class="otp-code">${escapeHtml(otpCode)}</div>
          <div class="warning"><strong>Importante:</strong> il codice è valido per 10 minuti e può essere utilizzato una sola volta.</div>
          <p><small>Se non hai richiesto questo codice, ignora questa email.</small></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${escapeHtml(senderName)}. Tutti i diritti riservati.</p>
        </div>
      </div>
    </body></html>
  `;
}

function renderSignedHtml(opts: { clientName: string; senderName: string }): string {
  const { clientName, senderName } = opts;
  return `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; }
      .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Contratto firmato</h1>
          <p>${escapeHtml(senderName)}</p>
        </div>
        <div class="content">
          <div class="success-icon">✅</div>
          <h2>Complimenti ${escapeHtml(clientName)}!</h2>
          <p>Il tuo contratto è stato firmato con successo e tutte le procedure legali sono state completate.</p>
          <p><strong>Dettagli della firma:</strong></p>
          <ul>
            <li>Data e ora: ${new Date().toLocaleString("it-IT")}</li>
            <li>Metodo: Firma elettronica avanzata</li>
            <li>Conformità: Standard eIDAS</li>
          </ul>
          <p>Il documento firmato e sigillato digitalmente è allegato a questa email e sarà conservato in modo sicuro nei nostri archivi.</p>
          <p><em>Grazie per aver utilizzato ${escapeHtml(senderName)}!</em></p>
        </div>
      </div>
    </body></html>
  `;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
