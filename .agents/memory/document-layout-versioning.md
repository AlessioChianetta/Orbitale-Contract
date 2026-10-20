---
name: Document layout versioning
description: Rule for changing what the contract document prints without altering already shown/signed contracts.
---
Any change to what `shared/contract-document.ts` prints must keep contracts with `documentLayout === 1` rendering exactly as before; new behaviour applies to layout 2 (or a new layout number if layout-2 contracts already went out).

**Why:** signed/shown contracts must never change. Historical data contradicts the flags (21 signed contracts have auto_renewal=false but printed the renewal clause; private clients were printed as companies), so "fixing" the flags or the renderer globally would rewrite signed documents. A data migration was rejected by design.

**How to apply:** gate every rendering change on the layout version; when a change would alter layout-2 contracts that were already sent, introduce layout 3 (bump the column default in tenant-schema.ts) instead of editing layout 2. Contract numbers (YYYY-NNNN per company) come from a counter table inside the create transaction; historical contracts have none and show their id.
