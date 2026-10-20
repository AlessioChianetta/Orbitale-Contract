/**
 * Crea (o aggiorna) un'azienda cliente: dati fiscali, primo admin con
 * password temporanea, OTP via email, contratto HTML.
 *
 * Uso (sul VPS, dalla cartella del progetto):
 *   npx tsx --require ./server/loadEnv.cjs scripts/onboard-company.ts onboarding/cliente.json --dry-run
 *   npx tsx --require ./server/loadEnv.cjs scripts/onboard-company.ts onboarding/cliente.json
 *
 * Esempio di file: scripts/onboard-company.example.json. I percorsi
 * (htmlPath, logoPath, privacyPolicyTextPath) sono relativi al file JSON.
 *
 * Idempotente: rilanciato con lo stesso file non duplica nulla e non tocca
 * la password dell'admin; se l'HTML del contratto è cambiato aggiorna il
 * template (i contratti già creati restano come sono).
 * La password temporanea viene stampata UNA volta sola, alla creazione:
 * va comunicata alla cliente, che la cambia al primo accesso.
 */
import { readFileSync } from "fs";
import path from "path";
import { onboardCompany } from "../server/onboarding";
import { pool } from "../server/db";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Uso: npx tsx --require ./server/loadEnv.cjs scripts/onboard-company.ts <config.json> [--dry-run]");
    process.exit(2);
  }
  const abs = path.resolve(file);
  const config = JSON.parse(readFileSync(abs, "utf8"));
  const r = await onboardCompany(config, { baseDir: path.dirname(abs), dryRun });

  console.log("");
  console.log(dryRun ? "=== PROVA (nessuna modifica salvata) ===" : "=== Fatto ===");
  const id = (n: number, isNew: boolean) => (dryRun && isNew ? "nuovo" : `id ${n}`);
  console.log(`Azienda: ${id(r.companyId, r.companyCreated)} ${r.companyCreated ? "(creata)" : "(già esistente, dati aggiornati)"}`);
  console.log(`Admin:   ${id(r.adminId, r.adminCreated)} ${r.adminCreated ? "(creato)" : "(già esistente, password invariata)"}`);
  if (r.temporaryPassword) {
    console.log(`Password temporanea (da comunicare, cambio obbligatorio al primo accesso): ${r.temporaryPassword}`);
  }
  if (r.template) {
    const label = { created: "creato", updated: "aggiornato", unchanged: "invariato" }[r.template.action];
    console.log(`Template contratto: ${id(r.template.id, r.template.action === "created")} (${label})`);
    console.log(`Segnaposto nel contratto: ${r.placeholders.length ? r.placeholders.join(", ") : "nessuno"}`);
  }
  for (const w of r.warnings) console.log(`ATTENZIONE: ${w}`);
  console.log("");
  console.log("Passi successivi: la cliente accede, cambia password, compila Impostazioni Azienda → Configurazione Email e invia l'email di prova.");
}

main()
  .catch((e) => {
    console.error("ERRORE:", e?.issues ? JSON.stringify(e.issues, null, 2) : e?.message || e);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
