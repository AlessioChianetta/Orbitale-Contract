// Password degli utenti (task 001, Fase C, punto 24): password temporanea
// da cambiare al primo accesso, cambio password, recupero via email.
// Gira sul DB collegato con un'azienda di prova che alla fine viene rimossa.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { hashPassword, hashResetToken } from "../server/password";
import { startTestApp, Agent, type TestApp } from "./helpers/http-app";

const tag = `pwdtest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const created = { companies: [] as number[], users: [] as number[] };
let app: TestApp;
let adminUsername = "";
let adminId = 0;

before(async () => {
  app = await startTestApp();
  const c = await storage.createCompany({
    companyName: `${tag} azienda`, address: "Via Prova 1", city: "Roma", postalCode: "00100",
    taxId: "PRVTST00A00H501X", vatId: "00000000000", uniqueCode: "0000000", pec: "prova@pec.invalid",
  });
  created.companies.push(c.id);
  adminUsername = `${tag}-admin`;
  const u = await storage.createUser({
    username: adminUsername, password: await hashPassword("password-admin-1"),
    email: `${tag}-admin@example.invalid`, fullName: "Admin Prova", role: "admin", companyId: c.id,
  });
  created.users.push(u.id);
  adminId = u.id;
});

after(async () => {
  try {
    if (created.users.length) {
      await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = ANY($1::int[])`, [created.users]);
      await pool.query(`DELETE FROM session WHERE (sess::jsonb -> 'passport' ->> 'user') = ANY($1::text[])`, [created.users.map(String)]);
      await pool.query(`DELETE FROM public.users WHERE id = ANY($1::int[])`, [created.users]);
    }
    if (created.companies.length) await pool.query(`DELETE FROM company_settings WHERE id = ANY($1::int[])`, [created.companies]);
  } finally {
    await app.close();
    await pool.end();
  }
});

test("utente creato dall'admin: password temporanea, rotte bloccate finché non la cambia", async () => {
  const admin = new Agent(app.baseUrl);
  await admin.login(adminUsername, "password-admin-1");

  const short = await admin.post("/api/admin/create-user", {
    username: `${tag}-sel`, password: "corta", email: `${tag}-sel@example.invalid`, fullName: "Venditore Prova", role: "seller",
  });
  assert.equal(short.status, 400, "password sotto gli 8 caratteri rifiutata");

  const r = await admin.post("/api/admin/create-user", {
    username: `${tag}-sel`, password: "temporanea-1", email: `${tag}-sel@example.invalid`, fullName: "Venditore Prova", role: "seller",
  });
  assert.equal(r.status, 201, r.text);
  created.users.push(r.json.id);
  assert.equal(r.json.mustChangePassword, true);
  assert.equal(r.json.password, undefined, "la password (hash) non esce mai");

  const seller = new Agent(app.baseUrl);
  const me = await seller.login(`${tag}-sel`, "temporanea-1");
  assert.equal(me.mustChangePassword, true);

  const blocked = await seller.get("/api/contracts");
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.code, "MUST_CHANGE_PASSWORD");
  assert.equal((await seller.get("/api/user")).status, 200, "il profilo resta leggibile");

  const wrong = await seller.post("/api/user/change-password", { currentPassword: "sbagliata", newPassword: "nuova-password-1" });
  assert.equal(wrong.status, 400);
  const same = await seller.post("/api/user/change-password", { currentPassword: "temporanea-1", newPassword: "temporanea-1" });
  assert.equal(same.status, 400);
  const tooShort = await seller.post("/api/user/change-password", { currentPassword: "temporanea-1", newPassword: "1234567" });
  assert.equal(tooShort.status, 400);

  const ok = await seller.post("/api/user/change-password", { currentPassword: "temporanea-1", newPassword: "nuova-password-1" });
  assert.equal(ok.status, 200, ok.text);
  const after = await seller.get("/api/user");
  assert.equal(after.json.mustChangePassword, false);
  assert.equal((await seller.get("/api/contracts")).status, 200, "dopo il cambio le rotte tornano accessibili");

  const again = new Agent(app.baseUrl);
  assert.equal((await again.post("/api/login", { username: `${tag}-sel`, password: "temporanea-1" })).status, 401);
  await again.login(`${tag}-sel`, "nuova-password-1");
});

