import * as fs from 'fs';
import * as path from 'path';
import nodemailer, { Transporter } from 'nodemailer';
import { Contract, CompanySettings, InsertAuditLog } from '@shared/schema';
import { storage } from "../storage";

/**
 * Professional transactional email sender via the customer's own SMTP server
 * (Aruba, Register.it, IONOS, hosting provider, ecc.).
 *
 * SMTP credentials are configured PER-TENANT directly from the admin frontend
 * (Impostazioni Azienda → Configurazione Email) and stored in `company_settings`.
 *
 * Required fields on companySettings:
 *   - smtpHost, smtpPort, smtpUser, smtpPass, emailFromAddress
 * Optional:
 *   - smtpSecure (defaults to true on port 465, false otherwise)
 *   - emailFromName (defaults to companyName)
 */

const FALLBACK_DISPLAY_NAME = "Turbo Contract";

export type EmailConfigStatus = { configured: boolean; missingFields: string[] };

const EMAIL_REQUIRED_FIELDS: Array<keyof CompanySettings> = [
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "emailFromAddress",
];

export function getEmailConfigStatus(settings: CompanySettings | null | undefined): EmailConfigStatus {
  if (!settings) {
    return { configured: false, missingFields: [...EMAIL_REQUIRED_FIELDS as string[]] };
  }
  const missingFields: string[] = [];
  for (const f of EMAIL_REQUIRED_FIELDS) {
    const v = settings[f];
    if (v === null || v === undefined || v === "") missingFields.push(f as string);
  }
  return { configured: missingFields.length === 0, missingFields };
}

export async function getEmailConfigStatusForCompany(companyId?: number | null): Promise<EmailConfigStatus> {
  const settings = companyId ? await storage.getCompanySettings(companyId) : null;
  return getEmailConfigStatus(settings ?? null);
}

type CachedEntry = { transporter: Transporter; key: string };
const transporterCache = new Map<number, CachedEntry>();

function buildKey(s: CompanySettings): string {
  return `${s.smtpHost}|${s.smtpPort}|${s.smtpSecure ?? ""}|${s.smtpUser}|${s.smtpPass}`;
}

function getTransporterForCompany(settings: CompanySettings): { transporter: Transporter; fromAddress: string; fromName: string } {
  if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass) {
    throw new Error(
      "Configurazione SMTP incompleta. Vai su Impostazioni Azienda → Configurazione Email e inserisci host, porta, utente e password SMTP."
    );
  }
  if (!settings.emailFromAddress) {
    throw new Error(
      "Indirizzo mittente non configurato. Imposta 'Email mittente' in Impostazioni Azienda → Configurazione Email."
    );
  }

  const key = buildKey(settings);
  const cached = transporterCache.get(settings.id);
  if (cached && cached.key === key) {
    return {
      transporter: cached.transporter,
      fromAddress: settings.emailFromAddress,
      fromName: settings.emailFromName?.trim() || settings.companyName?.trim() || FALLBACK_DISPLAY_NAME,
    };
  }

  // Replace any stale cached transporter for this tenant.
  if (cached) {
    try { cached.transporter.close(); } catch {}
  }

  const port = settings.smtpPort;
  const secure = settings.smtpSecure ?? port === 465;

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure,
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
  });
  transporterCache.set(settings.id, { transporter, key });

  return {
    transporter,
    fromAddress: settings.emailFromAddress,
    fromName: settings.emailFromName?.trim() || settings.companyName?.trim() || FALLBACK_DISPLAY_NAME,
  };
}

/**
 * Public hook: invalidate cached transporter when SMTP settings change.
 * Called by the routes layer after a successful PUT /api/company-settings.
 */
export function invalidateEmailTransporterCache(companyId?: number): void {
  if (companyId == null) {
    for (const { transporter } of transporterCache.values()) {
      try { transporter.close(); } catch {}
    }
    transporterCache.clear();
  } else {
    const c = transporterCache.get(companyId);
    if (c) {
      try { c.transporter.close(); } catch {}
      transporterCache.delete(companyId);
    }
  }
}

async function loadSettingsForSeller(sellerId?: number | null): Promise<CompanySettings | null> {
  if (!sellerId) return null;
  const seller = await storage.getUser(sellerId);
  if (!seller?.companyId) return null;
  return (await storage.getCompanySettings(seller.companyId)) ?? null;
}

async function loadSettingsForCompany(companyId?: number | null): Promise<CompanySettings | null> {
  if (!companyId) return null;
  return (await storage.getCompanySettings(companyId)) ?? null;
}

function buildFrom(displayName: string, address: string): string {
  const safeName = (displayName || FALLBACK_DISPLAY_NAME).replace(/[\r\n]+/g, " ").trim();
  return `"${safeName.replace(/"/g, "'")}" <${address}>`;
}

