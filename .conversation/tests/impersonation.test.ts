// "Entra come venditore": l'admin usa l'account di un venditore della sua
// azienda e torna al proprio. Mai venditori di altre aziende, mai altri admin.
// Gira sul DB collegato con aziende di prova che alla fine vengono rimosse.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../server/db";
import { startTestApp, Agent, type TestApp } from "./helpers/http-app";
import { createTenant, cleanupTenants, TEST_PASSWORD, type TestTenant } from "./helpers/tenants";

const tag = `imptest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let app: TestApp;
let A: TestTenant;
let B: TestTenant;
let ip = 20;
const agent = () => new Agent(app.baseUrl, `10.98.${Math.floor(Math.random() * 200)}.${ip++}`);

before(async () => {
  app = await startTestApp();
  A = await createTenant(tag, "A");
  B = await createTenant(tag, "B");
});

after(async () => {
  try {
    await cleanupTenants([A?.companyId, B?.companyId].filter(Boolean) as number[]);
  } finally {
    await app.close();
    await pool.end();
  }
});

test("l'admin entra come venditore e torna al suo account", async () => {
  // Il venditore ha ancora la password temporanea: l'admin non deve cambiarla.
  await pool.query(`UPDATE public.users SET must_change_password = true WHERE id = $1`, [A.sellerId]);
  try {
    const admin = agent();
    await admin.login(A.adminUsername, TEST_PASSWORD);

    const enter = await admin.post(`/api/admin/impersonate/${A.sellerId}`);
    assert.equal(enter.status, 200, enter.text);
    assert.equal(enter.json.id, A.sellerId);
    assert.equal(enter.json.role, "seller");
    assert.equal(enter.json.impersonator.id, A.adminId);
    assert.equal(enter.json.password, undefined);

    const me = await admin.get("/api/user");
    assert.equal(me.json.id, A.sellerId);
    assert.equal(me.json.impersonator.id, A.adminId);
    assert.equal((await admin.get("/api/contracts")).status, 200, "le schermate del venditore funzionano");
    assert.equal((await admin.get("/api/admin/users")).status, 403, "da venditore niente funzioni admin");
    assert.equal((await admin.post(`/api/admin/impersonate/${A.sellerId}`)).status, 403, "niente cambi annidati");

    const back = await admin.post("/api/admin/stop-impersonation");
    assert.equal(back.status, 200, back.text);
    assert.equal(back.json.id, A.adminId);
    assert.equal(back.json.impersonator, null);
    const me2 = await admin.get("/api/user");
    assert.equal(me2.json.id, A.adminId);
    assert.equal(me2.json.impersonator, null);
    assert.equal((await admin.get("/api/admin/users")).status, 200);

    // Il venditore che entra da solo deve invece cambiare la password.
    const seller = agent();
    await seller.login(A.sellerUsername, TEST_PASSWORD);
    assert.equal((await seller.get("/api/contracts")).status, 403);
  } finally {
    await pool.query(`UPDATE public.users SET must_change_password = false WHERE id = $1`, [A.sellerId]);
  }
});

test("mai venditori di altre aziende, admin, venditori disattivati; mai da venditore", async () => {
  const admin = agent();
  await admin.login(A.adminUsername, TEST_PASSWORD);
  assert.equal((await admin.post(`/api/admin/impersonate/${B.sellerId}`)).status, 404, "venditore di un'altra azienda");
  assert.equal((await admin.post(`/api/admin/impersonate/${A.adminId}`)).status, 404, "un admin");
  assert.equal((await admin.post(`/api/admin/impersonate/abc`)).status, 404);

  await pool.query(`UPDATE public.users SET is_active = false WHERE id = $1`, [A.sellerId]);
  try {
    assert.equal((await admin.post(`/api/admin/impersonate/${A.sellerId}`)).status, 400, "venditore disattivato");
  } finally {
    await pool.query(`UPDATE public.users SET is_active = true WHERE id = $1`, [A.sellerId]);
  }
  assert.equal((await admin.get("/api/user")).json.id, A.adminId, "dopo i rifiuti resta l'admin");

  const seller = agent();
  await seller.login(A.sellerUsername, TEST_PASSWORD);
  assert.equal((await seller.post(`/api/admin/impersonate/${A.sellerId}`)).status, 403);
  assert.equal((await seller.post("/api/admin/stop-impersonation")).status, 400);

  const anon = agent();
  assert.equal((await anon.post(`/api/admin/impersonate/${A.sellerId}`)).status, 403);
});

test("admin disattivato mentre usa il venditore: la sessione si chiude", async () => {
  const admin = agent();
  await admin.login(A.adminUsername, TEST_PASSWORD);
  assert.equal((await admin.post(`/api/admin/impersonate/${A.sellerId}`)).status, 200);
  await pool.query(`UPDATE public.users SET is_active = false WHERE id = $1`, [A.adminId]);
  try {
    assert.equal((await admin.get("/api/contracts")).status, 401, "nessun dato del venditore");
    assert.equal((await admin.get("/api/user")).status, 401, "sessione chiusa");
  } finally {
    await pool.query(`UPDATE public.users SET is_active = true WHERE id = $1`, [A.adminId]);
  }
});

test("uscire mentre si usa il venditore chiude tutta la sessione", async () => {
  const admin = agent();
  await admin.login(A.adminUsername, TEST_PASSWORD);
  assert.equal((await admin.post(`/api/admin/impersonate/${A.sellerId}`)).status, 200);
  assert.equal((await admin.post("/api/logout")).status, 200);
  assert.equal((await admin.get("/api/user")).status, 401);
});