test("cambio password: le altre sessioni dello stesso utente decadono, quella corrente resta", async () => {
  const pc = new Agent(app.baseUrl);
  const phone = new Agent(app.baseUrl);
  await pc.login(adminUsername, "password-admin-1");
  await phone.login(adminUsername, "password-admin-1");
  const r = await pc.post("/api/user/change-password", { currentPassword: "password-admin-1", newPassword: "password-admin-2" });
  assert.equal(r.status, 200, r.text);
  assert.equal((await pc.get("/api/user")).status, 200);
  assert.equal((await phone.get("/api/user")).status, 401);
});

test("recupero password: risposta identica per email esistenti e inesistenti, token salvato solo come hash", async () => {
  const anon = new Agent(app.baseUrl);
  const unknown = await anon.post("/api/password-reset/request", { email: `${tag}-nessuno@example.invalid` });
  const known = await anon.post("/api/password-reset/request", { email: `${tag}-ADMIN@example.invalid` });
  assert.equal(unknown.status, 200);
  assert.equal(known.status, 200);
  assert.deepEqual(unknown.json, known.json);

  // L'azienda di prova non ha SMTP: l'invio fallisce in silenzio, ma il token esiste.
  const { rows } = await pool.query(`SELECT token_hash, expires_at, used_at FROM password_reset_tokens WHERE user_id = $1`, [adminId]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);
  const minutes = (new Date(rows[0].expires_at).getTime() - Date.now()) / 60000;
  assert.ok(minutes > 55 && minutes <= 60, `scadenza circa 1 ora (${minutes})`);

  // Limite: massimo 3 richieste all'ora per utente.
  for (let i = 0; i < 4; i++) await anon.post("/api/password-reset/request", { email: `${tag}-admin@example.invalid` });
  const { rows: count } = await pool.query(`SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = $1`, [adminId]);
  assert.equal(count[0].n, 3);
});

test("recupero password: link monouso, scaduto rifiutato, sessioni chiuse, altri link invalidati", async () => {
  await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [adminId]);
  const mk = async (minutes: number) => {
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [adminId, hashResetToken(token), String(minutes)],
    );
    return token;
  };
  const expired = await mk(-1);
  const good = await mk(60);
  const other = await mk(60);

  const logged = new Agent(app.baseUrl);
  await logged.login(adminUsername, "password-admin-2");

  const anon = new Agent(app.baseUrl);
  assert.equal((await anon.post("/api/password-reset/confirm", { token: expired, newPassword: "password-admin-3" })).status, 400);
  assert.equal((await anon.post("/api/password-reset/confirm", { token: good, newPassword: "corta" })).status, 400);

  const ok = await anon.post("/api/password-reset/confirm", { token: good, newPassword: "password-admin-3" });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await anon.post("/api/password-reset/confirm", { token: good, newPassword: "password-admin-4" })).status, 400, "monouso");
  assert.equal((await anon.post("/api/password-reset/confirm", { token: other, newPassword: "password-admin-4" })).status, 400, "gli altri link decadono");

  assert.equal((await logged.get("/api/user")).status, 401, "le sessioni aperte si chiudono");
  await new Agent(app.baseUrl).login(adminUsername, "password-admin-3");
});

test("recupero password: utente disattivato non può reimpostarla", async () => {
  await pool.query(`UPDATE public.users SET is_active = false WHERE id = $1`, [adminId]);
  try {
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [adminId, hashResetToken(token)],
    );
    const r = await new Agent(app.baseUrl).post("/api/password-reset/confirm", { token, newPassword: "password-admin-9" });
    assert.equal(r.status, 400);
  } finally {
    await pool.query(`UPDATE public.users SET is_active = true WHERE id = $1`, [adminId]);
  }
});
