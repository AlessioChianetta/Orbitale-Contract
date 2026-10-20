// Script di creazione azienda cliente (task 001, Fase C): idempotente,
// password temporanea solo alla creazione, OTP via email, template HTML.
// Gira sul DB collegato e cancella tutto ciò che crea.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { pool } from "../server/db";
import { onboardCompany, listPlaceholders } from "../server/onboarding";
import { comparePasswords } from "../server/password";

const tag = `onbtest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const dir = mkdtempSync(path.join(tmpdir(), "onboarding-"));
const companies = new Set<number>();

writeFileSync(path.join(dir, "contratto.html"), "<h1>Contratto</h1><p>Cliente: {{nome}} {{ cognome }} - {{codice_fiscale}}</p>");
writeFileSync(path.join(dir, "privacy.txt"), "Informativa privacy di prova.");
// PNG 1x1
writeFileSync(path.join(dir, "logo.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

function config(overrides: any = {}) {
  return {
    company: {
      companyName: `${tag} Studio`, address: "Via Prova 1", city: "Torino", postalCode: "10100",
      taxId: "PRVTST00A00H501X", vatId: "00000000000", pec: "prova@pec.invalid",
      logoPath: "logo.png", privacyPolicyTextPath: "privacy.txt", marketingConsentEnabled: false,
      ...(overrides.company || {}),
    },
    admin: { username: `${tag}-admin`, email: `${tag}@example.invalid`, fullName: "Titolare Prova", ...(overrides.admin || {}) },
    template: { name: "Contratto cliente", htmlPath: "contratto.html" },
  };
}

after(async () => {
  try {
    const ids = Array.from(companies);
    if (ids.length) {
      await pool.query(`DELETE FROM contract_presets WHERE company_id = ANY($1::int[])`, [ids]);
      await pool.query(
        `DELETE FROM contract_templates WHERE created_by IN (SELECT id FROM public.users WHERE company_id = ANY($1::int[]))`, [ids]);
      await pool.query(`DELETE FROM public.users WHERE company_id = ANY($1::int[])`, [ids]);
      await pool.query(`DELETE FROM company_settings WHERE id = ANY($1::int[])`, [ids]);
    }
  } finally {
    await pool.end();
  }
});

test("prova (--dry-run): nessuna modifica salvata", async () => {
  const r = await onboardCompany(config(), { baseDir: dir, dryRun: true });
  assert.equal(r.companyCreated, true);
  assert.equal(r.temporaryPassword, null);
  const { rowCount } = await pool.query(`SELECT 1 FROM company_settings WHERE company_name = $1`, [`${tag} Studio`]);
  assert.equal(rowCount, 0);
});

test("prima esecuzione: azienda, admin con password temporanea, OTP email, template", async () => {
  const r = await onboardCompany(config(), { baseDir: dir });
  companies.add(r.companyId);
  assert.equal(r.companyCreated, true);
  assert.equal(r.adminCreated, true);
  assert.ok(r.temporaryPassword && r.temporaryPassword.length === 12);
  assert.equal(r.template?.action, "created");
  assert.deepEqual(r.placeholders, ["codice_fiscale", "cognome", "nome"]);
  assert.deepEqual(r.warnings, []);

  const { rows: [c] } = await pool.query(`SELECT * FROM company_settings WHERE id = $1`, [r.companyId]);
  assert.equal(c.is_owner, false);
  assert.equal(c.otp_method, "email");
  assert.equal(c.unique_code, "0000000");
  assert.match(c.logo_url, /^data:image\/png;base64,/);
  assert.equal(c.privacy_policy_text, "Informativa privacy di prova.");
  assert.equal(c.smtp_host, null, "l'SMTP lo configura la cliente");

  const { rows: [u] } = await pool.query(`SELECT * FROM public.users WHERE id = $1`, [r.adminId]);
  assert.equal(u.role, "admin");
  assert.equal(u.company_id, r.companyId);
  assert.equal(u.must_change_password, true);
  assert.ok(await comparePasswords(r.temporaryPassword!, u.password));

  const { rows: [t] } = await pool.query(`SELECT * FROM contract_templates WHERE id = $1`, [r.template!.id]);
  assert.equal(t.created_by, r.adminId);
  assert.equal(t.category, "Clienti");
  assert.equal(t.recipient_type, "cliente");
});

test("seconda esecuzione: niente doppioni, password invariata, template aggiornato solo se cambia", async () => {
  const first = await onboardCompany(config(), { baseDir: dir });
  assert.equal(first.companyCreated, false);
  assert.equal(first.adminCreated, false);
  assert.equal(first.temporaryPassword, null);
  assert.equal(first.template?.action, "unchanged");

  writeFileSync(path.join(dir, "contratto.html"), "<h1>Contratto v2</h1><p>{{nome}}</p>");
  const second = await onboardCompany(config({ company: { city: "Milano" } }), { baseDir: dir });
  assert.equal(second.companyId, first.companyId);
  assert.equal(second.template?.action, "updated");
  assert.equal(second.template?.id, first.template?.id);

  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM company_settings WHERE company_name = $1`, [`${tag} Studio`]);
  assert.equal(rows[0].n, 1);
  const { rows: [c] } = await pool.query(`SELECT city FROM company_settings WHERE id = $1`, [first.companyId]);
  assert.equal(c.city, "Milano");
});

