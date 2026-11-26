---
name: npm install blocked packages
description: Why vite was bumped and proxy-addr overridden in package.json
---
Replit's package firewall blocks certain versions with critical CVEs (403 "Blocked by Security Policy"): vite 5.4.x/6.4.1–6.4.5 and proxy-addr 2.0.6/2.0.7.
Fix used: vite ^6.4.6 in devDependencies and `overrides: { "proxy-addr": "2.0.8" }`.
**Why:** `npm ci` from the original lockfile fails otherwise.
**How to apply:** if npm install fails with E403, check every `resolved` URL in package-lock via curl against package-firewall.replit.internal and bump/override only the blocked ones.

The app's real data lives on the user's VPS (own Postgres); the Replit dev DB is a fresh empty copy of the schema.