export function getBaseUrl(): string {
  // 1) Override esplicito (dominio custom o configurazione manuale)
  const explicit = process.env.BASE_URL || process.env.DEV_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  // 2) In produzione: dominio reale del deploy (es. xxx.replit.app o custom domain)
  if (process.env.NODE_ENV === "production" && process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(",")[0].trim();
    if (first) return `https://${first}`;
  }

  // 3) In dev su Replit: dominio pubblico del workspace
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  // 4) Ultimo fallback: locale
  return "http://localhost:5000";
}

export interface ContractRequestEmailContent {
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
  fromHeader: string;
  to: string;
  signLink: string;
  contractCode: string;
  clientName: string;
}

/**
 * Costruisce il contenuto dell'email di richiesta firma senza spedirla.
 * Usato sia da `sendContractEmail` (per l'invio reale) sia dal gate di
 * conferma per mostrare al venditore una preview esatta di ciò che il
 * cliente riceverà.
 */
export async function buildContractRequestEmail(opts: {
  contract: Pick<Contract, "sellerId" | "clientData">;
  contractCode: string;
  emailTo?: string;
  companyId?: number | null;
}): Promise<ContractRequestEmailContent> {
  const settings = opts.companyId
    ? await loadSettingsForCompany(opts.companyId)
    : await loadSettingsForSeller(opts.contract.sellerId);
  if (!settings) {
    throw new Error("Impostazioni azienda non trovate per il venditore del contratto.");
  }
  if (!settings.emailFromAddress) {
    throw new Error("Indirizzo mittente non configurato. Imposta 'Email mittente' in Impostazioni Azienda → Configurazione Email.");
  }

  const fromName = settings.emailFromName?.trim() || settings.companyName?.trim() || FALLBACK_DISPLAY_NAME;
  const fromEmail = settings.emailFromAddress;

  const clientData = (opts.contract.clientData as any) || {};
  const clientEmail = (opts.emailTo || clientData?.email || "").trim();
  const clientName = clientData?.cliente_nome || clientData?.nome || "Cliente";
  if (!clientEmail) {
    throw new Error("Email destinatario mancante per l'invio del contratto.");
  }

  const baseUrl = getBaseUrl();
  const signLink = `${baseUrl}/client/${opts.contractCode}?email=${encodeURIComponent(clientEmail)}`;
  const html = renderContractRequestHtml({ clientName, contractUrl: signLink, contractCode: opts.contractCode, senderName: fromName });
  const subject = `Nuovo contratto da firmare — ${fromName}`;
  return {
    subject,
    html,
    fromName,
    fromEmail,
    fromHeader: buildFrom(fromName, fromEmail),
    to: clientEmail,
    signLink,
    contractCode: opts.contractCode,
    clientName,
  };
}

export async function sendContractEmail(
  contract: Contract,
  contractCode: string,
  emailTo?: string,
): Promise<void> {
  const settings = await loadSettingsForSeller(contract.sellerId);
  if (!settings) {
    throw new Error("Impostazioni azienda non trovate per il venditore del contratto.");
  }
  const { transporter } = getTransporterForCompany(settings);
  const built = await buildContractRequestEmail({ contract, contractCode, emailTo });

  console.log("📤 Invio email contratto via SMTP", {
    host: settings.smtpHost,
    to: built.to,
    from: built.fromHeader,
    contractCode,
  });

  try {
    const info = await transporter.sendMail({
      from: built.fromHeader,
      to: built.to,
      subject: built.subject,
      html: built.html,
    });
    console.log("✅ Email contratto inviata, messageId:", info.messageId);
  } catch (error: any) {
    console.error("❌ SMTP error (sendContractEmail):", error?.message || error);
    throw new Error(`Failed to send contract email: ${error?.message || error}`);
  }
}

export async function sendCoFillLinkEmail(opts: {
  companyId: number;
  to: string;
  link: string;
  clientName?: string | null;
}): Promise<{ messageId?: string }> {
  const { companyId, to, link, clientName } = opts;
  if (!to || !/.+@.+\..+/.test(to)) {
    throw new Error("Indirizzo email destinatario non valido.");
  }
  if (!link) {
    throw new Error("Link co-fill mancante.");
  }
  const settings = await loadSettingsForCompany(companyId);
  if (!settings) {
    throw new Error("Impostazioni azienda non trovate per il tenant corrente.");
  }
  const { transporter, fromAddress, fromName } = getTransporterForCompany(settings);

  const safeName = (clientName || "").trim() || "Cliente";
  const subject = `Compila i tuoi dati per il contratto — ${fromName}`;
  const html = renderCoFillLinkHtml({ clientName: safeName, link, senderName: fromName });
  const text =
    `Ciao ${safeName},\n\n` +
    `${fromName} ti chiede di compilare alcuni dati per preparare il tuo contratto.\n` +
    `Apri questo link sicuro dal tuo dispositivo per inserire le informazioni:\n${link}\n\n` +
    `Il link è personale: non condividerlo con altre persone.`;

  try {
    const info = await transporter.sendMail({
      from: buildFrom(fromName, fromAddress),
      to,
      subject,
      html,
      text,
    });
    console.log("✅ Email link co-fill inviata, messageId:", info.messageId);
    return { messageId: info.messageId };
  } catch (error: any) {
    console.error("❌ SMTP error (sendCoFillLinkEmail):", error?.message || error);
    throw enrichSmtpError(error, settings.smtpHost ?? "", settings.smtpPort ?? 0);
  }
}

