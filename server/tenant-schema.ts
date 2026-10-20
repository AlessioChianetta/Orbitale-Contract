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
 * Fase B (contratto della cliente):
 * - contracts.document_layout: versione dell'impaginazione del documento.
 *   I contratti già esistenti quando la colonna viene creata ricevono 1
 *   (si rendono come sono stati mostrati/firmati); poi 2; dal 20/10/2026 i
 *   nuovi prendono 3 (C.F. e P.I. separati) dal codice, senza toccare quelli
 *   già creati; il default del DB resta 2.
 * - contracts.contract_number + company_contract_counters: numerazione per
 *   azienda e per anno (es. 2026-0001). I contratti storici restano senza
 *   numero e continuano a mostrare l'id interno, come già stampato.
 * - company_settings: dicitura IVA dei prezzi, informativa privacy (testo
 *   e/o link) e consenso "comunicazioni commerciali" attivabile.
 *
 * Fase C (account):
 * - users.must_change_password: password temporanea (creata dal proprietario
 *   o da un admin) da cambiare al primo accesso.
 * - password_reset_tokens: recupero password via email.
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

    const { rowCount: layoutColumnExists } = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'document_layout'`
    );
    if (!layoutColumnExists) {
      // Le righe esistenti prendono 1 (impaginazione storica), poi il default passa a 2.
      await client.query(`ALTER TABLE contracts ADD COLUMN document_layout INTEGER NOT NULL DEFAULT 1`);
      await client.query(`ALTER TABLE contracts ALTER COLUMN document_layout SET DEFAULT 2`);
      console.log("[TENANT] contracts.document_layout creata: contratti esistenti con impaginazione storica.");
    }
    // Il default del DB resta 2: i nuovi contratti ricevono l'impaginazione
    // corrente dal codice (CURRENT_DOCUMENT_LAYOUT). Così una versione più
    // vecchia del sito che usa lo stesso DB non crea contratti con
    // un'impaginazione che non conosce.
    await client.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_number TEXT`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_contract_counters (
        company_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        last_number INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (company_id, year)
      )`);

    await client.query(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS price_vat_mode TEXT NOT NULL DEFAULT 'plus_vat'`);
    await client.query(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS privacy_policy_text TEXT`);
    await client.query(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT`);
    await client.query(`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS marketing_consent_enabled BOOLEAN NOT NULL DEFAULT true`);

    // Fase C: password temporanea da cambiare al primo accesso e recupero
    // password via email (si salva solo l'hash del token, valido 1 ora).
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES public.users(id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id, created_at)`);

    // Accesso automatico dall'altro software: ogni lasciapassare vale una volta.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sso_used_nonces (
        nonce TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    await client.query("COMMIT");
    console.log("[TENANT] Schema ready (is_owner, is_active, document_layout, contract_number, privacy, password).");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
