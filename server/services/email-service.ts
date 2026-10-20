import {
  emailLayout,
  emailParagraph,
  emailButton,
  emailInfoBox,
  emailSteps,
  emailCode,
  emailFallbackLink,
} from "./email-layout";
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
  /** versione solo testo (alternativa all'HTML) */
  text: string;
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
  const text = renderContractRequestText({
    clientName,
    contractUrl: signLink,
    contractCode: opts.contractCode,
    contractNumber: opts.contract.contractNumber ?? null,
    senderName: fromName,
    otpChannel: (settings as any).otpMethod === "twilio" ? "sms" : "email",
  });
  const subject = `Contratto da firmare — ${fromName}`;
  return {
    subject,
    html,
    text,
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
      text: built.text,
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
  const html = emailLayout({
    senderName: fromName,
    eyebrow: "Promemoria firma",
    title: `${safeClient} potrebbe avere bisogno di aiuto`,
    bodyHtml: [
      emailParagraph(`Il cliente <strong>${escapeHtml(safeClient)}</strong> sta provando a firmare il contratto <strong>${escapeHtml(contractCode)}</strong> ma ha inserito un codice errato per <strong>${failedAttempts}</strong> volte negli ultimi <strong>${detectionWindowMinutes} minuti</strong>.`),
      emailParagraph(`Per sicurezza la pagina di firma è bloccata per circa <strong>${lockoutMinutes} minuti</strong>. Contattalo per verificare che abbia ricevuto il codice giusto e accompagnarlo nella firma.`),
      emailInfoBox([
        { label: "Codice contratto", value: contractCode },
        { label: "IP dell'ultimo tentativo", value: attemptIp },
        { label: "Tentativi falliti", value: String(failedAttempts) },
        { label: "Durata blocco", value: `${lockoutMinutes} minuti` },
      ]),
      emailButton(contractLink, "Apri il contratto"),
      emailParagraph("Il blocco si rimuove da solo: poi il cliente potrà chiedere un nuovo codice e firmare.", { muted: true, small: true }),
    ].join(""),
  });


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
  return emailLayout({
    senderName,
    eyebrow: "I tuoi dati",
    title: `Ciao ${clientName}, completa i tuoi dati`,
    preheader: `${senderName} ti chiede alcuni dati per preparare il contratto.`,
    bodyHtml: [
      emailParagraph("Per preparare il tuo contratto servono alcuni dati. Apri il link e compila i campi richiesti: vedremo le informazioni in tempo reale e potremo aiutarti se serve."),
      emailButton(link, "Compila i miei dati"),
      emailFallbackLink(link),
      emailParagraph("Il link è personale: non condividerlo con altre persone.", { muted: true, small: true }),
    ].join(""),
  });
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
  return emailLayout({
    senderName,
    eyebrow: "Configurazione email",
    success: true,
    title: "Email di prova",
    bodyHtml: [
      emailParagraph("Se stai leggendo questa email, la configurazione SMTP funziona correttamente."),
      emailInfoBox([
        { label: "Server", value: `${host}:${port}` },
        { label: "Inviata il", value: new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }) },
      ]),
    ].join(""),
  });
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
  // Una sola copia per casella: "nome+admin@..." e "nome@..." arrivano nella
  // stessa casella (es. admin e venditore della stessa persona).
  const byMailbox = new Map<string, string>();
  for (const u of [seller, ...colleagues.filter((u) => u.role === "admin")]) {
    if (!u.isActive || !/.+@.+\..+/.test(u.email || "")) continue;
    const email = u.email.trim().toLowerCase();
    const mailbox = email.replace(/\+[^@]*@/, "@");
    if (!byMailbox.has(mailbox)) byMailbox.set(mailbox, email);
  }
  const recipients = Array.from(byMailbox.values());
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
  const html = emailLayout({
    senderName: fromName,
    eyebrow: "Account",
    title: "Scegli una nuova password",
    bodyHtml: [
      emailParagraph(`Ciao ${escapeHtml(opts.fullName || "")}, abbiamo ricevuto una richiesta di nuova password per il tuo account del gestionale contratti di <strong>${escapeHtml(fromName)}</strong>.`),
      emailButton(opts.link, "Scegli una nuova password"),
      emailParagraph(`Il link vale ${opts.validMinutes} minuti e si può usare una sola volta. Se non hai chiesto tu il cambio, ignora questa email: la password attuale resta valida.`, { muted: true, small: true }),
    ].join(""),
  });

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
  return emailLayout({
    senderName: opts.senderName,
    eyebrow: "Contratto firmato",
    success: true,
    title: `${opts.party} ha firmato`,
    preheader: `${opts.party} ha firmato il contratto${opts.contractNumber ? ` n. ${opts.contractNumber}` : ""}.`,
    bodyHtml: [
      emailInfoBox([
        { label: "Contratto n.", value: opts.contractNumber },
        { label: "Codice contratto", value: opts.contractCode },
        { label: "Firmato il", value: when },
        { label: "Inviato da", value: opts.sellerName },
      ]),
      opts.hasAttachment ? emailParagraph("In allegato il PDF firmato, con il registro delle operazioni.") : "",
      emailButton(opts.dashboardUrl, "Apri la dashboard"),
    ].join(""),
  });
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
    ? "Ricevi un codice di verifica via SMS sul tuo cellulare."
    : "Ricevi un codice di verifica via email.";
  const body = [
    emailParagraph(`${escapeHtml(senderName)} ti ha inviato un contratto da firmare. Puoi leggerlo e firmarlo online, dal computer o dallo smartphone: bastano pochi minuti.`),
    emailButton(contractUrl, "Leggi e firma il contratto"),
    emailInfoBox([
      { label: "Contratto n.", value: opts.contractNumber ?? null },
      { label: "Codice contratto", value: contractCode },
    ]),
    emailSteps("Come funziona", [
      "Leggi il contratto e firma nei riquadri indicati.",
      otpStep,
      "Inserisci il codice e conferma: riceverai una copia del contratto firmato.",
    ]),
    emailFallbackLink(contractUrl),
    emailParagraph("Il link è personale: non inoltrare questa email ad altre persone.", { muted: true, small: true }),
  ].join("");
  return emailLayout({
    senderName,
    eyebrow: "Contratto da firmare",
    title: `Ciao ${clientName}, c'è un contratto per te`,
    preheader: `${senderName} ti ha inviato un contratto da leggere e firmare online.`,
    bodyHtml: body,
    footerNote: "Hai ricevuto questa email perché ti è stato inviato un contratto da firmare.",
  });
}

