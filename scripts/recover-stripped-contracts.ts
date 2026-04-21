/**
 * One-shot recovery: trova i contratti il cui `generated_content` è stato
 * salvato dall'editor TipTap PRIMA del fix `PreserveInlineFormatting`,
 * cioè con tutti gli stili inline rimossi, e li resetta in modo che la
 * prossima lettura rigeneri il documento dal template (formattazione
 * inclusa).
 *
 * Heuristica: contratto marcato `content_manually_edited = true` il cui
 * `generated_content` non contiene alcun attributo `style=` (i template
 * hanno sempre stili inline sui titoli, quindi assenza completa = stripato).
 *
 * Uso:
 *   npx tsx scripts/recover-stripped-contracts.ts            # dry-run
 *   npx tsx scripts/recover-stripped-contracts.ts --apply    # applica
 *   npx tsx scripts/recover-stripped-contracts.ts --code XYZ # solo uno
 *
 * Idempotente: contratti già recuperati (flag false) vengono ignorati.
 * NB: l'utente venditore dovrà rifare manualmente le modifiche aggiunte
 * in precedenza — il vecchio testo modificato è perso (non c'è cronologia
 * versioni nel sistema attuale).
 */
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const apply = process.argv.includes("--apply");
  const codeIdx = process.argv.indexOf("--code");
  const onlyCode = codeIdx >= 0 ? process.argv[codeIdx + 1] : null;

  const where = onlyCode
    ? `WHERE contract_code = $1 AND content_manually_edited = true`
    : `WHERE content_manually_edited = true
         AND generated_content !~ 'style='`;
  const params = onlyCode ? [onlyCode] : [];

  const sel = await pool.query(
    `SELECT id, contract_code, status, fill_mode,
            length(generated_content) AS gc_len,
            (generated_content ~ 'style=') AS has_style
       FROM contracts
       ${where}`,
    params,
  );

  if (sel.rows.length === 0) {
    console.log("Nessun contratto da recuperare.");
    await pool.end();
    return;
  }

  console.log(`Trovati ${sel.rows.length} contratto/i da recuperare:`);
  for (const r of sel.rows) {
    console.log(
      `  - id=${r.id} code=${r.contract_code} status=${r.status} ` +
        `fillMode=${r.fill_mode} gc_len=${r.gc_len} has_style=${r.has_style}`,
    );
  }

  if (!apply) {
    console.log("\nDry-run. Aggiungi --apply per applicare il reset.");
    await pool.end();
    return;
  }

  const ids = sel.rows.map((r) => r.id);
  const upd = await pool.query(
    `UPDATE contracts
        SET content_manually_edited = false,
            generated_content = '',
            pdf_path = NULL,
            updated_at = NOW()
      WHERE id = ANY($1::int[])
      RETURNING id, contract_code`,
    [ids],
  );
  console.log(`\nReset applicato a ${upd.rows.length} contratto/i.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
