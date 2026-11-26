---
name: Workspace auto-pushes to GitHub main
description: Replit checkpoint commits in this workspace get pushed to GitHub main, which the VPS pulls
---
Replit's automatic checkpoint commits here are pushed (rebased) onto GitHub `main` — the same branch the owner's VPS deploys with `git pull`. Anything left in the working tree reaches production on the next pull.
**Why:** Nov 26 2026 a checkpoint pushed the mounted `.conversation/` folder (copy of the old chat workspace, 400 files) plus lockfile changes to main; the owner pulled it on the VPS before it was cleaned.
**How to apply:** never leave experimental/unfinished changes in the working tree; `.conversation/` is a Replit mount (cannot be deleted) and must stay in .gitignore; package-lock must keep registry.npmjs.org URLs.
