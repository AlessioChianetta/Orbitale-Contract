/**
 * Registro delle operazioni stampato in coda al PDF firmato.
 *
 * Modulo puro (nessun accesso a DB/Puppeteer) così da poter essere testato.
 * Regole (documento legale):
 *  - mai dati inventati: se un'informazione non è registrata si dichiara
 *    "non registrato", non si deduce;
 *  - canale OTP: `twilioVerify` dell'ultimo `otp_sent` è l'unica fonte
 *    affidabile; il vecchio campo `method` vale solo quando dice "email";
 *  - il registro si "congela" alla firma: gli eventi successivi (archiviazioni,
 *    aperture, rigenerazioni) non entrano nel documento firmato;
 *  - impaginazione sobria: bianco/nero/grigio, nessuna emoji, tabella a
 *    larghezza fissa che non può uscire dal margine.
 */

export interface AuditLogLike {
  id?: number;
  contractId?: number;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
  timestamp: Date | string;
}

export interface AuditTrailContext {
  contractId: number | string;
  docType?: string;
  status?: string;
  signedAt?: Date | string | null;
  regenerationNotice?: { regeneratedAt?: Date | string; reason?: string | null } | null;
  /** id utente -> "Nome Cognome (email)" per i log scritti dal gestionale */
  userNames?: Record<number, string>;
}

export type OtpChannel = "sms" | "email" | null;

export const AUDIT_TIMEZONE = "Europe/Rome";

// ---------------------------------------------------------------- helpers

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDate(ts: Date | string | null | undefined): Date | null {
  if (!ts) return null;
  const d = ts instanceof Date ? ts : new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

export function formatAuditDate(ts: Date | string | null | undefined): string {
  const d = toDate(ts);
  if (!d) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: AUDIT_TIMEZONE,
  }).format(d);
}

export function formatAuditTime(ts: Date | string | null | undefined): string {
  const d = toDate(ts);
  if (!d) return "";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: AUDIT_TIMEZONE,
  }).format(d);
}

function meta(log: AuditLogLike): Record<string, any> {
  return (log.metadata && typeof log.metadata === "object") ? (log.metadata as Record<string, any>) : {};
}

const looksEmail = (v: unknown): v is string => typeof v === "string" && v.includes("@");
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Browser e sistema operativo dichiarati dallo User-Agent. */
export function describeUserAgent(ua?: string | null): string {
  if (!ua) return "non rilevato";
  let browser = "browser non riconosciuto";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/CriOS|Chrome\//.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "";
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return os ? `${browser} su ${os}` : browser;
}

// ------------------------------------------------------- selezione eventi

function sortAsc<T extends AuditLogLike>(logs: T[]): T[] {
  return [...logs].sort((a, b) => (toDate(a.timestamp)?.getTime() ?? 0) - (toDate(b.timestamp)?.getTime() ?? 0));
}

/**
 * Eventi da stampare: in ordine cronologico e, se il contratto è firmato,
 * solo fino al primo evento "signed" incluso (registro congelato alla firma).
 */
export function selectLogsForPdf<T extends AuditLogLike>(logs: T[]): T[] {
  const sorted = sortAsc(logs || []);
  const signedIdx = sorted.findIndex((l) => l.action === "signed");
  return signedIdx >= 0 ? sorted.slice(0, signedIdx + 1) : sorted;
}

export interface AuditRow<T extends AuditLogLike = AuditLogLike> {
  log: T;
  /** numero di aperture raggruppate (solo per "viewed") */
  count: number;
  lastTimestamp: Date | string;
}

/** Aperture consecutive dallo stesso IP raggruppate in un'unica riga. */
export function groupConsecutiveViews<T extends AuditLogLike>(logs: T[]): AuditRow<T>[] {
  const rows: AuditRow<T>[] = [];
  for (const log of logs) {
    const prev = rows[rows.length - 1];
    if (
      log.action === "viewed" &&
      prev && prev.log.action === "viewed" &&
      (prev.log.ipAddress || "") === (log.ipAddress || "")
    ) {
      prev.count += 1;
      prev.lastTimestamp = log.timestamp;
      continue;
    }
    rows.push({ log, count: 1, lastTimestamp: log.timestamp });
  }
  return rows;
}

// ----------------------------------------------------------- canale OTP

/** Canale di un singolo evento "otp_sent". */
export function otpChannelOfSent(log: AuditLogLike | undefined): OtpChannel {
  if (!log) return null;
  const m = meta(log);
  if (typeof m.twilioVerify === "boolean") return m.twilioVerify ? "sms" : "email";
  if (String(m.method || "").toLowerCase() === "email") return "email";
  return null;
}

