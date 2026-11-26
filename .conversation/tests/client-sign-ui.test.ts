// Firma vera nel browser (Chromium headless) sulla pagina del cliente:
// firma nel documento, eventuale seconda firma per le clausole (artt.
// 1341-1342), codice via email, privacy, "Firma il contratto". I test a
// livello di rotta passano le firme a mano e non vedono gli errori della
// pagina: qui si usa la pagina com'è, e nessuna chiamata deve fallire.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { pool } from "../server/db";
import { startTestApp, Agent, type TestApp } from "./helpers/http-app";
import { SmtpSink } from "./helpers/smtp-sink";
import { createTenant, cleanupTenants, TEST_PASSWORD, type TestTenant } from "./helpers/tenants";

const tag = `uisign-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const sink = new SmtpSink();
let app: TestApp;
let A: TestTenant;
let browser: Browser;
let ipCounter = 10;
// UI_SHOTS=<cartella>: salva le schermate del pannello firma (controllo visivo).
async function shot(page: Page, name: string) {
  if (!process.env.UI_SHOTS) return;
  const panel = await page.$('[data-testid="signing-panel"]');
  await panel?.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${process.env.UI_SHOTS}/${name}.png` });
}
// La pagina accompagna il cliente scorrendo da sola al passaggio successivo:
// prima di cliccare si aspetta che lo scorrimento sia finito.
const settle = (ms = 1000) => new Promise((r) => setTimeout(r, ms));
const freshIp = () => `10.98.${Math.floor(Math.random() * 200)}.${ipCounter++}`;

const APPROVAL_TEMPLATE = [
  "<h2>Contratto di prova</h2><p>Cliente: {{societa}} - {{email}}</p>",
  "<p>4.7 Clausola di prova. 9.3 Foro di prova.</p>",
  "<!-- APPROVAZIONE_SPECIFICA --><p>Approvo specificamente le clausole 4.7 e 9.3.</p><!-- /APPROVAZIONE_SPECIFICA -->",
].join("\n");

before(async () => {
  await sink.start();
  app = await startTestApp({ frontend: true });
  A = await createTenant(tag, "A", { smtpPort: sink.port, templateContent: APPROVAL_TEMPLATE });
  const { resolveChromiumPath } = await import("../server/services/pdf-generator-new");
  browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveChromiumPath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
});

after(async () => {
  try {
    await browser?.close();
    await cleanupTenants([A?.companyId].filter(Boolean) as number[]);
  } finally {
    await app.close();
    await sink.stop();
    const { closePdfBrowser } = await import("../server/services/pdf-generator-new");
    await closePdfBrowser().catch(() => {});
    await pool.end();
  }
});

async function createAndSend(templateId: number, email: string) {
  const seller = new Agent(app.baseUrl, freshIp());
  await seller.login(A.sellerUsername, TEST_PASSWORD);
  const payload = {
    templateId,
    sendToEmail: email,
    clientData: {
      tipo_cliente: "azienda", societa: "Firma Prova Srl", cliente_nome: "Paola Neri", email,
      sede: "Napoli", indirizzo: "Via Toledo 5", p_iva: "09876543210",
    },
  };
  const preview = await seller.post("/api/contracts/preview", payload);
  assert.equal(preview.status, 200, preview.text);
  const created = await seller.post("/api/contracts", { ...payload, sendImmediately: true, previewToken: preview.json.previewToken });
  assert.equal(created.status, 201, created.text);
  return created.json as { id: number; contractCode: string };
}

async function clickByText(page: Page, selector: string, text: string) {
  const ok = await page.evaluate((sel, t) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => e.innerText.trim() === t);
    el?.click();
    return !!el;
  }, selector, text);
  assert.ok(ok, `pulsante "${text}" trovato`);
}

/** Apre il riquadro firma, firma (disegno o nome scritto) e conferma. */
async function signArea(page: Page, id: string, mode: "draw" | "type") {
  const area = await page.waitForSelector(`[data-signature-area="${id}"]`, { visible: true });
  await area!.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await area!.click();
  await page.waitForSelector("canvas", { visible: true });
  if (mode === "draw") {
    const box = (await (await page.$("canvas"))!.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + box.height / 2 + (i % 2 ? 15 : -15));
    await page.mouse.up();
  } else {
    await clickByText(page, "button", "Scrivi");
    await page.type('input[placeholder="Scrivi il tuo nome completo..."]', "Paola Neri");
  }
  await clickByText(page, "button", "Conferma firma");
  const confirm = await page.waitForSelector(`[data-testid="button-confirm-signature-${id}"]`, { visible: true });
  await confirm!.click();
  await page.waitForSelector(`[data-signature-area="${id}"][data-signed="true"]`);
}

