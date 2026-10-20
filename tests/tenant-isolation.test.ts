// Isolamento tra aziende a livello di storage (task 001, Fase A).
// Gira sul DB collegato (dati reali): crea due aziende di prova con i loro
// utenti e template, e alla fine cancella tutto ciò che ha creato.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { ensureTenantSchema } from "../server/tenant-schema";

const tag = `isotest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const created = { companies: [] as number[], users: [] as number[], templates: [] as number[] };
let A: { company: number; admin: number; seller: number; template: number };
let B: { company: number; admin: number };

async function makeCompany(name: string) {
  const c = await storage.createCompany({
    companyName: `${tag} ${name}`,
    address: "Via Prova 1",
    city: "Roma",
    postalCode: "00100",
    taxId: "PRVTST00A00H501X",
    vatId: "00000000000",
    uniqueCode: "0000000",
    pec: "prova@pec.invalid",
  });
  created.companies.push(c.id);
  return c.id;
}

async function makeUser(companyId: number, suffix: string, role: "admin" | "seller") {
  const u = await storage.createUser({
    username: `${tag}-${suffix}`,
    password: "x.y",
    email: `${tag}-${suffix}@example.invalid`,
    fullName: `Prova ${suffix}`,
    role,
    companyId,
  });
  created.users.push(u.id);
  return u.id;
}

before(async () => {
  await ensureTenantSchema();
  const companyA = await makeCompany("A");
  const companyB = await makeCompany("B");
  const adminA = await makeUser(companyA, "admin-a", "admin");
  const sellerA = await makeUser(companyA, "seller-a", "seller");
  const adminB = await makeUser(companyB, "admin-b", "admin");
  const tpl = await storage.createTemplate({
    name: `${tag} template A`,
    content: "<p>Contratto A</p>",
    createdBy: adminA,
  } as any);
  created.templates.push(tpl.id);
  A = { company: companyA, admin: adminA, seller: sellerA, template: tpl.id };
  B = { company: companyB, admin: adminB };
});

after(async () => {
  try {
    if (created.users.length) {
      await pool.query(
        `DELETE FROM contract_templates WHERE created_by = ANY($1::int[])`,
        [created.users],
      );
      await pool.query(`DELETE FROM public.users WHERE id = ANY($1::int[])`, [created.users]);
    }
    if (created.companies.length) {
      await pool.query(`DELETE FROM company_settings WHERE id = ANY($1::int[])`, [created.companies]);
    }
  } finally {
    await pool.end();
  }
});

test("un'azienda non può modificare né eliminare i template di un'altra", async () => {
  const updated = await storage.updateTemplate(A.template, B.company, { name: "manomesso" });
  assert.equal(updated, undefined);
  const deleted = await storage.deleteTemplate(A.template, B.company);
  assert.equal(deleted, false);
  const still = await storage.getTemplate(A.template, A.company);
  assert.equal(still?.name, `${tag} template A`);
});

test("la propria azienda può modificare il template; createdBy non si può spostare", async () => {
  const updated = await storage.updateTemplate(A.template, A.company, {
    name: `${tag} template A`,
    description: "aggiornato",
    createdBy: B.admin,
  } as any);
  assert.equal(updated?.description, "aggiornato");
  assert.equal(updated?.createdBy, A.admin);
});

test("le nuove aziende non ricevono i template del proprietario", async () => {
  const templatesB = await storage.getTemplates(B.company);
  assert.equal(templatesB.length, 0);
  const templatesA = await storage.getTemplates(A.company);
  assert.deepEqual(templatesA.map((t) => t.id), [A.template]);
  const settingsB = await storage.getCompanySettings(B.company);
  assert.equal(settingsB?.isOwner, false);
});

test("getCompanySettings senza azienda fallisce invece di usare la prima del DB", async () => {
  await assert.rejects(() => storage.getCompanySettings(undefined as any), /companyId mancante/);
  await assert.rejects(() => storage.getCompanySettings(0), /companyId mancante/);
});

test("disattivazione utenti: solo dentro la propria azienda, l'utente resta nel DB", async () => {
  assert.equal(await storage.setUserActive(A.seller, B.company, false), undefined);
  assert.equal((await storage.getUser(A.seller))?.isActive, true);

  const off = await storage.setUserActive(A.seller, A.company, false);
  assert.equal(off?.isActive, false);
  assert.ok(await storage.getUser(A.seller));

  const on = await storage.setUserActive(A.seller, A.company, true);
  assert.equal(on?.isActive, true);
});

test("una sola azienda proprietaria nel DB", async () => {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM company_settings WHERE is_owner`);
  assert.equal(rows[0].n, 1);
});
