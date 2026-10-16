# Stato dei lavori

Aggiornato al: **16/10/2026**. Chi lavora su una task aggiorna questa tabella e la sezione "Avanzamento" della task.

| Task | Titolo | Stato | Prossimo passo |
|------|--------|-------|----------------|
| 001 | Onboarding prima cliente (multi-azienda) | Da fare: analisi e decisioni del proprietario raccolte | Fase A (sicurezza multi-azienda) prima di creare l'account della cliente |
| 002 | Registro audit e PDF firmato | In corso: codice e test automatici fatti; pagina cliente e PDF ora da un'unica sorgente | Prova end-to-end, aggiornamento del VPS (`npm install`, controllo nginx), PDF reale con "WhatsApp" da analizzare |

## Regole per chi riprende il lavoro
- Le task sono in `task-da-fare/NNN-titolo.md`, in italiano.
- Il database di Replit **non** è quello del sito pubblicato (VPS). Le modifiche ai dati di produzione si fanno con script da lanciare sul VPS.
- Non usare `npm run db:push` semplice: applicare le modifiche allo schema con SQL idempotente e aggiornare a mano `shared/schema.ts`.
- Prima di consegnare: `npm test` e `npm run test:pdf` devono passare.
- Pagina di firma e PDF: un solo documento, `shared/contract-document.ts`. Non duplicarlo.