/** Canale usato per la firma: ultimo otp_sent → otpMethod congelato → null. */
export function otpChannelForSignature(signedLog: AuditLogLike, allLogs: AuditLogLike[]): OtpChannel {
  const m = meta(signedLog);
  if (m.signatureMethod && m.signatureMethod !== "otp_verification") return null;
  const lastOtpSent = sortAsc(allLogs.filter((l) => l.action === "otp_sent")).pop();
  if (lastOtpSent && typeof meta(lastOtpSent).twilioVerify === "boolean") {
    return otpChannelOfSent(lastOtpSent);
  }
  // Valore congelato sulla firma: "email" è sempre affidabile; "sms" solo
  // nella forma scritta dal codice attuale (minuscolo). L'era col bug
  // scriveva "SMS" maiuscolo anche per invii reali via email: neutro.
  const frozen = String(m.otpMethod || "");
  if (frozen.toLowerCase() === "email") return "email";
  if (frozen === "sms") return "sms";
  if (lastOtpSent && otpChannelOfSent(lastOtpSent) === "email") return "email";
  return null;
}

function otpSentRecipient(log: AuditLogLike, channel: OtpChannel): string | null {
  const m = meta(log);
  if (nonEmpty(m.sentTo)) return m.sentTo;
  if (channel === "sms") {
    if (nonEmpty(m.actualPhoneNumber) && m.actualPhoneNumber !== "N/A") return m.actualPhoneNumber;
    return nonEmpty(m.contact) && !looksEmail(m.contact) ? m.contact : null;
  }
  if (channel === "email") return looksEmail(m.contact) ? m.contact : null;
  return null;
}

function signedVerifiedContact(log: AuditLogLike, channel: OtpChannel): string | null {
  const m = meta(log);
  if (nonEmpty(m.verifiedContact)) return m.verifiedContact;
  const cu = m.contactUsedForOTP;
  const signerEmail = m.emailUsedForSigning || m.emailFromContract;
  if (channel === "email") return looksEmail(cu) ? cu : (looksEmail(signerEmail) ? signerEmail : null);
  if (channel === "sms") {
    if (nonEmpty(cu) && !looksEmail(cu)) return cu;
    return nonEmpty(m.phoneNumber) && m.phoneNumber !== "Telefono non disponibile" ? m.phoneNumber : null;
  }
  return null;
}

// ------------------------------------------------------------ rendering

const NOT_RECORDED = "non registrato";

function line(label: string, value: unknown): string {
  const v = nonEmpty(value) ? escapeHtml(value) : NOT_RECORDED;
  return `<div class="at-line"><span class="at-k">${escapeHtml(label)}:</span> ${v}</div>`;
}

function operatorName(id: unknown, ctx: AuditTrailContext): string {
  const n = typeof id === "number" ? id : parseInt(String(id ?? ""), 10);
  if (!Number.isFinite(n)) return "";
  return ctx.userNames?.[n] || "operatore dell'azienda";
}

export function getActionLabel(action: string): string {
  switch (action) {
    case "created": return "Contratto creato";
    case "updated": return "Contratto modificato";
    case "sent": return "Inviato al firmatario";
    case "updated_and_sent": return "Modificato e reinviato";
    case "viewed": return "Link del contratto aperto";
    case "client_data_updated": return "Dati del firmatario in compilazione";
    case "client_data_completed": return "Dati del firmatario completati";
    case "otp_sent": return "Codice di verifica inviato";
    case "otp_failed": return "Codice di verifica errato";
    case "signed": return "Contratto firmato";
    case "completed": return "Procedura completata";
    case "archived": return "Archiviato";
    case "unarchived": return "Ripristinato dall'archivio";
    case "duplicated": return "Creato da duplicazione";
    case "content_regenerated": return "Testo rigenerato";
    case "content_manually_edited": return "Testo modificato manualmente";
    case "co_fill_draft_created": return "Link di compilazione creato";
    case "co_fill_link_emailed": return "Link di compilazione inviato";
    case "co_fill_link_email_failed": return "Invio link non riuscito";
    case "email_failed": return "Email non recapitata";
    case "incident_review": return "Verifica tecnica interna";
    case "pdf_regenerated": return "PDF rigenerato";
    default: return "Operazione di sistema";
  }
}

