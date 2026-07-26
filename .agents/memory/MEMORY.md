# Memory index

- [Multi-tenant data layout](multi-tenant-data.md) — 2 companies in DB (id 1 = real, id 2 = test); rows scoped via creator/seller join, so raw table counts differ from admin UI.
- [Type-check baseline](typecheck-baseline.md) — `npm run check` fails on ~100 pre-existing errors; judge regressions only by new errors on touched files.
