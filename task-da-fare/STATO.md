# Stato dei lavori

Aggiornato al: **20/10/2026**. Chi lavora su una task aggiorna questa tabella e la sezione "Avanzamento" della task.

| Task | Titolo | Stato | Prossimo passo |
|------|--------|-------|----------------|
| 001 | Onboarding prima cliente (multi-azienda) | In corso: Fase A (sicurezza) completata il 20/10/2026 | Fase B: documento per cliente privato, numerazione per azienda, informativa privacy. Sul VPS: verificare quale azienda ha `is_owner` |
| 003 | Registro attività e log del sistema | Da fare: analisi del 16/10/2026 | Fase 1 subito: togliere il codice di verifica e gli altri dati riservati dai log |

## Task completate (in `task-da-fare/fatti/`)
| Task | Titolo | Chiusa il |
|------|--------|-----------|
| 002 | Registro audit e PDF firmato (+ pagina cliente e PDF da un'unica sorgente) | 16/10/2026 |

## Regole per chi riprende il lavoro
- Le task sono in `task-da-fare/NNN-titolo.md`, in italiano. Quando una task è completata si sposta in `task-da-fare/fatti/`.
- Il database di Replit **non** è quello del sito pubblicato (VPS). Le modifiche ai dati di produzione si fanno con script da lanciare sul VPS.
- Non usare `npm run db:push` semplice: applicare le modifiche allo schema con SQL idempotente e aggiornare a mano `shared/schema.ts`.
- Prima di consegnare: `npm test` e `npm run test:pdf` devono passare.
- Pagina di firma e PDF: un solo documento, `shared/contract-document.ts`. Non duplicarlo.