/** Testo semplice della richiesta di firma (alternativa all'HTML, aiuta la consegna). */
export function renderContractRequestText(opts: {
  clientName: string;
  contractUrl: string;
  contractCode: string;
  contractNumber?: string | null;
  senderName: string;
  otpChannel: "sms" | "email";
}): string {
  return [
    `Ciao ${opts.clientName},`,
    "",
    `${opts.senderName} ti ha inviato un contratto da firmare. Puoi leggerlo e firmarlo online qui:`,
    opts.contractUrl,
    "",
    ...(opts.contractNumber ? [`Contratto n. ${opts.contractNumber}`] : []),
    `Codice contratto: ${opts.contractCode}`,
    "",
    "Come funziona:",
    "1. Leggi il contratto e firma nei riquadri indicati.",
    `2. ${opts.otpChannel === "sms" ? "Ricevi un codice di verifica via SMS sul tuo cellulare." : "Ricevi un codice di verifica via email."}`,
    "3. Inserisci il codice e conferma: riceverai una copia del contratto firmato.",
    "",
    "Il link è personale: non inoltrare questa email ad altre persone.",
    "",
    opts.senderName,
  ].join("\n");
}

function renderOtpHtml(otpCode: string, senderName: string): string {
  return emailLayout({
    senderName,
    eyebrow: "Codice di verifica",
    title: "Il tuo codice per firmare",
    preheader: `Codice di verifica: ${otpCode}. Vale 10 minuti.`,
    bodyHtml: [
      emailParagraph("Inserisci questo codice nella pagina del contratto per completare la firma:"),
      emailCode(otpCode),
      emailParagraph("Il codice vale 10 minuti e si può usare una sola volta. Non comunicarlo a nessuno."),
      emailParagraph(`Se non stai firmando un contratto di ${escapeHtml(senderName)}, ignora questa email.`, { muted: true, small: true }),
    ].join(""),
  });
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
  return emailLayout({
    senderName,
    eyebrow: "Firma completata",
    success: true,
    title: "Contratto firmato",
    preheader: `Il contratto${opts.contractNumber ? ` n. ${opts.contractNumber}` : ""} è stato firmato.`,
    bodyHtml: [
      emailParagraph(`Gentile ${escapeHtml(clientName)}, ti confermiamo che il contratto${opts.contractNumber ? ` n. <span style="white-space:nowrap">${escapeHtml(opts.contractNumber)}</span>` : ""} è stato firmato.`),
      emailInfoBox([
        { label: "Data e ora", value: signedAtText },
        { label: "Metodo", value: "Firma elettronica con codice di verifica monouso (OTP)" },
      ]),
      opts.hasAttachment
        ? emailParagraph("In allegato trovi il PDF del contratto firmato, con in coda il registro delle operazioni. Conservalo per i tuoi archivi.")
        : emailParagraph("La copia firmata in PDF ti verrà inviata separatamente."),
    ].join(""),
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
