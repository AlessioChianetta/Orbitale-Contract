// Accesso automatico dall'altro software (lasciapassare firmato, una volta
// sola, cookie valido nel riquadro, niente cambio password, niente richieste
// da altri siti). Gira sul DB collegato con aziende di prova poi rimosse.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { pool } from "../server/db";
import { createSsoToken, verifySsoToken } from "../server/embed-sso";
import { startTestApp, Agent, type TestApp } from "./helpers/http-app";
import { createTenant, cleanupTenants, type TestTenant } from "./helpers/tenants";

const SECRET = "test-embed-secret-0123456789abcdef0123456789";
const tag = `ssotest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let app: TestApp;
let A: TestTenant;
let ip = 30;
const now = () => Math.floor(Date.now() / 1000);
const browser = () => new Agent(app.baseUrl, `10.97.${Math.floor(Math.random() * 200)}.${ip++}`, {
  "x-forwarded-proto": "https", "sec-fetch-site": "same-origin",
});
const token = (email: string, extra: Partial<{ exp: number; nonce: string }> = {}, secret = SECRET) =>
  createSsoToken({ email, exp: now() + 60, nonce: randomUUID(), ...extra }, secret);

before(async () => {
  process.env.EMBED_SSO_SECRET = SECRET;
  app = await startTestApp();
  A = await createTenant(tag, "A");
});

after(async () => {
  try {
    await cleanupTenants([A?.companyId].filter(Boolean) as number[]);
  } finally {
    await app.close();
    await pool.end();
  }
});

test("verifica del lasciapassare", () => {
  const t = token("a@b.it");
  assert.equal(verifySsoToken(t, SECRET).ok, true);
  assert.equal(verifySsoToken(t, SECRET + "x").ok, false, "chiave diversa");
  const [v, p, s] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ email: "altro@b.it", exp: now() + 60, nonce: randomUUID() })).toString("base64url");
  assert.equal(verifySsoToken(`${v}.${forged}.${s}`, SECRET).ok, false, "email cambiata");
  assert.equal(verifySsoToken(token("a@b.it", { exp: now() - 1 }), SECRET).ok, false, "scaduto");
  assert.equal(verifySsoToken(token("a@b.it", { exp: now() + 3600 }), SECRET).ok, false, "troppo lungo");
  assert.equal(verifySsoToken(`${v}.${p}`, SECRET).ok, false);
  assert.equal(verifySsoToken("", SECRET).ok, false);
});

test("entra in automatico con l'email, una volta sola, senza cambio password", async () => {
  const { rows: [admin] } = await pool.query(`SELECT email FROM public.users WHERE id = $1`, [A.adminId]);
  await pool.query(`UPDATE public.users SET must_change_password = true WHERE id = $1`, [A.adminId]);
  try {
    const b = browser();
    const t = token(admin.email.toUpperCase());
    const r = await b.get(`/sso?token=${encodeURIComponent(t)}`);
    assert.equal(r.status, 302, r.text);
    assert.equal(r.headers.get("location"), "/admin");
    const cookie = r.headers.get("set-cookie") || "";
    assert.match(cookie, /SameSite=None/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /Partitioned/i);

    const me = await b.get("/api/user");
    assert.equal(me.json.id, A.adminId);
    assert.equal(me.json.embedded, true);
    assert.equal((await b.get("/api/admin/users")).status, 200, "nessun blocco password temporanea");

    // "Entra come venditore" e ritorno restano nel riquadro.
    const enter = await b.post(`/api/admin/impersonate/${A.sellerId}`);
    assert.equal(enter.status, 200, enter.text);
    assert.match(enter.headers.get("set-cookie") || "", /SameSite=None/i);
    assert.equal((await b.get("/api/user")).json.embedded, true);
    const back = await b.post("/api/admin/stop-impersonation");
    assert.equal(back.status, 200);
    assert.match(back.headers.get("set-cookie") || "", /SameSite=None/i);

    // Stesso lasciapassare una seconda volta: rifiutato.
    const again = await browser().get(`/sso?token=${encodeURIComponent(t)}`);
    assert.equal(again.status, 401);

    // Richiesta che modifica dati partita da un altro sito: rifiutata.
    b.headers["sec-fetch-site"] = "cross-site";
    assert.equal((await b.post(`/api/admin/impersonate/${A.sellerId}`)).status, 403);
    assert.equal((await b.get("/api/user")).status, 200, "le letture restano possibili");
  } finally {
    await pool.query(`UPDATE public.users SET must_change_password = false WHERE id = $1`, [A.adminId]);
  }
});

test("venditore → /seller; next solo interno; rifiuti", async () => {
  const { rows: [seller] } = await pool.query(`SELECT email FROM public.users WHERE id = $1`, [A.sellerId]);
  const r = await browser().get(`/sso?token=${encodeURIComponent(token(seller.email))}`);
  assert.equal(r.headers.get("location"), "/seller");
  const n = await browser().get(`/sso?token=${encodeURIComponent(token(seller.email))}&next=${encodeURIComponent("/seller?x=1")}`);
  assert.equal(n.headers.get("location"), "/seller?x=1");
  const evil = await browser().get(`/sso?token=${encodeURIComponent(token(seller.email))}&next=${encodeURIComponent("//evil.example")}`);
  assert.equal(evil.headers.get("location"), "/seller");

  assert.equal((await browser().get(`/sso?token=${encodeURIComponent(token("nessuno@example.invalid"))}`)).status, 403);
  assert.equal((await browser().get(`/sso?token=${encodeURIComponent(token(seller.email, {}, "chiave-sbagliata-0123456789abcdef0123"))}`)).status, 401);

  await pool.query(`UPDATE public.users SET is_active = false WHERE id = $1`, [A.sellerId]);
  try {
    assert.equal((await browser().get(`/sso?token=${encodeURIComponent(token(seller.email))}`)).status, 403, "account disattivato");
  } finally {
    await pool.query(`UPDATE public.users SET is_active = true WHERE id = $1`, [A.sellerId]);
  }

  // Senza https (proxy mal configurato) il cookie del riquadro non funzionerebbe.
  const plain = new Agent(app.baseUrl, `10.97.250.${ip++}`);
  assert.equal((await plain.get(`/sso?token=${encodeURIComponent(token(seller.email))}`)).status, 400);
});

test("login normale: cookie invariato (non utilizzabile da altri siti)", async () => {
  const b = browser();
  const r = await b.post("/api/login", { username: A.adminUsername, password: (await import("./helpers/tenants")).TEST_PASSWORD });
  assert.equal(r.status, 200);
  assert.doesNotMatch(r.headers.get("set-cookie") || "", /SameSite=None/i);
  assert.equal((await b.get("/api/user")).json.embedded, false);
});
