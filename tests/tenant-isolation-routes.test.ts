// Isolamento tra aziende a livello di ROTTA HTTP (task 001, Fase D): un
// utente dell'azienda B non può leggere, modificare, eliminare, archiviare o
// scaricare template/contratti/PDF/impostazioni/utenti dell'azienda A; il
// venditore vede solo i propri contratti. Ogni tentativo deve fallire E
// lasciare i dati di A invariati.
// Gira sul DB collegato con aziende di prova che alla fine vengono rimosse.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { startTestApp, Agent, type TestApp } from "./helpers/http-app";
import { createTenant, cleanupTenants, TEST_PASSWORD, type TestTenant } from "./helpers/tenants";

const tag = `isoroute-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let app: TestApp;
let A: TestTenant;
let B: TestTenant;
let contractA = 0; // del venditore di A
let contractAdminA = 0; // dell'admin di A
let presetA = 0;
let adminB: Agent;
let sellerB: Agent;
let sellerA: Agent;

async function makeContract(sellerId: number, templateId: number, n: string) {
  const c = await storage.createContract({
    templateId, sellerId,
    clientData: { tipo_cliente: "privato", societa: "Cliente di A", email: `${tag}-${n}@example.invalid` },
    generatedContent: "<p>Contratto riservato di A</p>",
    contractCode: `${tag}-${n}`,
  } as any);
  return c.id;
}

async function snapshotA() {
  const { rows: [t] } = await pool.query(`SELECT name, content FROM contract_templates WHERE id = $1`, [A.templateId]);
  const { rows: contracts } = await pool.query(
    `SELECT id, status, is_archived, generated_content, client_data::text AS cd FROM contracts WHERE id = ANY($1::int[]) ORDER BY id`,
    [[contractA, contractAdminA]]);
  const { rows: [c] } = await pool.query(`SELECT company_name, smtp_host, privacy_policy_text FROM company_settings WHERE id = $1`, [A.companyId]);
  const { rows: users } = await pool.query(`SELECT id, is_active, role FROM public.users WHERE company_id = $1 ORDER BY id`, [A.companyId]);
  const { rows: presets } = await pool.query(`SELECT id, name FROM contract_presets WHERE id = $1`, [presetA]);
  return JSON.stringify({ t, contracts, c, users, presets });
}

before(async () => {
  app = await startTestApp();
  A = await createTenant(tag, "A");
  B = await createTenant(tag, "B");
  contractA = await makeContract(A.sellerId, A.templateId, "a1");
  contractAdminA = await makeContract(A.adminId, A.templateId, "a2");
  const p = await storage.createContractPreset({
    name: `${tag} preset A`, createdBy: A.adminId, companyId: A.companyId, visibility: "shared",
  } as any);
  presetA = p.id;
  adminB = new Agent(app.baseUrl, "10.77.0.1");
  sellerB = new Agent(app.baseUrl, "10.77.0.2");
  sellerA = new Agent(app.baseUrl, "10.77.0.3");
  await adminB.login(B.adminUsername, TEST_PASSWORD);
  await sellerB.login(B.sellerUsername, TEST_PASSWORD);
  await sellerA.login(A.sellerUsername, TEST_PASSWORD);
});

after(async () => {
  try {
    await cleanupTenants([A?.companyId, B?.companyId].filter(Boolean) as number[]);
  } finally {
    await app.close();
    await pool.end();
  }
});

const denied = (status: number) => status >= 400 && status < 500;

test("liste: B non vede template, contratti, utenti, preset di A; impostazioni = le proprie", async () => {
  for (const agent of [adminB, sellerB]) {
    const templates = await agent.get("/api/templates");
    assert.equal(templates.status, 200);
    assert.ok(!templates.json.some((t: any) => t.id === A.templateId), "template di A non in lista");
    const contracts = await agent.get("/api/contracts");
    assert.equal(contracts.status, 200);
    const ids = (Array.isArray(contracts.json) ? contracts.json : contracts.json.contracts || []).map((c: any) => c.id);
    assert.ok(!ids.includes(contractA) && !ids.includes(contractAdminA), "contratti di A non in lista");
    const presets = await agent.get("/api/presets");
    if (presets.status === 200) assert.ok(!JSON.stringify(presets.json).includes(`${tag} preset A`));
  }
  const users = await adminB.get("/api/admin/users");
  assert.equal(users.status, 200);
  assert.ok(!users.json.some((u: any) => u.companyId === A.companyId || u.id === A.sellerId));
  const settings = await adminB.get("/api/company-settings");
  assert.equal(settings.status, 200);
  assert.equal(settings.json.companyName, `${tag} B`);
  assert.equal((await sellerB.get("/api/company-settings")).status, 403, "il venditore non legge le impostazioni");
});

test("letture dirette per id: tutte rifiutate", async () => {
  for (const agent of [adminB, sellerB]) {
    for (const path of [
      `/api/templates/${A.templateId}`,
      `/api/contracts/${contractA}`,
      `/api/contracts/${contractA}/timeline`,
      `/api/contracts/${contractA}/pdf`,
      `/api/presets/${presetA}`,
    ]) {
      const r = await agent.get(path);
      assert.ok(denied(r.status), `${path} → ${r.status}`);
      assert.ok(!r.text.includes("Contratto riservato di A"), `${path} non espone il testo`);
    }
  }
});

test("scritture su risorse di A: tutte rifiutate e dati di A invariati", async () => {
  const before = await snapshotA();
  const attempts: Array<[string, string, any?]> = [
    ["PUT", `/api/templates/${A.templateId}`, { name: "rubato", content: "<p>x</p>" }],
    ["DELETE", `/api/templates/${A.templateId}`],
    ["PUT", `/api/contracts/${contractA}`, { clientData: { societa: "rubato" }, templateId: A.templateId }],
    ["PATCH", `/api/contracts/${contractA}/content`, { generatedContent: "<p>rubato</p>" }],
    ["POST", `/api/contracts/${contractA}/archive`],
    ["POST", `/api/contracts/${contractA}/unarchive`],
    ["POST", `/api/contracts/${contractA}/duplicate`],
    ["POST", `/api/contracts/${contractA}/regenerate-content`],
    ["POST", `/api/contracts/${contractA}/regenerate-pdf`],
    ["PUT", `/api/presets/${presetA}`, { name: "rubato" }],
    ["DELETE", `/api/presets/${presetA}`],
    ["PATCH", `/api/admin/users/${A.sellerId}/status`, { isActive: false }],
    ["POST", "/api/contracts/preview", { templateId: A.templateId, clientData: { societa: "x", email: "x@example.invalid" } }],
    ["POST", "/api/contracts", { templateId: A.templateId, clientData: { societa: "x", email: "x@example.invalid" } }],
    ["POST", "/api/co-fill/sessions", { contractId: contractA }],
    ["POST", "/api/co-fill/sessions", { templateId: A.templateId }],
  ];
  for (const agent of [adminB, sellerB]) {
    for (const [method, path, body] of attempts) {
      const r = await agent.request(method, path, body ?? {});
      assert.ok(denied(r.status), `${method} ${path} → ${r.status} ${r.text.slice(0, 120)}`);
    }
  }
  // Operazioni in blocco: rispondono, ma non toccano gli id di altre aziende.
  await adminB.post("/api/contracts/bulk-archive", { ids: [contractA, contractAdminA], archive: true });
  await adminB.post("/api/contracts/bulk-delete", { ids: [contractA, contractAdminA] });
  await sellerB.post("/api/contracts/bulk-archive", { ids: [contractA], archive: true });
  await adminB.put("/api/company-settings", { companyName: `${tag} B`, address: "Via B", city: "Roma", postalCode: "00100", taxId: "X", vatId: "Y", uniqueCode: "0000000", pec: "b@pec.invalid", id: A.companyId });

  assert.equal(await snapshotA(), before, "nessun dato di A modificato");
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM contracts WHERE template_id = $1`, [A.templateId]);
  assert.equal(rows[0].n, 2, "nessun contratto creato/duplicato sul template di A");
});