export function renderAuditDetails(row: AuditRow, allLogs: AuditLogLike[], ctx: AuditTrailContext): string {
  const { log } = row;
  const m = meta(log);
  const ip = line("Indirizzo IP", log.ipAddress);
  const device = line("Dispositivo", describeUserAgent(log.userAgent));

  switch (log.action) {
    case "sent":
      return [
        line("Destinatario", m.sentToEmail),
        line("Inviato da", operatorName(m.sentBy, ctx) || "sistema"),
        ip,
      ].join("");
    case "updated_and_sent":
      return [line("Destinatario", m.sentToEmail || m.email), ip].join("");
    case "viewed": {
      const via = m.accessMethod === "email_link" ? "link ricevuto via email" : "link diretto";
      const times = row.count > 1
        ? `<div class="at-line">Aperto ${row.count} volte, fino alle ${escapeHtml(formatAuditTime(row.lastTimestamp))} del ${escapeHtml(formatAuditDate(row.lastTimestamp))}</div>`
        : "";
      return [times, line("Accesso", via), ip, device].join("");
    }
    case "otp_sent": {
      const channel = otpChannelOfSent(log);
      const recipientLabel = channel === "sms" ? "Inviato al numero" : channel === "email" ? "Inviato all'indirizzo email" : "Recapito";
      return [
        line("Canale", channel === "sms" ? "SMS" : channel === "email" ? "Email" : null),
        line(recipientLabel, otpSentRecipient(log, channel)),
        ip,
      ].join("");
    }
    case "otp_failed":
      return `<div class="at-line">Codice errato o scaduto: nessuna firma con questo tentativo.</div>${ip}${device}`;
    case "signed": {
      const channel = otpChannelForSignature(log, allLogs);
      const method = (m.signatureMethod || "otp_verification") === "otp_verification"
        ? `Firma elettronica con codice monouso (OTP)${channel === "sms" ? " via SMS" : channel === "email" ? " via email" : ""}`
        : m.signatureMethod;
      const contactLabel = channel === "sms" ? "Numero verificato" : channel === "email" ? "Email verificata" : "Recapito verificato";
      return [
        line("Metodo", method),
        line(contactLabel, signedVerifiedContact(log, channel)),
        nonEmpty(m.emailUsedForSigning) && m.emailUsedForSigning !== signedVerifiedContact(log, channel)
          ? line("Email del firmatario", m.emailUsedForSigning) : "",
        ip,
        device,
      ].join("");
    }
    case "created":
    case "updated":
    case "duplicated":
    case "co_fill_draft_created":
      return ip;
    case "client_data_updated":
    case "client_data_completed":
      return ip + device;
    case "content_regenerated":
    case "content_manually_edited":
      return [line("Eseguito da", operatorName(m.regeneratedBy ?? m.editedBy, ctx)), ip].join("");
    case "co_fill_link_emailed":
      return [line("Destinatario", m.sentToEmail || m.email), ip].join("");
    case "co_fill_link_email_failed":
    case "email_failed":
      return `<div class="at-line">Problema tecnico di invio email; non modifica gli eventi registrati.</div>`;
    case "incident_review":
      return `<div class="at-line">Annotazione tecnica interna, senza effetti sul contratto.</div>`;
    default:
      return ip;
  }
}

const AUDIT_CSS = `
  .at { page-break-before: always; font-size: 8.6pt; color: #1d1d1f; line-height: 1.5; }
  .at .at-eyebrow { font-size: 7.5pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #86868b; margin: 0 0 6px 0; }
  .at h1 { font-size: 18pt; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 4px 0; }
  .at .at-sub { font-size: 9pt; color: #6e6e73; margin: 0 0 18px 0; }
  .at table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .at td, .at th { border-bottom: 0.75pt solid #e8e8ed; padding: 7px 10px 7px 0; vertical-align: top; text-align: left;
                   overflow-wrap: anywhere; word-break: break-word; }
  .at th { font-size: 7pt; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: #86868b;
           border-bottom: 0.75pt solid #d2d2d7; padding-top: 0; }
  .at .at-info { background: #f5f5f7; border-radius: 10px; }
  .at .at-info td { padding: 7px 14px; }
  .at .at-info tr:last-child td { border-bottom: none; }
  .at .at-info td.at-k2 { width: 30%; color: #6e6e73; }
  .at .at-events { margin-top: 18px; }
  .at .at-events thead { display: table-header-group; }
  .at .at-events tr { page-break-inside: avoid; }
  .at .at-line { margin: 0; }
  .at .at-k { color: #6e6e73; }
  .at .at-op { font-weight: 600; }
  .at .at-hash { font-family: 'DejaVu Sans Mono', 'Courier New', monospace; font-size: 7.6pt; }
  .at .at-note { margin-top: 18px; border-top: 0.75pt solid #d2d2d7; padding-top: 10px; font-size: 7.8pt; color: #6e6e73;
                 page-break-inside: avoid; }
  .at .at-note p { margin: 0 0 4px 0; }
`;

