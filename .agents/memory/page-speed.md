---
name: Page and signing speed
description: Why the client page is code-split/gzipped by Express and why Chromium is pre-warmed; what to keep when touching static serving or the sign route.
---
- Static files in production are served by our own Express code (gzip of /assets in memory, 1-year immutable cache for hashed assets, no-cache for index.html); nginx on the VPS did NOT compress and sent max-age=0. Missing /assets files must 404, never fall back to index.html.
- Pages are lazy-loaded routes; a failed chunk import reloads the page once (deploy while page open).
- Sign route: Chromium is warmed on send-otp; emails/WhatsApp run after res.json; `[SIGN]` log line gives per-phase timings.
**Why:** a real signature took 18 s (cold Chromium ~13 s + SMTP with attachment ~4.5 s) and the client page shipped 1.6 MB uncompressed JS.
**How to apply:** no new npm deps for this (VPS deploy may skip npm install); measure with the [SIGN] line before optimizing again; PDF output must stay byte-identical in size when changing waits.