test("venditore: vede e apre solo i propri contratti, non quelli dell'admin della stessa azienda", async () => {
  const list = await sellerA.get("/api/contracts");
  const ids = (Array.isArray(list.json) ? list.json : list.json.contracts || []).map((c: any) => c.id);
  assert.ok(ids.includes(contractA));
  assert.ok(!ids.includes(contractAdminA));
  assert.ok(denied((await sellerA.get(`/api/contracts/${contractAdminA}`)).status));
  assert.ok(denied((await sellerA.get(`/api/contracts/${contractAdminA}/pdf`)).status));
  assert.ok(denied((await sellerA.request("PUT", `/api/contracts/${contractAdminA}`, { clientData: { societa: "x" } })).status));
  assert.equal((await sellerA.get(`/api/contracts/${contractA}`)).status, 200);
  for (const path of ["/api/admin/users", "/api/company-settings"]) {
    assert.equal((await sellerA.get(path)).status, 403, path);
  }
});

test("utente disattivato: la sessione aperta decade", async () => {
  const adminA = new Agent(app.baseUrl, "10.77.0.4");
  await adminA.login(A.adminUsername, TEST_PASSWORD);
  const victim = new Agent(app.baseUrl, "10.77.0.5");
  await victim.login(B.sellerUsername, TEST_PASSWORD);
  const adminBAgain = new Agent(app.baseUrl, "10.77.0.6");
  await adminBAgain.login(B.adminUsername, TEST_PASSWORD);
  const r = await adminBAgain.patch(`/api/admin/users/${B.sellerId}/status`, { isActive: false });
  assert.equal(r.status, 200, r.text);
  try {
    assert.equal((await victim.get("/api/contracts")).status, 401);
    assert.equal((await victim.post("/api/login", { username: B.sellerUsername, password: TEST_PASSWORD })).status, 401);
  } finally {
    await pool.query(`UPDATE public.users SET is_active = true WHERE id = $1`, [B.sellerId]);
  }
});
