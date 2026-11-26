---
name: Signed PDF / audit invariants
description: Rules the signed-contract PDF and audit log must keep (owner reported fake data and layout problems in the PDF sent to clients). Read before touching signing, audit logging, PDF or post-sign notifications.
---

Rules:
- The audit section of the PDF is frozen at the first `signed` event. Later events (archive, views, regenerations) never appear in a signed PDF.
- Never state anything that is not recorded. Missing data shows "non registrato". No legal claims the system cannot back: no "firma avanzata", no "eIDAS", no "manomissione rilevabile" unless a hash is printed.
- Logged-in users opening /client/:code are not client views and must not be logged as `viewed`.
- Signed contracts are immutable: no text edits, no deletion (archive only).
- Messages sent to a company's clients use only that company's credentials, never the server .env (the .env belongs to the owner).
- No emoji in PDFs. The server Chromium has no emoji font, so emoji print as boxes.
- Keep the PDF and the email/WhatsApp copy white-label, without the platform name.

**Why:** the owner found PDFs with cut-off columns, raw JSON and "telefono verificato" on email signatures, and also a WhatsApp claim. The PDF is the client's legal copy.

**How to apply:** extend the unit tests in tests/audit-trail.test.ts and run `npm run test:pdf` after any change to signing or PDF code.
