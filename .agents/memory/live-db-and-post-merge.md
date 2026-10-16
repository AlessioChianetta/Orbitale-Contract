---
name: Workspace DB is the live database
description: The Replit workspace DATABASE_URL points at the real Supabase DB; post-merge db:push --force would drop unmapped columns.
---

The workspace DATABASE_URL (and .env) points at a Supabase Postgres holding real contracts/clients (verified Oct 2026: 60+ signed contracts). BASE_URL is the owner's public domain, so emails sent from dev carry live links.

`scripts/post-merge.sh` runs `npm run db:push -- --force`. Columns `contracts.first_opened_at/last_activity_at/total_presence_ms` exist in DB but not in shared/schema.ts → a forced push would drop them.

**Why:** any test, seed or schema change from the workspace hits production data and real recipients.

**How to apply:** tests must use dedicated throwaway companies/users with mocked SMTP/Twilio and clean up after themselves; never send real emails/SMS to client addresses; remove or neutralise the forced push before any task merge.
