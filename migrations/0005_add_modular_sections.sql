-- Aggiunge supporto per sezioni modulari opzionali nei template contratto
-- e memorizza le selezioni per singolo contratto.

ALTER TABLE "contract_templates"
  ADD COLUMN IF NOT EXISTS "sections" jsonb DEFAULT '[]'::jsonb;

ALTER TABLE "contracts"
  ADD COLUMN IF NOT EXISTS "selected_section_ids" jsonb;