function renderCoFillLinkHtml(opts: { clientName: string; link: string; senderName: string }): string {
  const { clientName, link, senderName } = opts;
  return `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; }
      .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${escapeHtml(senderName)}</h1>
          <p>Compila i tuoi dati in pochi minuti</p>
        </div>
        <div class="content">
          <h2>Ciao ${escapeHtml(clientName)},</h2>
          <p>Per preparare il tuo contratto abbiamo bisogno di alcuni dati. Apri il link qui sotto dal tuo dispositivo e compila i campi richiesti: vedremo le informazioni in tempo reale e potremo aiutarti se serve.</p>
          <div style="text-align: center;">
            <a href="${escapeHtml(link)}" class="button">Compila i miei dati</a>
          </div>
          <p style="font-size: 12px; word-break: break-all;">Se il pulsante non funziona, copia e incolla questo link nel browser:<br/><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
          <p><em>Questo link è personale e sicuro. Non condividerlo con altre persone.</em></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${escapeHtml(senderName)}. Tutti i diritti riservati.</p>
        </div>
      </div>
    </body></html>
  `;
}

export async function sendTestEmail(companyId: number, to: string): Promise<{ messageId?: string }> {
  if (!to || !/.+@.+\..+/.test(to)) {
    throw new Error("Indirizzo email destinatario non valido.");
  }
  const settings = await loadSettingsForCompany(companyId);
  if (!settings) {
    throw new Error("Impostazioni azienda non trovate per il tenant corrente.");
  }
  const { transporter, fromAddress, fromName } = getTransporterForCompany(settings);

  try {
    await transporter.verify();
  } catch (error: any) {
    throw enrichSmtpError(error, settings.smtpHost ?? "", settings.smtpPort ?? 0);
  }

  const subject = `Email di prova SMTP — ${fromName}`;
  const html = renderTestEmailHtml({ senderName: fromName, host: settings.smtpHost ?? "", port: settings.smtpPort ?? 0 });

  try {
    const info = await transporter.sendMail({
      from: buildFrom(fromName, fromAddress),
      to,
      subject,
      html,
      text: `Questa è un'email di prova inviata dal sistema ${fromName} tramite ${settings.smtpHost}:${settings.smtpPort}. Se la ricevi, la configurazione SMTP è funzionante.`,
    });
    console.log("✅ Email di prova inviata, messageId:", info.messageId);
    return { messageId: info.messageId };
  } catch (error: any) {
    console.error("❌ SMTP error (sendTestEmail):", error?.message || error);
    throw enrichSmtpError(error, settings.smtpHost ?? "", settings.smtpPort ?? 0);
  }
}

function enrichSmtpError(error: any, host: string, port: number): Error {
  const code = error?.code || error?.responseCode;
  const command = error?.command;
  const raw = error?.response || error?.message || String(error);

  if (code === "EDNS" || code === "ENOTFOUND") {
    return new Error(`Host SMTP non raggiungibile: impossibile risolvere "${host}". Verifica il nome del server.`);
  }
  if (code === "ECONNREFUSED") {
    return new Error(`Connessione rifiutata da ${host}:${port}. Verifica host, porta e firewall.`);
  }
  if (code === "ETIMEDOUT" || code === "ESOCKET") {
    return new Error(`Timeout di connessione verso ${host}:${port}. Controlla porta (465/587) e impostazione TLS.`);
  }
  if (code === "EAUTH" || error?.responseCode === 535 || /auth/i.test(raw)) {
    return new Error(`Autenticazione SMTP fallita: utente o password non validi (${raw}).`);
  }
  if (error?.responseCode === 553 || error?.responseCode === 550 || /from|sender|relay/i.test(raw)) {
    return new Error(`Indirizzo mittente rifiutato dal server: ${raw}. Verifica che la casella "Email mittente" coincida con l'utente SMTP.`);
  }
  if (command === "STARTTLS" || /tls|ssl/i.test(raw)) {
    return new Error(`Errore TLS/SSL con ${host}:${port}: ${raw}. Prova a cambiare l'opzione "Connessione TLS implicita".`);
  }
  return new Error(`Errore SMTP (${code || "sconosciuto"}): ${raw}`);
}

