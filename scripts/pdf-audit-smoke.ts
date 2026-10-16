/**
 * Prova del PDF firmato con dati finti (nessun accesso al database).
 * Genera un PDF con OTP via email, ne estrae il testo con `pdftotext` e
 * verifica che il registro sia veritiero. Uso: `npm run test:pdf`
 * Il PDF resta in generated-artifacts/pdf-audit-smoke.pdf (cartella esclusa
 * da git e dalla pubblicazione) per controllarlo a occhio dal pannello file.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { generatePDF, closePdfBrowser } from "../server/services/pdf-generator-new";

const OUT_DIR = path.join(process.cwd(), "generated-artifacts");
const OUT = path.join(OUT_DIR, "pdf-audit-smoke.pdf");
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const t = (min: number) => new Date(Date.UTC(2026, 9, 16, 8, min, 0));

async function main() {
  const email = "mario.rossi.indirizzo.molto.lungo@example.com";
  const logs: any[] = [
    { id: 1, contractId: 999999, action: "created", ipAddress: "93.44.12.10", userAgent: UA, metadata: {}, timestamp: t(0) },
    { id: 2, contractId: 999999, action: "sent", ipAddress: "93.44.12.10", userAgent: UA, metadata: { sentToEmail: email }, timestamp: t(1) },
    ...Array.from({ length: 6 }, (_, i) => ({ id: 3 + i, contractId: 999999, action: "viewed", ipAddress: "151.20.33.44", userAgent: UA, metadata: { accessMethod: "email_link" }, timestamp: t(5 + i) })),
    { id: 20, contractId: 999999, action: "otp_sent", ipAddress: "151.20.33.44", userAgent: UA, metadata: { method: "email", twilioVerify: false, sentTo: email, contact: "3331234567" }, timestamp: t(20) },
    { id: 21, contractId: 999999, action: "signed", ipAddress: "151.20.33.44", userAgent: UA, timestamp: t(21),
      metadata: { signatureMethod: "otp_verification", otpMethod: "email", verifiedContact: email, emailUsedForSigning: email, phoneNumber: "3331234567", contentSha256: "b".repeat(64) } },
    { id: 22, contractId: 999999, action: "archived", ipAddress: "93.44.12.10", metadata: {}, timestamp: t(30) },
  ];
  const contract = {
    id: 999999, templateName: "Contratto di prova", generatedContent: "<p>Corpo del contratto di prova.</p>",
    clientData: { cliente_nome: "Mario Rossi", email, cellulare: "3331234567", payment_plan: [{ amount: "500,00", date: "2026-11-01" }, { amount: "500,00", date: "2026-12-01" }] },
    template: { name: "Contratto di prova", content: "<p>Corpo del contratto di prova.</p>" },
    status: "signed", signatures: { marketing: "Mario Rossi" }, signedAt: t(21), createdAt: t(0), renewalDuration: 12, autoRenewal: false,
  };
  const company = { companyName: "Studio Prova", address: "Via Roma 1", city: "Roma", postalCode: "00100", taxId: "IT000", pec: "studio@pec.it" };

  const p = await generatePDF(999999, contract.generatedContent, logs, contract, company);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(p, OUT);
  fs.unlinkSync(p);
  await closePdfBrowser();

  const text = execFileSync("pdftotext", ["-layout", OUT, "-"]).toString();
  const problems: string[] = [];
  const must = ["Registro delle operazioni", "via email", "Aperto 6 volte", "b".repeat(64), "16/10/2026"];
  const mustNot = [/whatsapp/i, /\bSMS\b/, /Telefono verificato/i, /Turbo Contract/i, /Archiviato/, /ALE srl/i, /\{"/];
  for (const m of must) if (!text.includes(m)) problems.push(`manca: ${m}`);
  for (const r of mustNot) if (r.test(text)) problems.push(`non dovrebbe esserci: ${r}`);
  // Nessun carattere sostitutivo (emoji senza font) nel testo estratto.
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFFFD]/u.test(text)) problems.push("emoji o caratteri non stampabili nel PDF");
  const fonts = execFileSync("pdffonts", [OUT]).toString();
  if (!/Inter/.test(fonts)) problems.push("font Inter non incorporato");

  if (problems.length) {
    console.error("PDF NON OK:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  console.log(`PDF OK: aprilo da ${path.relative(process.cwd(), OUT)}`);
}

main().catch(async (e) => { console.error(e); await closePdfBrowser(); process.exit(1); });
