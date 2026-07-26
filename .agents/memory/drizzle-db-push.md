---
name: Drizzle db:push hang
description: Why plain `npm run db:push` must never be used in this project and what to do instead.
---

Never run plain `drizzle-kit push` / `npm run db:push` in this project.

**Why:** the dev database has schema drift Drizzle cannot auto-resolve (e.g. a unique constraint like `co_fill_sessions_token_unique` created outside Drizzle). `db:push` stops on an interactive "truncate/rename?" prompt that never returns in a non-TTY shell — the command hangs forever and can stall the session.

**How to apply:** add new columns/indexes with raw SQL via `psql "$DATABASE_URL" -c "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ..."` and keep `shared/schema.ts` in sync by hand. The project also has an established pattern of idempotent startup migrations (`ensure*Schema` in server/routes.ts) for changes that must reach the VPS via git pull. Note: the DB has a duplicate-named `users` table — always qualify `public.users` in raw SQL.
