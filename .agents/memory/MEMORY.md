# Memory index

- [Multi-tenant data layout](multi-tenant-data.md) — 2 companies in DB (id 1 = real, id 2 = test); rows scoped via creator/seller join, so raw table counts differ from admin UI.
- [Type-check baseline](typecheck-baseline.md) — `npm run check` fails on ~100 pre-existing errors; judge regressions only by new errors on touched files.
- [Drizzle db:push hang](drizzle-db-push.md) — never run plain db:push (interactive drift prompt hangs in non-TTY); apply schema via raw SQL + manual schema.ts sync.
- [Contract send-pipeline invariants](contract-send-pipeline.md) — preview/create/update placeholder gates share one helper; preview-token HMAC and public safe-template pitfalls.
