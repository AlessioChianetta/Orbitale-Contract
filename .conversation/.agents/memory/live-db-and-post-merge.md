---
name: Workspace DB = live DB
description: The workspace DATABASE_URL is the SAME database the published site (VPS) uses; consequences for tests, data changes and migrations.
---
Verified Oct 20 2026: a seller created by the onboarding script on the VPS appeared immediately in the workspace DB. Earlier belief ("separate DB") was wrong. Company 176 (Elvira Vigliano – TALES&TONGUES) is the REAL client tenant, not a test copy.

**Why:** test data and the owner's SMTP credentials had been put into company 176 believing it was a copy; it leaked into the real client's account and had to be cleaned (test sellers deactivated, test contracts archived, owner SMTP removed).

**How to apply:**
- Every SQL/script run here hits production. Never put test data, owner credentials or test sends into a real tenant; tests must use throwaway tenants and clean up.
- The VPS may run OLDER code than the workspace against the same DB: startup SQL from the workspace must stay compatible with the old code (e.g. don't change column defaults the old code relies on).
- Columns contracts.first_opened_at/last_activity_at/total_presence_ms exist in DB but not in shared/schema.ts → never db:push / --force.
