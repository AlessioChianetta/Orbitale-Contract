---
name: Contract send-pipeline invariants
description: Invariants between preview/create/update routes, the preview-token HMAC, and the public client payload. Read before touching contract sending, placeholders, or client_fill.
---

Three invariants in the contract send pipeline; violating any of them produces "preview passes but send fails" bugs or wrong rendering on the public page.

1. **Placeholder gates must stay in lockstep.** Preview, create, and update each re-run the unresolved-`{{placeholder}}` check on generated content. Any exemption (e.g. recipient-self-filled fields in `client_fill` mode) must be applied identically in all three — there is a shared filter helper in routes.ts for this; never inline a divergent copy.
   **Why:** the preview token only proves *preview* passed; create/update re-validate independently, so a missing exemption there 400s the send (create even deletes the just-created contract).

2. **Preview-token HMAC must cover EVERY field that enters generated content** (templateId, sorted clientData, totals, dates, sorted sectionIds, fillMode, sendToEmail, and the economic params accessLevel/monthlyFee/activationFee — see server/services/preview-token.ts). A code review caught the economic trio missing: content used them but the hash didn't, so post-preview fee edits sailed through. When adding a content-affecting input, add it to `hashContractPayload` in the same change (normalize number/string inside the helper). Extra body keys are ignored, BUT the create route mutates `req.body.clientData` (injects `email`, `tipo_cliente`) *before* hashing — so the client payload must already contain those keys byte-identically or the token mismatches. Don't add new derived fields to the payload; derive server-side from the template instead.

3. **The public client payload strips template fields.** `GET /api/client/contracts/:code` exposes contract-level fields (e.g. `recipientType`) at top level; the embedded "safe" template object does NOT carry them. Client pages must propagate top-level fields into component props explicitly and never rely on clientData heuristics (a signer-injected key once flipped the document to the wrong variant). Also: any client-writable route must use a strict per-recipient allowlist (replace, not extend, the base one).