test("rifiuta un admin che appartiene all'azienda del proprietario", async () => {
  const { rows } = await pool.query(
    `SELECT u.email, u.username FROM public.users u JOIN company_settings c ON c.id = u.company_id WHERE c.is_owner LIMIT 1`);
  if (!rows[0]) return; // DB senza azienda proprietaria con utenti
  await assert.rejects(
    onboardCompany(config({ admin: { email: rows[0].email, username: rows[0].username } }), { baseDir: dir }),
    /proprietario/,
  );
});

test("file mancante: errore prima di toccare il DB", async () => {
  const cfg = config({ company: { companyName: `${tag} Altro` } });
  cfg.template.htmlPath = "non-esiste.html";
  await assert.rejects(onboardCompany({ ...cfg, admin: { ...cfg.admin, email: `${tag}-x@example.invalid`, username: `${tag}-x` } }, { baseDir: dir }));
  const { rowCount } = await pool.query(`SELECT 1 FROM company_settings WHERE company_name = $1`, [`${tag} Altro`]);
  assert.equal(rowCount, 0);
});

test("segnaposto: esclude i blocchi {{#...}} e {{/...}}", () => {
  assert.deepEqual(listPlaceholders("{{#payment_plan}}{{rata_numero}}{{/payment_plan}} {{nome}} {{nome}}"), ["nome", "rata_numero"]);
});

test("più template, ciascuno con il suo preset condiviso; idempotente", async () => {
  writeFileSync(path.join(dir, "export.html"), "<p>{{societa}} {{var_mercati}}</p>");
  writeFileSync(path.join(dir, "analisi.html"), "<p>{{societa}}</p>");
  const base = config({
    company: { companyName: `${tag} Multi` },
    admin: { email: `${tag}-multi@example.invalid`, username: `${tag}-multi` },
  });
  const cfg = {
    company: base.company, admin: base.admin,
    templates: [
      { name: "Percorso export", htmlPath: "export.html", description: "3 mesi",
        preset: { name: "Export 3 mesi", totalValue: 1500, defaultDurationMonths: 3 } },
      { name: "Analisi", htmlPath: "analisi.html", preset: { name: "Analisi 1 mese", defaultDurationMonths: 1 } },
    ],
  };
  const r = await onboardCompany(cfg, { baseDir: dir });
  companies.add(r.companyId);
  assert.deepEqual(r.templates.map((t) => [t.name, t.action, t.preset?.action]), [
    ["Percorso export", "created", "created"], ["Analisi", "created", "created"],
  ]);
  assert.deepEqual(r.templates[0].placeholders, ["societa", "var_mercati"]);
  assert.equal(r.template?.id, r.templates[0].id, "compatibilità: primo template");

  const { rows: presets } = await pool.query(
    `SELECT name, visibility, template_id, total_value, auto_renewal, default_duration_months FROM contract_presets WHERE company_id = $1 ORDER BY id`,
    [r.companyId]);
  assert.deepEqual(presets.map((p) => [p.name, p.visibility, p.template_id, p.total_value === null ? null : Number(p.total_value), p.auto_renewal, p.default_duration_months]), [
    ["Export 3 mesi", "shared", r.templates[0].id, 1500, false, 3],
    ["Analisi 1 mese", "shared", r.templates[1].id, null, false, 1],
  ]);

  const again = await onboardCompany(cfg, { baseDir: dir });
  assert.deepEqual(again.templates.map((t) => [t.action, t.preset?.action]), [["unchanged", "unchanged"], ["unchanged", "unchanged"]]);

  cfg.templates[0].preset.totalValue = 1800;
  const changed = await onboardCompany(cfg, { baseDir: dir });
  assert.equal(changed.templates[0].preset?.action, "updated");
  const { rows: n } = await pool.query(`SELECT count(*)::int AS n FROM contract_presets WHERE company_id = $1`, [r.companyId]);
  assert.equal(n[0].n, 2, "nessun doppione");
});

