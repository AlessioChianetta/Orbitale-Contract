# Memory index

- [Multi-tenant data layout](multi-tenant-data.md) — 2 companies in DB (id 1 = real, id 2 = test); rows scoped via creator/seller join; template update/delete still unscoped; owner templates auto-seed into every company.
- [Type-check baseline](typecheck-baseline.md) — `npm run check` fails on ~100 pre-existing errors; judge regressions only by new errors on touched files.
- [Drizzle db:push hang](drizzle-db-push.md) — never run plain db:push (interactive drift prompt hangs in non-TTY); apply schema via raw SQL + manual schema.ts sync.
- [Contract send-pipeline invariants](contract-send-pipeline.md) — preview/create/update placeholder gates share one helper; preview-token HMAC must hash every content-affecting field.
- [OTP channel truth](otp-audit-truth.md) — twilioVerify is the only ground truth; legacy method/otpMethod fields lie except when they say "email"; unknown channel renders neutral.
- [Workspace DB is live](live-db-and-post-merge.md) — Replit DATABASE_URL = real Supabase with client data; post-merge db:push --force would drop columns.
- [Task files](task-files-convention.md) — owner wants plans as task-da-fare/NNN-slug.md, in Italian.
