---
name: Chromium single-process PDF quirk
description: Why PDF rendering retries once with a fresh browser.
---
With `--single-process`, a PDF containing images rendered after one without images fails with "Navigating frame was detached" (deterministic). Companies without a logo hit it (preview → signed PDF). renderPdf restarts the browser and retries once.

**Why:** found by the send-sign-flow test; production signing returned 500.

**How to apply:** don't remove the retry; if touching launch args, re-run `npm test` (send-sign-flow covers plain-then-image).
