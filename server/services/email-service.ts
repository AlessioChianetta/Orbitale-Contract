import * as fs from 'fs';
import * as path from 'path';
import nodemailer, { Transporter } from 'nodemailer';
import { Contract, CompanySettings, InsertAuditLog } from '@shared/schema';
import { storage } from "../storage";
import { getSignerGreetingName, getContractPartyDisplayName } from '@shared/client-fields';

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

// Mai il marchio della piattaforma: i destinatari sono clienti delle aziende.
const FALLBACK_DISPLAY_NAME = "Contratti";

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
  contract: Pick<Contract, "sellerId" | "clientData"> & { contractNumber?: string | null };
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
  const clientName = getSignerGreetingName(clientData) || "Cliente";
  if (!clientEmail) {
    throw new Error("Email destinatario mancante per l'invio del contratto.");
  }

  const baseUrl = getBaseUrl();
  const signLink = `${baseUrl}/client/${opts.contractCode}?email=${encodeURIComponent(clientEmail)}`;
  const html = renderContractRequestHtml({
    clientName,
    contractUrl: signLink,
    contractCode: opts.contractCode,
    contractNumber: opts.contract.contractNumber ?? null,
    senderName: fromName,
    otpChannel: (settings as any).otpMethod === "twilio" ? "sms" : "email",
  });
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

