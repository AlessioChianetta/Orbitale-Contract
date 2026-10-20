// Flusso completo a livello di rotta (task 001, Fase D) con SMTP simulato:
// anteprima → invio email dal mittente dell'azienda giusta → apertura link →
// OTP via email → firma (privacy obbligatoria) → PDF → notifiche firmato al
// cliente e agli operatori. Anche "il cliente compila i propri dati".
// Gira sul DB collegato con aziende di prova che alla fine vengono rimosse.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import { pool } from "../server/db";
import { startTestApp, Agent, type TestApp } from "./helpers/http-app";
import { SmtpSink } from "./helpers/smtp-sink";
import { createTenant, cleanupTenants, TEST_PASSWORD, type TestTenant } from "./helpers/tenants";

const tag = `flowtest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const sink = new SmtpSink();
let app: TestApp;
let A: TestTenant;
let B: TestTenant;
let ipCounter = 10;
const freshIp = () => `10.99.${Math.floor(Math.random() * 200)}.${ipCounter++}`;

before(async () => {
  await sink.start();
  app = await startTestApp();
  A = await createTenant(tag, "A", { smtpPort: sink.port });
  B = await createTenant(tag, "B", { smtpPort: sink.port });
});

after(async () => {
  try {
    await cleanupTenants([A?.companyId, B?.companyId].filter(Boolean) as number[]);
  } finally {
    await app.close();
    await sink.stop();
    // Chromium usato per i PDF: senza chiuderlo il processo di test non termina.
    const { closePdfBrowser } = await import("../server/services/pdf-generator-new");
    await closePdfBrowser().catch(() => {});
    await pool.end();
  }
});

function fromHeader(msg: { data: string }): string {
  return (msg.data.match(/^From:\s*(.+)$/im) || [])[1] || "";
}

async function latestOtp(contractId: number): Promise<string> {
  const { rows } = await pool.query(
    `SELECT code FROM otp_codes WHERE contract_id = $1 AND is_used = false ORDER BY id DESC LIMIT 1`, [contractId]);
  assert.ok(rows[0], "OTP creato");
  return rows[0].code;
}

async function createAndSend(seller: Agent, tenant: TestTenant, clientData: Record<string, any>, extra: Record<string, any> = {}) {
  const payload = { templateId: tenant.templateId, clientData, sendToEmail: clientData.email, ...extra };
  const preview = await seller.post("/api/contracts/preview", payload);
  assert.equal(preview.status, 200, preview.text);
  assert.ok(preview.json.previewToken);
  const created = await seller.post("/api/contracts", { ...payload, sendImmediately: true, previewToken: preview.json.previewToken });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.json.warning, undefined, `invio riuscito: ${created.json.message}`);
  return created.json as { id: number; contractCode: string; contractNumber: string };
}

async function signFlow(contract: { id: number; contractCode: string }, tenant: TestTenant, clientEmail: string) {
  const otherTenant = tenant === A ? B : A;
  const otherBefore = sink.to(otherTenant.adminEmail).length + sink.to(otherTenant.sellerEmail).length;
  const client = new Agent(app.baseUrl, freshIp());
  const page = await client.get(`/api/client/contracts/${contract.contractCode}`);
  assert.equal(page.status, 200, page.text);
  assert.equal(page.json.companySettings.companyName, `${tag} ${tenant === A ? "A" : "B"}`);
  assert.equal(page.json.companySettings.privacyPolicyText, "Informativa privacy di prova.");

  const otp = await client.post(`/api/client/contracts/${contract.contractCode}/send-otp`, {});
  assert.equal(otp.status, 200, otp.text);
  const code = await latestOtp(contract.id);
  const otpMail = (await sink.waitFor(clientEmail)).find((m) => m.text.includes(code));
  assert.ok(otpMail, "email con il codice arrivata al cliente");
  assert.equal(otpMail!.mailFrom, tenant.fromAddress, "OTP spedito dal mittente dell'azienda");

  const noPrivacy = await client.post(`/api/client/contracts/${contract.contractCode}/sign`, {
    otpCode: code, consents: { privacy: false }, signatures: {},
  });
  assert.equal(noPrivacy.status, 400, "senza privacy la firma è rifiutata");
  const { rows: stillOpen } = await pool.query(`SELECT is_used FROM otp_codes WHERE contract_id = $1 AND code = $2`, [contract.id, code]);
  assert.equal(stillOpen[0].is_used, false, "il codice non viene consumato dal rifiuto");

  const signed = await client.post(`/api/client/contracts/${contract.contractCode}/sign`, {
    otpCode: code, consents: { privacy: true, marketing: false }, signatures: {},
  });
  assert.equal(signed.status, 200, signed.text);

  const { rows: [row] } = await pool.query(`SELECT status, pdf_path, contract_number FROM contracts WHERE id = $1`, [contract.id]);
  assert.equal(row.status, "signed");
  assert.match(row.contract_number, /^\d{4}-\d{4}$/);
  const pdf = await readFile(row.pdf_path);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");

  // Notifica firmato al cliente e avviso agli operatori dell'azienda (venditore + admin).
  const clientMails = await sink.waitFor(clientEmail, 3);
  assert.ok(clientMails.every((m) => m.mailFrom === tenant.fromAddress));
  const sellerMail = (await sink.waitFor(tenant.sellerEmail)).at(-1)!;
  const adminMail = (await sink.waitFor(tenant.adminEmail)).at(-1)!;
  for (const m of [sellerMail, adminMail]) {
    assert.equal(m.mailFrom, tenant.fromAddress);
    assert.match(m.data, /application\/pdf/, "PDF firmato allegato");
  }
  const other = tenant === A ? B : A;
  assert.equal(sink.to(other.adminEmail).length + sink.to(other.sellerEmail).length, otherBefore, "nessuna email agli operatori dell'altra azienda");

  const { rows: audit } = await pool.query(`SELECT action, metadata FROM audit_logs WHERE contract_id = $1`, [contract.id]);
  assert.ok(!audit.some((a) => /whatsapp/i.test(a.action) || /whatsapp/i.test(JSON.stringify(a.metadata))), "nessun WhatsApp");
  const signedLog = audit.find((a) => a.action === "signed");
  assert.equal(signedLog.metadata.otpMethod, "email");
  assert.equal(signedLog.metadata.consents.privacy, true);
  assert.match(signedLog.metadata.privacyPolicy.textSha256, /^[0-9a-f]{64}$/);
  return row;
}

test("cliente privato: invio, OTP via email, firma, PDF, notifiche dal mittente dell'azienda", async () => {
  const seller = new Agent(app.baseUrl, freshIp());
  await seller.login(A.sellerUsername, TEST_PASSWORD);
  const email = `${tag}-privato@example.invalid`;
  const contract = await createAndSend(seller, A, {
    tipo_cliente: "privato", societa: "Mario Rossi", email, cellulare: "3331234567",
    sede: "Roma", indirizzo: "Via Roma 1", p_iva: "RSSMRA80A01H501U",
  });
  const invite = (await sink.waitFor(email))[0];
  assert.equal(invite.mailFrom, A.fromAddress);
  assert.match(fromHeader(invite), new RegExp(`${tag} A`));
  assert.ok(invite.text.includes(`/client/${contract.contractCode}`), "link al contratto nell'email");
  assert.ok(contract.contractNumber && invite.text.includes(contract.contractNumber), "numero del contratto nell'email");

  await signFlow(contract, A, email);

  // Il contratto firmato non si firma due volte.
  const again = await new Agent(app.baseUrl, freshIp()).post(`/api/client/contracts/${contract.contractCode}/sign`, {
    otpCode: "000000", consents: { privacy: true }, signatures: {},
  });
  assert.equal(again.status, 400);
});

test("cliente azienda (azienda B): mittente e numerazione separati da A", async () => {
  const seller = new Agent(app.baseUrl, freshIp());
  await seller.login(B.sellerUsername, TEST_PASSWORD);
  const email = `${tag}-azienda@example.invalid`;
  const contract = await createAndSend(seller, B, {
    tipo_cliente: "azienda", societa: "Rossi Srl", cliente_nome: "Mario Rossi", email,
    sede: "Milano", indirizzo: "Via Milano 2", p_iva: "01234567890",
  });
  const invite = (await sink.waitFor(email))[0];
  assert.equal(invite.mailFrom, B.fromAddress);
  const row = await signFlow(contract, B, email);
  assert.match(row.contract_number, /-0001$/, "la numerazione di B parte da 1 indipendentemente da A");
});

test("il cliente compila i propri dati: OTP bloccato finché mancano, poi firma", async () => {
  const seller = new Agent(app.baseUrl, freshIp());
  await seller.login(A.sellerUsername, TEST_PASSWORD);
  const email = `${tag}-compila@example.invalid`;
  const contract = await createAndSend(seller, A, { email }, { fillMode: "client_fill" });
  const { rows: [c] } = await pool.query(`SELECT status FROM contracts WHERE id = $1`, [contract.id]);
  assert.equal(c.status, "awaiting_client_data");

  const client = new Agent(app.baseUrl, freshIp());
  const early = await client.post(`/api/client/contracts/${contract.contractCode}/send-otp`, {});
  assert.equal(early.status, 400);
  assert.equal(early.json.code, "CLIENT_DATA_INCOMPLETE");

  const fill = await client.post(`/api/client/contracts/${contract.contractCode}/client-data`, {
    clientData: {
      tipo_cliente: "privato", societa: "Luca Bianchi", sede: "Torino", indirizzo: "Via Po 3", p_iva: "BNCLCU85B02L219X",
      email, cellulare: "3339876543", nato_a: "Torino", data_nascita: "1985-02-02", residente_a: "Torino",
      indirizzo_residenza: "Via Po 3",
    },
  });
  assert.equal(fill.status, 200, fill.text);
  const { rows: [after] } = await pool.query(`SELECT generated_content FROM contracts WHERE id = $1`, [contract.id]);
  assert.ok(after.generated_content.includes("Luca Bianchi"), "il testo si aggiorna con i dati del cliente");

  await signFlow(contract, A, email);
});

test("il cliente compila: un campo facoltativo usato nel testo blocca l'OTP finché manca", async () => {
  const { storage } = await import("../server/storage");
  const tpl = await storage.createTemplate({
    name: `${tag} A con pec`, content: "<p>{{societa}} - PEC: {{pec}}</p>", createdBy: A.adminId,
  } as any);
  const seller = new Agent(app.baseUrl, freshIp());
  await seller.login(A.sellerUsername, TEST_PASSWORD);
  const email = `${tag}-pec@example.invalid`;
  const contract = await createAndSend(seller, { ...A, templateId: tpl.id }, { email, tipo_cliente: "privato" }, { fillMode: "client_fill" });

  const client = new Agent(app.baseUrl, freshIp());
  const base = {
    tipo_cliente: "privato", societa: "Anna Verdi", sede: "Roma", indirizzo: "Via Appia 4", p_iva: "VRDNNA90C41H501Z",
    email, cellulare: "3331112222", nato_a: "Roma", data_nascita: "1990-03-01", residente_a: "Roma", indirizzo_residenza: "Via Appia 4",
  };
  assert.equal((await client.post(`/api/client/contracts/${contract.contractCode}/client-data`, { clientData: base })).status, 200);
  const blocked = await client.post(`/api/client/contracts/${contract.contractCode}/send-otp`, {});
  assert.equal(blocked.status, 400);
  assert.equal(blocked.json.code, "CLIENT_DATA_INCOMPLETE");
  assert.deepEqual(blocked.json.missingFields.map((f: any) => f.key), ["pec"]);

  assert.equal((await client.post(`/api/client/contracts/${contract.contractCode}/client-data`, { clientData: { ...base, pec: "anna@pec.it" } })).status, 200);
  assert.equal((await client.post(`/api/client/contracts/${contract.contractCode}/send-otp`, {})).status, 200);
});