function renderTestEmailHtml(opts: { senderName: string; host: string; port: number }): string {
  const { senderName, host, port } = opts;
  return `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; }
      .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email di prova</h1>
          <p>${escapeHtml(senderName)}</p>
        </div>
        <div class="content">
          <p>Questa è un'<strong>email di prova</strong> inviata dalle Impostazioni Azienda → Configurazione Email.</p>
          <p>Se la stai leggendo, la configurazione SMTP funziona correttamente.</p>
          <p><strong>Server:</strong> ${escapeHtml(host)}:${port}</p>
          <p><strong>Inviata il:</strong> ${new Date().toLocaleString("it-IT")}</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${escapeHtml(senderName)}.</p>
        </div>
      </div>
    </body></html>
  `;
}

export async function sendOTPEmail(email: string, otpCode: string, companyId?: number): Promise<void> {
  if (!email) throw new Error("Email destinatario mancante per OTP.");

  const settings = await loadSettingsForCompany(companyId);
  if (!settings) {
    throw new Error("Impostazioni azienda non trovate: impossibile inviare OTP via email.");
  }
  const { transporter, fromAddress, fromName } = getTransporterForCompany(settings);

  const html = renderOtpHtml(otpCode, fromName);

  try {
    const info = await transporter.sendMail({
      from: buildFrom(fromName, fromAddress),
      to: email,
      subject: `Codice di verifica — ${fromName}`,
      html,
    });
    console.log("✅ Email OTP inviata, messageId:", info.messageId);
  } catch (error: any) {
    console.error("❌ SMTP error (sendOTPEmail):", error?.message || error);
    throw new Error(`Failed to send OTP email: ${error?.message || error}`);
  }
}

async function recordEmailFailure(contractId: number | undefined, stage: string, errorMessage: string): Promise<void> {
  if (!contractId) return;
  const entry: InsertAuditLog = {
    contractId,
    action: "email_failed",
    userAgent: null,
    ipAddress: null,
    metadata: { stage, error: errorMessage, at: new Date().toISOString() },
  };
  try {
    await storage.createAuditLog(entry);
  } catch (auditErr) {
    console.error("⚠️  Failed to write email-failure audit log:", auditErr);
  }
}

export async function sendContractSignedNotification(contract: Contract): Promise<void> {
  const settings = await loadSettingsForSeller(contract.sellerId);
  if (!settings) {
    const msg = "Notifica firma: impostazioni azienda non trovate, skip.";
    console.warn("⚠️ " + msg);
    await recordEmailFailure(contract.id, "sendContractSignedNotification:no_settings", msg);
    return;
  }
  let transporter: Transporter, fromAddress: string, fromName: string;
  try {
    ({ transporter, fromAddress, fromName } = getTransporterForCompany(settings));
  } catch (e: any) {
    const msg = `Notifica firma: SMTP non configurato: ${e?.message || e}`;
    console.warn("⚠️ " + msg);
    await recordEmailFailure(contract.id, "sendContractSignedNotification:smtp_config", msg);
    return;
  }

  const clientData = contract.clientData as any;
  const clientEmail = contract.sentToEmail || clientData?.email;
  const clientName = clientData?.cliente_nome || clientData?.nome || "Cliente";

  if (!clientEmail) {
    console.warn("⚠️ Notifica firma: email destinatario mancante, skip.");
    return;
  }

  const html = renderSignedHtml({ clientName, senderName: fromName });

  const attachments: Array<{ filename: string; content: Buffer }> = [];
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
          content: fs.readFileSync(pdfPath),
        });
      } else {
        console.warn("⚠️ PDF firmato non trovato per allegato:", pdfPath);
      }
    } catch (err) {
      console.error("❌ Errore lettura PDF per allegato:", err);
    }
  }

  try {
    const info = await transporter.sendMail({
      from: buildFrom(fromName, fromAddress),
      to: clientEmail,
      subject: `Contratto firmato con successo — ${fromName}`,
      html,
      attachments: attachments.length ? attachments : undefined,
    });
    console.log("✅ Notifica firma inviata, messageId:", info.messageId);
  } catch (error: any) {
    const msg = `SMTP error: ${error?.message || error}`;
    console.error("❌ SMTP error (sendContractSignedNotification):", msg, { code: error?.code, responseCode: error?.responseCode });
    await recordEmailFailure(contract.id, "sendContractSignedNotification:send", msg);
  }
}

// ---------- HTML templates ----------

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