export function statusLabel(status?: string): string {
  switch (status) {
    case "signed": return "Firmato";
    case "completed": return "Firmato e completato";
    case "sent": return "Inviato, in attesa di firma";
    case "viewed": return "Aperto, in attesa di firma";
    case "draft": return "Bozza";
    default: return status ? status : NOT_RECORDED;
  }
}

/** HTML del registro (da inserire dentro il <body> del documento). */
export function renderAuditTrailHtml(logs: AuditLogLike[], ctx: AuditTrailContext): string {
  const selected = selectLogsForPdf(logs || []);
  if (selected.length === 0) return "";
  const rows = groupConsecutiveViews(selected);
  const signedLog = selected.find((l) => l.action === "signed");
  const signedMeta = signedLog ? meta(signedLog) : {};
  const signedAt = signedLog?.timestamp ?? ctx.signedAt ?? null;
  const contentHash: string | null = nonEmpty(signedMeta.contentSha256) ? signedMeta.contentSha256 : null;

  const info = [
    ["Contratto", `n. ${ctx.contractId}${ctx.docType ? ` — ${ctx.docType}` : ""}`],
    ["Stato", statusLabel(ctx.status)],
    ...(signedAt ? [["Firmato il", `${formatAuditDate(signedAt)} alle ${formatAuditTime(signedAt)}`]] : []),
    ["Fuso orario", "Tutti gli orari sono espressi nell'ora italiana (Europe/Rome)"],
    ...(contentHash ? [["Impronta SHA-256 del testo firmato", `<span class="at-hash">${escapeHtml(contentHash)}</span>`]] : []),
  ] as Array<[string, string]>;

  const infoHtml = info.map(([k, v]) =>
    `<tr><td class="at-k2">${escapeHtml(k)}</td><td>${k.startsWith("Impronta") ? v : escapeHtml(v)}</td></tr>`
  ).join("");

  const eventsHtml = rows.map((row) => `
      <tr>
        <td class="at-op">${escapeHtml(getActionLabel(row.log.action))}</td>
        <td>${escapeHtml(formatAuditDate(row.log.timestamp))}<br>${escapeHtml(formatAuditTime(row.log.timestamp))}</td>
        <td>${renderAuditDetails(row, selected, ctx)}</td>
      </tr>`).join("");

  const regenerated = ctx.regenerationNotice
    ? `<p>Il testo di questo PDF è stato rigenerato il ${escapeHtml(formatAuditDate(ctx.regenerationNotice.regeneratedAt))} dopo la firma${ctx.regenerationNotice.reason ? ` (motivo: ${escapeHtml(ctx.regenerationNotice.reason)})` : ""}. ${contentHash ? "L'impronta indicata sopra si riferisce al testo originale al momento della firma." : ""}</p>`
    : "";

  return `
    <style>${AUDIT_CSS}</style>
    <section class="at">
      <p class="at-eyebrow">Allegato</p>
      <h1>Registro delle operazioni</h1>
      <p class="at-sub">Eventi registrati dal sistema di firma${signedLog ? " fino al momento della firma" : ""}.</p>
      <table class="at-info">${infoHtml}</table>
      <table class="at-events">
        <colgroup><col style="width: 24%"><col style="width: 16%"><col style="width: 60%"></colgroup>
        <thead><tr><th>Operazione</th><th>Data e ora</th><th>Dettagli</th></tr></thead>
        <tbody>${eventsHtml}</tbody>
      </table>
      <div class="at-note">
        <p>Questo registro è generato automaticamente dal sistema di firma elettronica. Per ogni evento sono riportati data e ora, l'indirizzo IP e il dispositivo rilevati dal server.</p>
        ${contentHash ? `<p>L'impronta SHA-256 identifica in modo univoco il testo contrattuale firmato. L'impronta del file PDF originale è conservata negli archivi del sistema e permette di verificare che il file non sia stato modificato.</p>` : ""}
        ${regenerated}
      </div>
    </section>`;
}
