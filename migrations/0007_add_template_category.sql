-- 0007: Categoria assegnabile ai template contratto
-- Nota: il server esegue comunque questo ALTER in modo idempotente all'avvio
-- (ensureTemplateCategorySchema in server/routes.ts), quindi sul VPS basta
-- riavviare l'app dopo il pull. Questo file documenta la modifica per chi
-- applica le migrazioni a mano.
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS category TEXT;

-- Backfill suggerito (facoltativo, adattare ai propri dati):
-- UPDATE contract_templates SET category = 'Clienti'       WHERE category IS NULL AND name ILIKE '%orbitale%' AND name NOT ILIKE '%modulare%';
-- UPDATE contract_templates SET category = 'Test/Archivio' WHERE category IS NULL AND (name ILIKE '%prova%' OR name ILIKE '%test%');
