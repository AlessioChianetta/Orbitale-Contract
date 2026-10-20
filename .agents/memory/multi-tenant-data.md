---
name: Multi-tenant data layout
description: How companies partition templates/contracts in the DB and why some rows are invisible in the admin UI
---

# Multi-tenant data layout

There are TWO companies in the database: id 1 = the real production company, id 2 = a test company with throwaway data.

Templates and contracts have no companyId column: scoping happens via join on the creator/seller user's `company_id`. Rows created by company-2 users are invisible to the company-1 admin dashboard and are NOT included in company-1 usage counts.

**Why:** Counting rows with raw SQL shows more templates/contracts than the admin UI displays; this is expected, not a bug.

**How to apply:** When verifying UI-visible data or writing aggregations, always join through users and filter by company_id, and don't assume raw table counts match what the user sees.

Owner company = `company_settings.is_owner` (one-time backfill to the lowest id when the column was created; owner must confirm the VPS row). Owner-only things (Orbitale/Procacciatore seed, owner tools) must gate on this flag, never on "id 1". Users are deactivated (`is_active`), never deleted: deleting breaks template FKs and orphans contracts.
