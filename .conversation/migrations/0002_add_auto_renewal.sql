
-- Migrazione per aggiungere campi di autorinnovo ai contratti
ALTER TABLE contracts 
ADD COLUMN auto_renewal boolean DEFAULT false,
ADD COLUMN renewal_duration integer DEFAULT 12;

-- Aggiorna i contratti esistenti con valori di default
UPDATE contracts 
SET auto_renewal = false, renewal_duration = 12 
WHERE auto_renewal IS NULL OR renewal_duration IS NULL;

-- Crea indice per migliorare le performance sulle query di autorinnovo
CREATE INDEX idx_contracts_auto_renewal ON contracts(auto_renewal) WHERE auto_renewal = true;

-- Commento sulla migrazione
COMMENT ON COLUMN contracts.auto_renewal IS 'Indica se il contratto ha autorinnovo automatico attivato';
COMMENT ON COLUMN contracts.renewal_duration IS 'Durata del rinnovo automatico in mesi (default 12)';
