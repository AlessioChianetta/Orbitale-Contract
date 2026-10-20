import { pool } from "./db";

/**
 * Migrazione idempotente per l'isolamento multi-azienda (task 001, Fase A).
 *
 * - company_settings.is_owner: identifica l'azienda del proprietario della
 *   piattaforma. Solo lei riceve in automatico i template "Sistema Orbitale"
 *   e "Contratto Procacciatore". Quando la colonna viene creata (una sola
 *   volta) il flag va all'azienda con l'id più basso, cioè la prima creata.
 *   Non è modificabile dalle Impostazioni Azienda.
 * - users.is_active: gli utenti non si eliminano più, si disattivano
 *   (login bloccato, contratti e template restano dell'azienda).
 *
 * Viene attesa all'avvio prima di registrare le rotte: le query Drizzle su
 * users e company_settings selezionano queste colonne.
 */
export async function ensureTenantSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount: ownerColumnExists } = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'is_owner'`
    );
    if (!ownerColumnExists) {
      await client.query(
        `ALTER TABLE company_settings ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT false`
      );
      const { rows } = await client.query(
        `UPDATE company_settings SET is_owner = true
          WHERE id = (SELECT MIN(id) FROM company_settings)
          RETURNING id, company_name`
      );
      if (rows[0]) {
        console.log(`[TENANT] Azienda proprietaria impostata: id ${rows[0].id} (${rows[0].company_name}).`);
      }
    }

    await client.query(
      `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`
    );

    await client.query("COMMIT");
    console.log("[TENANT] Schema ready (company_settings.is_owner, users.is_active).");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
