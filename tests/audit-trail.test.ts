import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderAuditTrailHtml,
  selectLogsForPdf,
  groupConsecutiveViews,
  otpChannelForSignature,
  describeUserAgent,
  type AuditLogLike,
} from "../server/services/audit-trail";
import { getClientIp } from "../server/services/client-ip";
import { renderSignedHtml, renderContractRequestHtml } from "../server/services/email-service";
import { buildSignedWhatsAppMessage, isCompanyWhatsAppConfigured } from "../server/services/twilio-service";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const t = (min: number) => new Date(Date.UTC(2026, 9, 16, 8, min, 0)); // 10:xx ora italiana

function emailFlow(): AuditLogLike[] {
  return [
    { action: "created", ipAddress: "93.44.12.10", userAgent: IPHONE_UA, metadata: {}, timestamp: t(0) },
    { action: "sent", ipAddress: "93.44.12.10", metadata: { sentBy: 7, sentToEmail: "mario@example.com" }, timestamp: t(1) },
    { action: "viewed", ipAddress: "151.20.33.44", userAgent: IPHONE_UA, metadata: { accessMethod: "email_link" }, timestamp: t(5) },
    { action: "viewed", ipAddress: "151.20.33.44", userAgent: IPHONE_UA, metadata: { accessMethod: "email_link" }, timestamp: t(40) },
    {
      action: "otp_sent", ipAddress: "151.20.33.44",
      metadata: { method: "email", twilioVerify: false, sentTo: "mario@example.com", contact: "3331234567", actualPhoneNumber: "3331234567" },
      timestamp: t(41),
    },
    {
      action: "signed", ipAddress: "151.20.33.44", userAgent: IPHONE_UA, timestamp: t(42),
      metadata: {
        signatureMethod: "otp_verification", otpMethod: "email", verifiedContact: "mario@example.com",
        emailUsedForSigning: "mario@example.com", phoneNumber: "3331234567", contactUsedForOTP: "mario@example.com",
        contentSha256: "a".repeat(64),
      },
    },
    // eventi DOPO la firma: non devono comparire nel registro firmato
    { action: "archived", ipAddress: "93.44.12.10", metadata: {}, timestamp: t(50) },
    { action: "viewed", ipAddress: "93.44.12.10", metadata: {}, timestamp: t(55) },
  ];
}

const ctx = { contractId: 42, docType: "Contratto di prova", status: "signed", userNames: { 7: "Laura Bianchi (laura@studio.it)" } };

test("firma via email: nessuna menzione di SMS, WhatsApp o telefono verificato", () => {
  const html = renderAuditTrailHtml(emailFlow(), ctx);
  assert.match(html, /Firma elettronica con codice monouso \(OTP\) via email/);
  assert.match(html, /Email verificata:<\/span> mario@example\.com/);
  assert.doesNotMatch(html, /whatsapp/i);
  assert.doesNotMatch(html, /\bSMS\b/);
  assert.doesNotMatch(html, /3331234567/); // il telefono non è il recapito verificato
});

test("firma via SMS (Twilio Verify): canale e numero corretti", () => {
  const logs: AuditLogLike[] = [
    { action: "otp_sent", ipAddress: "1.1.1.1", metadata: { twilioVerify: true, sentTo: "+393331234567" }, timestamp: t(1) },
    { action: "signed", ipAddress: "1.1.1.1", metadata: { signatureMethod: "otp_verification", otpMethod: "sms", verifiedContact: "+393331234567" }, timestamp: t(2) },
  ];
  const html = renderAuditTrailHtml(logs, ctx);
  assert.match(html, /via SMS/);
  assert.match(html, /Numero verificato:<\/span> \+393331234567/);
});

test("log storici ambigui: canale non dedotto, dicitura neutra", () => {
  const logs: AuditLogLike[] = [
    { action: "otp_sent", metadata: { method: "sms", contact: "3331234567" }, timestamp: t(1) },
    { action: "signed", metadata: { signatureMethod: "otp_verification", otpMethod: "SMS", phoneNumber: "3331234567" }, timestamp: t(2) },
  ];
  const channel = otpChannelForSignature(logs[1], logs);
  assert.equal(channel, null);
  const html = renderAuditTrailHtml(logs, ctx);
  assert.doesNotMatch(html, /\bSMS\b/);
  assert.match(html, /Recapito verificato:<\/span> non registrato/);
});

