---
name: package-lock registry URLs
description: Replit's npm proxy leaks into package-lock and breaks npm install on the VPS.
---
npm on Replit uses `http://package-firewall.replit.internal/npm/`; newly installed packages get that `resolved` URL, which doesn't exist on the VPS. post-merge.sh rewrites it to registry.npmjs.org and `tests/package-lock.test.ts` fails if any remain.

**Why:** the owner's `npm install` on the VPS failed because of it.

**How to apply:** after installing any package, run the sed in post-merge.sh (or npm test will flag it).
