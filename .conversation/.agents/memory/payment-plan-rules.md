---
name: Payment plan rules
description: How totals, activation fee and installments must relate in the contract form and document.
---

- Installment sums must equal the total exactly: compute in cents; rounding remainder goes on the last installment. Preview/send is blocked client-side when the sum differs (custom rates: vs total; automatic: vs total minus first-installment discount).
- Activation fee is normally only a text placeholder ({{costo_attivazione}}). When the seller ticks "compreso nel prezzo totale", it becomes the first payment at signing (row labelled "Attivazione", no installment number) and the remainder is split, first installment one month later.
- Installment count follows contract duration only below 12 months (3 months → 3 monthly); ≥12 months keeps the historical 12/4/2/1 so owner contracts are unchanged.
- Plan dates are stored as dd/MM/yyyy strings; never pass them through `new Date()` (US parsing swaps day/month).
- Old plans have no row labels, so their numbering/rendering stays identical.
- `npm test` runs files serially: parallel files deadlock on the startup schema DDL vs test cleanups (not a production issue).

**Why:** owner asked (Oct 2026) that e.g. 6000 total with 600 activation included be handled correctly; earlier 1000/12 produced a 999.96 contract total.
**How to apply:** any new calculator option goes through the shared pure plan builder so form checks and calculator never disagree.