async function openClientPage(code: string, email: string, viewport: { width: number; height: number }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": freshIp() });
  const failures: string[] = [];
  page.on("response", (r) => {
    // /api/user risponde 401 per chi non è loggato (il cliente): è previsto.
    if (r.url().includes("/api/") && !r.url().endsWith("/api/user") && r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
  await page.goto(`${app.baseUrl}/client/${code}?email=${encodeURIComponent(email)}`, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector('[data-testid="signing-panel"]', { timeout: 60_000 });
  return { page, failures };
}

async function finishSigning(page: Page, contractId: number) {
  const step = async (id: string) => page.$eval(`[data-testid="${id}"]`, (e) => e.getAttribute("data-state"));
  assert.equal(await step("sign-step-document"), "done");
  assert.equal(await step("sign-step-otp"), "current");
  await settle();

  await (await page.waitForSelector('[data-testid="button-send-otp"]', { visible: true }))!.click();
  await page.waitForSelector("input[data-input-otp]", { timeout: 20_000 });
  const { rows } = await pool.query(
    `SELECT code FROM otp_codes WHERE contract_id = $1 AND is_used = false ORDER BY id DESC LIMIT 1`, [contractId]);
  assert.ok(rows[0], "codice creato");
  await page.focus("input[data-input-otp]");
  await page.keyboard.type(rows[0].code);
  await settle();
  await shot(page, `${contractId}-codice`);
  assert.equal(await step("sign-step-confirm"), "current");

  const signBtn = '[data-testid="button-sign-contract"]';
  assert.equal(await page.$eval(signBtn, (b) => (b as HTMLButtonElement).disabled), true, "senza privacy non si firma");
  await page.click('[data-testid="checkbox-privacy"]');
  await page.waitForFunction((s) => !(document.querySelector(s) as HTMLButtonElement)?.disabled, {}, signBtn);
  // La schermata "Stiamo registrando la tua firma" deve comparire durante
  // l'attesa (sessionStorage sopravvive al passaggio alla pagina di conferma).
  await page.evaluate(() => {
    sessionStorage.removeItem("sawSigningOverlay");
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="signing-progress-overlay"]')) sessionStorage.setItem("sawSigningOverlay", "1");
    }).observe(document.body, { childList: true, subtree: true });
  });
  await Promise.all([
    page.waitForNavigation({ timeout: 90_000 }).catch(() => null),
    page.click(signBtn),
    process.env.UI_SHOTS
      ? page.waitForSelector('[data-testid="signing-progress-overlay"]', { timeout: 5000 })
          .then(() => settle(1500))
          .then(() => page.screenshot({ path: `${process.env.UI_SHOTS}/${contractId}-attesa.png` }))
          .catch(() => null)
      : null,
  ]);
  for (let i = 0; i < 60; i++) {
    const { rows: [r] } = await pool.query(`SELECT status FROM contracts WHERE id = $1`, [contractId]);
    if (r.status === "signed") break;
    await new Promise((res) => setTimeout(res, 500));
  }
  const { rows: [done] } = await pool.query(`SELECT status, signatures FROM contracts WHERE id = $1`, [contractId]);
  assert.equal(done.status, "signed");
  await page.waitForSelector('[data-testid="signed-confirmation"]', { timeout: 30_000 });
  assert.equal(await page.evaluate(() => sessionStorage.getItem("sawSigningOverlay")), "1", "attesa della firma mostrata");
  if (process.env.UI_SHOTS) {
    await settle(1800);
    await page.screenshot({ path: `${process.env.UI_SHOTS}/${contractId}-confermato.png` });
  }
  return done.signatures as Record<string, string>;
}

test("pagina cliente: contratto con approvazione specifica, due firme distinte, codice email, firma", async () => {
  const email = `${tag}-clausole@example.invalid`;
  const contract = await createAndSend(A.templateId, email);
  const { page, failures } = await openClientPage(contract.contractCode, email, { width: 1280, height: 900 });

  assert.ok(await page.$('[data-signature-area="clausole"]'), "riquadro per la firma delle clausole presente");
  await shot(page, "1-da-firmare");
  await signArea(page, "marketing", "draw");
  // Con una sola firma il codice non si può ancora chiedere.
  assert.equal(await page.$eval('[data-testid="sign-step-otp"]', (e) => e.getAttribute("data-state")), "upcoming");
  assert.equal(await page.$('[data-testid="button-send-otp"]'), null);
  await signArea(page, "clausole", "type");

  const signatures = await finishSigning(page, contract.id);
  assert.match(signatures.marketing, /^data:image\/png;base64,/);
  assert.equal(signatures.clausole, "Paola Neri");
  const { rows: audit } = await pool.query(`SELECT metadata FROM audit_logs WHERE contract_id = $1 AND action = 'signed'`, [contract.id]);
  assert.equal(audit[0].metadata.specificApproval, true);
  assert.deepEqual(failures, [], "nessuna chiamata fallita nella pagina");
  await page.close();
});

test("pagina cliente (telefono): contratto senza clausole, una firma sola", async () => {
  const { storage } = await import("../server/storage");
  const tpl = await storage.createTemplate({
    name: `${tag} semplice`,
    content: "<h2>Contratto semplice</h2><p>Cliente: {{societa}} - {{email}}</p>",
    createdBy: A.adminId,
  } as any);
  const email = `${tag}-semplice@example.invalid`;
  const contract = await createAndSend(tpl.id, email);
  const { page, failures } = await openClientPage(contract.contractCode, email, { width: 390, height: 844 });

  assert.equal(await page.$('[data-signature-area="clausole"]'), null, "nessuna seconda firma");
  await signArea(page, "marketing", "type");
  await shot(page, "2-telefono-firmato-documento");
  const signatures = await finishSigning(page, contract.id);
  assert.equal(signatures.marketing, "Paola Neri");
  assert.deepEqual(failures, [], "nessuna chiamata fallita nella pagina");
  await page.close();
});
