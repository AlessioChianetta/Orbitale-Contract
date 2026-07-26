---
name: Type-check baseline
description: npm run check (tsc) fails on pre-existing errors; how to judge regressions
---

# Type-check baseline

`npm run check` (plain `tsc`) fails with a large pre-existing error baseline (as of July 2026): `req.user possibly undefined` all over server/routes.ts, Set/Map iteration without downlevelIteration, untyped `useQuery` results (`templates is of type unknown`), deprecated `onError` in react-query options, drizzle query-builder typing in getCompanySettings.

**Why:** The dev/build pipeline (tsx + vite/esbuild) never runs tsc, so the app runs fine despite the failing check.

**How to apply:** Never treat a failing full `tsc` as caused by current work. Judge regressions by filtering tsc output to the files actually touched and comparing against this known-error set. Quick JSX syntax validation: `npx esbuild <file> --loader:.tsx=tsx --jsx=automatic --outfile=/dev/null`. Note: `npx tsx -e "…"` compiles as CJS — no top-level await; wrap in `async function main()` + `main()`. One-off DB/storage scripts run fine with `npx tsx` from repo root (tsconfig paths resolved).
