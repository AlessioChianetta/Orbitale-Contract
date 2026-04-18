ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "co_fill_token" text;
CREATE INDEX IF NOT EXISTS "contracts_co_fill_token_idx" ON "contracts" ("co_fill_token");