test("registro congelato alla firma e aperture raggruppate", () => {
  const selected = selectLogsForPdf(emailFlow());
  assert.equal(selected[selected.length - 1].action, "signed");
  assert.ok(!selected.some((l) => l.action === "archived"));
  const rows = groupConsecutiveViews(selected);
  const views = rows.filter((r) => r.log.action === "viewed");
  assert.equal(views.length, 1);
  assert.equal(views[0].count, 2);
  const html = renderAuditTrailHtml(emailFlow(), ctx);
  assert.match(html, /Aperto 2 volte/);
  assert.doesNotMatch(html, /Archiviato/);
});

test("niente emoji, niente JSON grezzo, niente nome della piattaforma, orari in ora italiana", () => {
  const logs = [...emailFlow(), { action: "qualcosa_di_nuovo", metadata: { foo: "bar" }, timestamp: t(3) } as AuditLogLike];
  const html = renderAuditTrailHtml(logs, ctx);
  assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(html, /\{"/);
  assert.doesNotMatch(html, /Turbo Contract/i);
  assert.match(html, /16\/10\/2026/);
  assert.match(html, /10:42:00/); // 08:42 UTC = 10:42 ora legale italiana
});

test("mittente mostrato con nome, non con l'id interno", () => {
  const html = renderAuditTrailHtml(emailFlow(), ctx);
  assert.match(html, /Laura Bianchi \(laura@studio\.it\)/);
  assert.doesNotMatch(html, /Utente ID/);
});

test("impronta del testo firmato stampata; nessuna dichiarazione di 'manomissione rilevabile' senza impronta", () => {
  const html = renderAuditTrailHtml(emailFlow(), ctx);
  assert.match(html, new RegExp("a".repeat(64)));
  const noHash = emailFlow().map((l) => l.action === "signed" ? { ...l, metadata: { ...(l.metadata as any), contentSha256: undefined } } : l);
  const html2 = renderAuditTrailHtml(noHash, ctx);
  assert.doesNotMatch(html2, /SHA-256/);
  assert.doesNotMatch(html2, /manomissione/i);
});

test("valori inseriti dall'utente sono neutralizzati (HTML escape)", () => {
  const logs: AuditLogLike[] = [
    { action: "sent", metadata: { sentToEmail: "<script>alert(1)</script>@x.it" }, timestamp: t(1) },
  ];
  const html = renderAuditTrailHtml(logs, ctx);
  assert.doesNotMatch(html, /<script>/);
});

test("user agent descritto in modo leggibile", () => {
  assert.equal(describeUserAgent(IPHONE_UA), "Safari su iOS");
  assert.equal(describeUserAgent(null), "non rilevato");
});

test("IP: si usa req.ip (rispetta trust proxy), mai l'header X-Forwarded-For grezzo", () => {
  const req: any = { ip: "::ffff:151.20.33.44", headers: { "x-forwarded-for": "6.6.6.6" } };
  assert.equal(getClientIp(req), "151.20.33.44");
  assert.equal(getClientIp({ socket: { remoteAddress: "10.0.0.1" } }), "10.0.0.1");
});

test("email di firma: niente 'avanzata'/eIDAS, data della firma in ora italiana", () => {
  const html = renderSignedHtml({ clientName: "Mario", senderName: "Studio Prova", signedAt: t(42), hasAttachment: true });
  assert.doesNotMatch(html, /avanzata|eIDAS|sigillat/i);
  assert.match(html, /16\/10\/2026, 10:42/);
  const noPdf = renderSignedHtml({ clientName: "Mario", senderName: "Studio Prova", signedAt: t(42), hasAttachment: false });
  assert.doesNotMatch(noPdf, /In allegato/);
});

test("email di richiesta firma coerente con il canale del codice", () => {
  const base = { clientName: "Mario", contractUrl: "https://x/y", contractCode: "ABC", senderName: "Studio" };
  assert.match(renderContractRequestHtml({ ...base, otpChannel: "email" }), /codice di verifica via email/);
  assert.doesNotMatch(renderContractRequestHtml({ ...base, otpChannel: "email" }), /telefono|SMS/);
  assert.match(renderContractRequestHtml({ ...base, otpChannel: "sms" }), /via SMS/);
});

test("WhatsApp: solo con credenziali dell'azienda, testo con il nome dell'azienda", () => {
  assert.equal(isCompanyWhatsAppConfigured({}), false);
  assert.equal(isCompanyWhatsAppConfigured({ twilioAccountSid: "AC1", twilioAuthToken: "x", twilioWhatsappFrom: "" }), false);
  assert.equal(isCompanyWhatsAppConfigured({ twilioAccountSid: "AC1", twilioAuthToken: "x", twilioWhatsappFrom: "+391234" }), true);
  const msg = buildSignedWhatsAppMessage("Mario", "ABC123", "Studio Prova");
  assert.match(msg, /con Studio Prova/);
});
