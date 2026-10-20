---
name: Workspace DB vs live DB
description: The Replit workspace DB is a Supabase separate from the live site; still holds realistic data. post-merge db:push --force would drop unmapped columns.
---

The owner confirmed (Oct 2026) the published site (VPS, deployed via git pull) uses a DIFFERENT database from the workspace. The workspace DATABASE_URL is still a Supabase with realistic historical contracts, and BASE_URL is the owner's public domain (emails sent from dev carry live-domain links).

Columns `contracts.first_opened_at/last_activity_at/total_presence_ms` exist in DB but not in shared/schema.ts → any forced db:push would drop them. The forced push was removed from post-merge (Oct 2026); never re-add it.

**Why:** test sends from the workspace reach real inboxes; production data changes (e.g. creating a tenant) must be done on the VPS, not here.

**How to apply:** tests use throwaway companies/users with mocked SMTP/Twilio and clean up; deliver prod data changes as idempotent scripts the owner runs on the VPS; schema changes go through idempotent startup migrations awaited before routes register. The VPS may run an older code version than the workspace — ask before assuming a bug still exists.