export async function sendOtpLockoutAlertEmail(opts: {
  companyId: number;
  to: string;
  contractCode: string;
  contractLink: string;
  attemptIp: string;
  clientName?: string | null;
  failedAttempts: number;
  detectionWindowMinutes: number;
  lockoutMinutes: number;
}): Promise<{ messageId?: string }> {
  const { companyId, to, contractCode, contractLink, attemptIp, clientName, failedAttempts, detectionWindowMinutes, lockoutMinutes } = opts;
  if (!to || !/.+@.+\..+/.test(to)) {
    throw new Error("Indirizzo email destinatario non valido.");
  }
  const settings = await loadSettingsForCompany(companyId);
  if (!settings) {
    throw new Error("Impostazioni azienda non trovate per il tenant corrente.");
  }
  const { transporter, fromAddress, fromName } = getTransporterForCompany(settings);

  const safeClient = (clientName || "").trim() || "Cliente";
  const subject = `Promemoria firma — possibile difficoltà del cliente sul contratto ${contractCode}`;
  const html = `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; }
      .meta { background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:12px 16px; margin:16px 0; font-size:14px; }
      .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin:0;">${escapeHtml(fromName)}</h2>
          <p style="margin:4px 0 0;">Promemoria firma cliente</p>
        </div>
        <div class="content">
          <p>Ciao,</p>
          <p>il cliente <strong>${escapeHtml(safeClient)}</strong> sta provando a firmare il contratto <strong>${escapeHtml(contractCode)}</strong> ma ha inserito un codice OTP errato per <strong>${failedAttempts}</strong> volte negli ultimi <strong>${detectionWindowMinutes} minuti</strong>.</p>
          <p>Per sicurezza la pagina di firma è stata temporaneamente bloccata per circa <strong>${lockoutMinutes} minuti</strong>. Probabilmente il cliente ha bisogno di aiuto: contattalo per verificare che abbia ricevuto il codice corretto e accompagnarlo nella firma.</p>
          <div class="meta">
            <div><strong>Codice contratto:</strong> ${escapeHtml(contractCode)}</div>
            <div><strong>Link al contratto:</strong> <a href="${escapeHtml(contractLink)}">${escapeHtml(contractLink)}</a></div>
            <div><strong>IP dell'ultimo tentativo:</strong> ${escapeHtml(attemptIp)}</div>
            <div><strong>Tentativi falliti:</strong> ${failedAttempts}</div>
            <div><strong>Finestra di rilevazione:</strong> ${detectionWindowMinutes} minuti</div>
            <div><strong>Durata blocco:</strong> ${lockoutMinutes} minuti</div>
          </div>
          <p style="font-size:12px;color:#666;">Il blocco si rimuove automaticamente trascorsa la finestra. Il cliente potrà richiedere un nuovo codice e completare la firma.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${escapeHtml(fromName)}</p>
        </div>
      </div>
    </body></html>
  `;

  try {
    const info = await transporter.sendMail({
      from: buildFrom(fromName, fromAddress),
      to,
      subject,
      html,
    });
    console.log("✅ Email alert OTP lockout inviata, messageId:", info.messageId);
    return { messageId: info.messageId };
  } catch (error: any) {
    console.error("❌ SMTP error (sendOtpLockoutAlertEmail):", error?.message || error);
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

/** PDF firmato da allegare alle email (vuoto se il file non c'è). */
function loadSignedPdfAttachment(contract: Contract, displayNumber: string | null): Array<{ filename: string; content: Buffer }> {
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
          filename: `contratto-firmato-${displayNumber || contract.contractCode}.pdf`,
          content: fs.readFileSync(pdfPath),
        });
      } else {
        console.warn("⚠️ PDF firmato non trovato per allegato:", pdfPath);
      }
    } catch (err) {
      console.error("❌ Errore lettura PDF per allegato:", err);
    }
  }
  return attachments;
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
  const clientName = getSignerGreetingName(clientData) || "Cliente";
  const displayNumber = contract.contractNumber || null;

  if (!clientEmail) {
    console.warn("⚠️ Notifica firma: email destinatario mancante, skip.");
    return;
  }


  const attachments = loadSignedPdfAttachment(contract, displayNumber);

  const html = renderSignedHtml({
    clientName,
    senderName: fromName,
    signedAt: contract.signedAt ?? null,
    hasAttachment: attachments.length > 0,
    contractNumber: displayNumber,
  });

  try {
    const info = await transporter.sendMail({
      from: buildFrom(fromName, fromAddress),
      to: clientEmail,
      subject: displayNumber ? `Contratto n. ${displayNumber} firmato — ${fromName}` : `Contratto firmato — ${fromName}`,
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

/**
 * Avvisa l'operatore che ha mandato il contratto e gli amministratori della
 * sua azienda che il cliente ha firmato (con il PDF firmato in allegato).
 * Usa l'SMTP dell'azienda; un errore viene registrato nel registro del
 * contratto ma non blocca la firma.
 */
export async function sendContractSignedOperatorNotification(contract: Contract): Promise<{ sentTo: string[] }> {
  const seller = await storage.getUser(contract.sellerId);
  if (!seller?.companyId) return { sentTo: [] };
  const settings = await loadSettingsForCompany(seller.companyId);
  if (!settings) return { sentTo: [] };

  const colleagues = await storage.getUsersByCompany(seller.companyId);
  const recipients = Array.from(new Set(
    [seller, ...colleagues.filter((u) => u.role === "admin")]
      .filter((u) => u.isActive && /.+@.+\..+/.test(u.email || ""))
      .map((u) => u.email.trim().toLowerCase()),
  ));
  if (!recipients.length) return { sentTo: [] };

  let transporter: Transporter, fromAddress: string, fromName: string;
  try {
    ({ transporter, fromAddress, fromName } = getTransporterForCompany(settings));
  } catch (e: any) {
    await recordEmailFailure(contract.id, "sendContractSignedOperatorNotification:smtp_config", `SMTP non configurato: ${e?.message || e}`);
    return { sentTo: [] };
  }

  const cd = (contract.clientData as any) || {};
  const party = getContractPartyDisplayName(cd) || getSignerGreetingName(cd) || "Cliente";
  const displayNumber = contract.contractNumber || null;
  const attachments = loadSignedPdfAttachment(contract, displayNumber);
  const html = renderOperatorSignedHtml({
    party,
    contractNumber: displayNumber,
    contractCode: contract.contractCode,
    signedAt: contract.signedAt ?? null,
    sellerName: seller.fullName,
    senderName: fromName,
    dashboardUrl: `${getBaseUrl()}/auth`,
    hasAttachment: attachments.length > 0,
  });
  try {
    await transporter.sendMail({
      from: buildFrom(fromName, fromAddress),
      to: recipients.join(", "),
      subject: displayNumber ? `Firmato: contratto n. ${displayNumber} — ${party}` : `Firmato: contratto di ${party}`,
      html,
      attachments: attachments.length ? attachments : undefined,
    });
    return { sentTo: recipients };
  } catch (error: any) {
    await recordEmailFailure(contract.id, "sendContractSignedOperatorNotification:send", `SMTP error: ${error?.message || error}`);
    return { sentTo: [] };
  }
}

/**
 * Link per scegliere una nuova password. Parte dall'SMTP dell'azienda
 * dell'utente (mai da quello del proprietario): se non è configurato
 * l'errore risale al chiamante, che lo registra senza rivelarlo.
 */
export async function sendPasswordResetEmail(opts: {
  companyId: number;
  to: string;
  fullName: string;
  link: string;
  validMinutes: number;
}): Promise<void> {
  const settings = await loadSettingsForCompany(opts.companyId);
  if (!settings) throw new Error("Impostazioni azienda non trovate.");
  const { transporter, fromAddress, fromName } = getTransporterForCompany(settings);
  const html = `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .content { padding: 20px; background-color: #f9f9f9; }
      .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 16px 0; }
    </style></head>
    <body>
      <div class="container">
        <div class="content">
          <p>Ciao ${escapeHtml(opts.fullName || "")},</p>
          <p>abbiamo ricevuto una richiesta di nuova password per il tuo account del gestionale contratti di <strong>${escapeHtml(fromName)}</strong>.</p>
          <p style="text-align:center;"><a href="${escapeHtml(opts.link)}" class="button">Scegli una nuova password</a></p>
          <p>Il link vale ${opts.validMinutes} minuti e si può usare una sola volta. Se non hai chiesto tu il cambio, ignora questa email: la password attuale resta valida.</p>
        </div>
      </div>
    </body></html>
  `;
  await transporter.sendMail({
    from: buildFrom(fromName, fromAddress),
    to: opts.to,
    subject: `Nuova password — ${fromName}`,
    html,
  });
}

// ---------- HTML templates ----------

export function renderOperatorSignedHtml(opts: {
  party: string;
  contractNumber: string | null;
  contractCode: string;
  signedAt: Date | string | null;
  sellerName: string;
  senderName: string;
  dashboardUrl: string;
  hasAttachment: boolean;
}): string {
  const d = opts.signedAt ? new Date(opts.signedAt) : null;
  const when = d && !isNaN(d.getTime())
    ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Rome" }).format(d) + " (ora italiana)"
    : null;
  return `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; }
      .meta { background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:12px 16px; margin:16px 0; font-size:14px; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin:0;">Contratto firmato</h2>
          <p style="margin:4px 0 0;">${escapeHtml(opts.senderName)}</p>
        </div>
        <div class="content">
          <p><strong>${escapeHtml(opts.party)}</strong> ha firmato il contratto.</p>
          <div class="meta">
            ${opts.contractNumber ? `<div><strong>Contratto n.:</strong> ${escapeHtml(opts.contractNumber)}</div>` : ""}
            <div><strong>Codice contratto:</strong> ${escapeHtml(opts.contractCode)}</div>
            ${when ? `<div><strong>Firmato il:</strong> ${escapeHtml(when)}</div>` : ""}
            <div><strong>Inviato da:</strong> ${escapeHtml(opts.sellerName)}</div>
          </div>
          <p>${opts.hasAttachment ? "In allegato il PDF firmato, con il registro delle operazioni. " : ""}Il contratto è visibile nella dashboard: <a href="${escapeHtml(opts.dashboardUrl)}">${escapeHtml(opts.dashboardUrl)}</a></p>
        </div>
      </div>
    </body></html>
  `;
}


export function renderContractRequestHtml(opts: {
  clientName: string;
  contractUrl: string;
  contractCode: string;
  /** numero per azienda (es. 2026-0001), se assegnato */
  contractNumber?: string | null;
  senderName: string;
  /** canale con cui arriverà il codice di verifica (impostazione azienda) */
  otpChannel: "sms" | "email";
}): string {
  const { clientName, contractUrl, contractCode, senderName, otpChannel } = opts;
  const otpStep = otpChannel === "sms"
    ? "Ricevere un codice di verifica via SMS sul tuo cellulare"
    : "Ricevere un codice di verifica via email";
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
          ${opts.contractNumber ? `<p><strong>Contratto n.</strong> ${escapeHtml(opts.contractNumber)}</p>` : ""}
          <p><strong>Codice contratto:</strong> ${escapeHtml(contractCode)}</p>
          <p>La firma è completamente digitale. Ti verrà richiesto di:</p>
          <ul>
            <li>Leggere il documento completo</li>
            <li>${otpStep}</li>
            <li>Inserire il codice ricevuto</li>
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

export function renderSignedHtml(opts: { clientName: string; senderName: string; signedAt: Date | string | null; hasAttachment: boolean; contractNumber?: string | null }): string {
  const { clientName, senderName } = opts;
  const signedAtDate = opts.signedAt ? new Date(opts.signedAt) : null;
  const signedAtText = signedAtDate && !isNaN(signedAtDate.getTime())
    ? new Intl.DateTimeFormat("it-IT", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Rome",
      }).format(signedAtDate) + " (ora italiana)"
    : null;
  return `
    <!DOCTYPE html>
    <html><head><style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background-color: #f9f9f9; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Contratto firmato</h1>
          <p>${escapeHtml(senderName)}</p>
        </div>
        <div class="content">
          <h2>Gentile ${escapeHtml(clientName)},</h2>
          <p>ti confermiamo che il contratto${opts.contractNumber ? ` n. ${escapeHtml(opts.contractNumber)}` : ""} è stato firmato.</p>
          <p><strong>Dettagli della firma:</strong></p>
          <ul>
            ${signedAtText ? `<li>Data e ora: ${escapeHtml(signedAtText)}</li>` : ""}
            <li>Metodo: firma elettronica con codice di verifica monouso (OTP)</li>
          </ul>
          ${opts.hasAttachment
            ? `<p>In allegato trovi il PDF del contratto firmato, con in coda il registro delle operazioni. Conservalo per i tuoi archivi.</p>`
            : `<p>La copia firmata in PDF ti verrà inviata separatamente.</p>`}
          <p>${escapeHtml(senderName)}</p>
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