test("campi da completare (INSERIRE_...) e template ripetuti: errore senza toccare il DB", async () => {
  const cfg = config({ company: { companyName: `${tag} Todo`, pec: "INSERIRE_PEC" } });
  await assert.rejects(onboardCompany(cfg, { baseDir: dir }), /Completa nel file di configurazione: pec/);
  const dup = { ...config({ company: { companyName: `${tag} Todo` } }), templates: [{ name: "Contratto cliente", htmlPath: "contratto.html" }] };
  await assert.rejects(onboardCompany(dup, { baseDir: dir }), /ripetuto/);
  const { rowCount } = await pool.query(`SELECT 1 FROM company_settings WHERE company_name = $1`, [`${tag} Todo`]);
  assert.equal(rowCount, 0);
});

test("venditore: creato con password temporanea, non duplicato, mai in un'altra azienda", async () => {
  const sTag = `${tag}-sv`;
  const cfg = {
    ...config({ company: { companyName: `${sTag} Studio` }, admin: { username: `${sTag}-admin`, email: `${sTag}+admin@example.invalid` } }),
    seller: { username: `${sTag}-seller`, email: `${sTag}@example.invalid`, fullName: "Titolare Prova" },
  };
  const dry = await onboardCompany(cfg, { baseDir: dir, dryRun: true });
  assert.equal(dry.seller?.created, true);
  assert.equal(dry.seller?.temporaryPassword, null, "nessuna password in prova");

  const r = await onboardCompany(cfg, { baseDir: dir });
  companies.add(r.companyId);
  assert.ok(r.seller?.created && r.seller.temporaryPassword);
  const { rows: [u] } = await pool.query(`SELECT * FROM public.users WHERE id = $1`, [r.seller!.id]);
  assert.equal(u.role, "seller");
  assert.equal(u.company_id, r.companyId);
  assert.equal(u.must_change_password, true);
  assert.equal(u.is_active, true);
  assert.ok(await comparePasswords(r.seller!.temporaryPassword!, u.password));

  const again = await onboardCompany(cfg, { baseDir: dir });
  assert.equal(again.seller?.id, r.seller!.id);
  assert.equal(again.seller?.created, false);
  assert.equal(again.seller?.temporaryPassword, null);

  // Lo stesso venditore indicato per un'altra azienda: errore, nessuna modifica.
  await assert.rejects(
    onboardCompany({
      ...config({ company: { companyName: `${sTag} Altro` }, admin: { username: `${sTag}-admin2`, email: `${sTag}-2@example.invalid` } }),
      seller: cfg.seller,
    }, { baseDir: dir }),
    /altra azienda/,
  );
  // Venditore con la stessa email dell'admin: errore.
  await assert.rejects(
    onboardCompany({ ...cfg, seller: { ...cfg.seller, email: cfg.admin.email } }, { baseDir: dir }),
    /diversi/,
  );
});

test("--nuove-password: password temporanee nuove per admin e venditore già esistenti", async () => {
  const sTag = `${tag}-np`;
  const cfg = {
    ...config({ company: { companyName: `${sTag} Studio` }, admin: { username: `${sTag}-admin`, email: `${sTag}@example.invalid` } }),
    seller: { username: `${sTag}-seller`, email: `${sTag}+v@example.invalid`, fullName: "Titolare Prova" },
  };
  const first = await onboardCompany(cfg, { baseDir: dir });
  companies.add(first.companyId);
  await pool.query(`UPDATE public.users SET must_change_password = false WHERE company_id = $1`, [first.companyId]);

  const dry = await onboardCompany(cfg, { baseDir: dir, dryRun: true, resetPasswords: true });
  assert.equal(dry.temporaryPassword, null);
  assert.equal(dry.seller?.temporaryPassword, null);
  const { rows: [still] } = await pool.query(`SELECT password FROM public.users WHERE id = $1`, [first.adminId]);
  assert.ok(await comparePasswords(first.temporaryPassword!, still.password), "la prova non cambia nulla");

  const r = await onboardCompany(cfg, { baseDir: dir, resetPasswords: true });
  assert.equal(r.adminCreated, false);
  assert.ok(r.temporaryPassword && r.seller?.temporaryPassword);
  const { rows } = await pool.query(`SELECT id, password, must_change_password FROM public.users WHERE id = ANY($1::int[]) ORDER BY id`, [[r.adminId, r.seller!.id]]);
  const byId = new Map(rows.map((u: any) => [u.id, u]));
  assert.ok(await comparePasswords(r.temporaryPassword!, byId.get(r.adminId).password));
  assert.ok(!(await comparePasswords(first.temporaryPassword!, byId.get(r.adminId).password)), "la vecchia non vale più");
  assert.ok(await comparePasswords(r.seller!.temporaryPassword!, byId.get(r.seller!.id).password));
  assert.equal(byId.get(r.adminId).must_change_password, true);
  assert.equal(byId.get(r.seller!.id).must_change_password, true);
});
