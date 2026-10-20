// Numerazione dei contratti per azienda e per anno (task 001, Fase B, punto 18).
// Gira sul DB collegato: crea due aziende di prova con i loro contratti e alla
// fine cancella tutto ciò che ha creato (contatori compresi).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { ensureTenantSchema } from "../server/tenant-schema";

const tag = `numtest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const created = { companies: [] as number[], users: [] as number[], templates: [] as number[], contracts: [] as number[] };
const year = Number(new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Europe/Rome" }).format(new Date()));
let sellerA = 0;
let sellerB = 0;
let templateA = 0;

async function makeCompanyWithSeller(name: string) {
  const c = await storage.createCompany({
    companyName: `${tag} ${name}`, address: "Via Prova 1", city: "Roma", postalCode: "00100",
    taxId: "PRVTST00A00H501X", vatId: "00000000000", uniqueCode: "0000000", pec: "prova@pec.invalid",
  });
  created.companies.push(c.id);
  const u = await storage.createUser({
    username: `${tag}-${name}`, password: "x.y", email: `${tag}-${name}@example.invalid`,
    fullName: `Prova ${name}`, role: "seller", companyId: c.id,
  });
  created.users.push(u.id);
  return u.id;
}

async function makeContract(sellerId: number, n: number) {
  const c = await storage.createContract({
    templateId: templateA,
    sellerId,
    clientData: { societa: "Cliente prova", email: "c@example.invalid" },
    generatedContent: "<p>Prova</p>",
    contractCode: `${tag}-${sellerId}-${n}`,
  } as any);
  created.contracts.push(c.id);
  return c;
}

before(async () => {
  await ensureTenantSchema();
  sellerA = await makeCompanyWithSeller("A");
  sellerB = await makeCompanyWithSeller("B");
  const tpl = await storage.createTemplate({ name: `${tag} tpl`, content: "<p>x</p>", createdBy: sellerA } as any);
  created.templates.push(tpl.id);
  templateA = tpl.id;
});

after(async () => {
  try {
    if (created.contracts.length) await pool.query(`DELETE FROM contracts WHERE id = ANY($1::int[])`, [created.contracts]);
    if (created.templates.length) await pool.query(`DELETE FROM contract_templates WHERE id = ANY($1::int[])`, [created.templates]);
    if (created.users.length) await pool.query(`DELETE FROM public.users WHERE id = ANY($1::int[])`, [created.users]);
    if (created.companies.length) {
      await pool.query(`DELETE FROM company_contract_counters WHERE company_id = ANY($1::int[])`, [created.companies]);
      await pool.query(`DELETE FROM company_settings WHERE id = ANY($1::int[])`, [created.companies]);
    }
  } finally {
    await pool.end();
  }
});

test("contratti creati insieme ricevono numeri distinti e consecutivi per azienda", async () => {
  const batch = await Promise.all([1, 2, 3, 4, 5].map((n) => makeContract(sellerA, n)));
  const numbers = batch.map((c) => c.contractNumber).sort();
  assert.deepEqual(numbers, [1, 2, 3, 4, 5].map((n) => `${year}-${String(n).padStart(4, "0")}`));
  for (const c of batch) assert.equal(c.documentLayout, 2, "i nuovi contratti usano l'impaginazione attuale");
});

test("ogni azienda ha la sua numerazione", async () => {
  const b = await makeContract(sellerB, 1);
  assert.equal(b.contractNumber, `${year}-0001`);
  const a = await makeContract(sellerA, 6);
  assert.equal(a.contractNumber, `${year}-0006`);
});

test("se l'inserimento fallisce il numero non viene consumato", async () => {
  await assert.rejects(makeContract(sellerB, 1)); // contractCode duplicato
  const b = await makeContract(sellerB, 2);
  assert.equal(b.contractNumber, `${year}-0002`);
});
