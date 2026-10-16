# 003 — Registro attività e log del sistema

**Stato:** da fare (analisi del 16/10/2026)
**Priorità:** alta. Il punto 1 (dati riservati nei log) è un problema di sicurezza da correggere per primo; il resto va completato prima della consegna alla prima cliente (task 001).
**Richiesta del proprietario:** "qualsiasi cosa accada, come li gestiamo? vanno migliorati sicuramente".
**Obiettivo:** di qualsiasi cosa succeda nel sistema deve restare traccia: chi, cosa, quando, da dove e per quale azienda. Gli errori gravi devono arrivare a qualcuno invece di restare nascosti, e nei log non devono mai finire dati riservati.

---

## 1. Situazione attuale

Oggi esistono due tipi di log.

1. **Registro del contratto** (tabella `audit_logs`, allegato al PDF firmato come "Registro delle operazioni"). Registra creazione, invio, apertura, codice di verifica inviato o sbagliato, firma, email non recapitate, archiviazione, rigenerazioni, modifiche, duplicazione e link di co-compilazione. Funziona ed è stato sistemato nella task 002, ma **ogni riga deve appartenere a un contratto** (`contract_id` obbligatorio): tutto quello che non riguarda un contratto non viene registrato.
2. **Messaggi tecnici del server**: circa 216 `console.log/warn/error` sparsi nel codice, con emoji e senza un formato comune. Non indicano l'azienda né la gravità. Finiscono nell'output del processo: sul VPS non sappiamo dove vanno né per quanto restano.

## 2. Problemi trovati

### Sicurezza — da correggere subito
1. **Il codice di verifica (OTP) viene scritto nei log, sempre, anche in produzione.**
   - `server/services/otp-service.ts`: `Invio OTP personalizzato ${code} a ${contactInfo}`, senza condizioni. In più, in sviluppo, altre due righe con codice ed email.
   - `server/services/twilio-service.ts`: `[TWILIO] Codice:` stampa il codice inserito dal cliente.

   Chi può leggere i log del server potrebbe firmare al posto del cliente: la firma perde valore come prova.
2. **Altri dati riservati nei log:**
   - `POST /api/contracts` stampa l'intera richiesta (`Request body`), cioè tutti i dati anagrafici del cliente;
   - alla firma viene stampato `Generating PDF with signatures`, cioè l'immagine della firma in base64;
   - viene stampata l'email del destinatario della notifica di firma e dell'invio del contratto;
   - `[CO-FILL AUDIT]` stampa i dati dell'evento in chiaro;
   - il registro delle richieste (`server/index.ts`) aggiunge a ogni riga `/api` l'inizio della risposta JSON, che può contenere dati personali.
3. **Gestione errori:** il gestore degli errori in `server/index.ts` risponde al client e poi rilancia l'errore (`throw err`). L'errore non viene salvato da nessuna parte in modo ordinato.

### Cose che oggi non vengono registrate
4. **Accessi:** login riusciti e falliti (con IP), logout, blocchi dopo troppi tentativi.
5. **Utenti:** creazione, modifica del ruolo, disattivazione o eliminazione, cambio e recupero password (quando esisteranno, task 001).
6. **Modelli di contratto:** creazione, modifica, eliminazione, cambio delle sezioni modulari. Oggi, se un modello cambia, non si sa chi l'ha modificato.
7. **Impostazioni azienda:** dati fiscali, logo, configurazione email (senza mai salvare la password), metodo di verifica, credenziali Twilio (solo "modificate", mai il valore), email di prova inviata o fallita.
8. **Errori non legati a un contratto:** codice di verifica non spedito, PDF non generato, server in errore o riavviato, browser per i PDF che non parte.
9. **Download dei PDF** da parte degli utenti del gestionale.

### Organizzazione
10. Nessun avviso: le email non recapitate si vedono solo aprendo il singolo contratto nella dashboard. Nessuno riceve un messaggio.
11. Nessuna regola di conservazione. IP, email e nomi sono dati personali: serve un tempo massimo per ogni tipo di log.
12. Non sappiamo come è avviato il sito sul VPS (pm2, systemd o altro): da questo dipende dove salvare i log tecnici e come farli ruotare.

## 3. Soluzione: tre registri separati

### A. Registro del contratto (resta com'è)
- Allegato al PDF e conservato per tutta la vita del contratto: è la prova della firma.
- Unica aggiunta: l'evento "PDF scaricato da un operatore" (punto 9).

### B. Nuovo registro attività per azienda
- Nuova tabella (es. `activity_logs`): azienda, utente (se c'è), azione, oggetto (utente, modello, impostazioni, contratto), IP, browser, dettagli, data e ora. Lo schema si crea con SQL idempotente all'avvio, **senza `db:push`**.
- Registra tutto quanto elencato ai punti 4–8.
- Per le modifiche (modelli, impostazioni) salva **cosa è cambiato** (campo: prima → dopo), mai password o chiavi: per quelle solo "modificata".
- **Pagina "Attività"** nel gestionale:
  - l'admin vede solo le attività della propria azienda;
  - si filtra per utente, tipo di azione e periodo;
  - si esporta in CSV.

  Il proprietario vede tutte le aziende.
- **Avvisi:**
  - più di N accessi falliti di fila sullo stesso utente → email all'admin dell'azienda;
  - email al cliente non recapitata → email all'operatore che ha inviato il contratto.

### C. Log tecnici ordinati
- Un unico modulo di log (es. `server/services/logger.ts`) al posto dei `console.log` sparsi:
  - livello (info, avviso, errore), data e ora, azienda, contratto e richiesta;
  - una riga per evento, leggibile e facile da cercare.
- **Mai nei log:** codici di verifica, password, chiavi, firme, testo dei contratti, corpo delle richieste. Le email si mascherano (es. `m***@gmail.com`) e i telefoni pure.
- Il registro delle richieste non stampa più il contenuto delle risposte: solo metodo, percorso, esito e durata.
- Il gestore degli errori registra l'errore con un identificativo e risponde all'utente con un messaggio chiaro che contiene quell'identificativo, senza rilanciare.
- Sul VPS: file di log con rotazione automatica (si cancellano dopo 90 giorni). Il come dipende dal punto 12.
- **Email al proprietario per gli errori gravi:**
  - PDF non generato;
  - codice di verifica non spedito;
  - firma non completata per errore del server;
  - server riavviato dopo un crash.

  Gli avvisi uguali vanno raggruppati, per non ricevere 100 email per lo stesso problema.

### Conservazione (proposta, da confermare)
| Registro | Durata |
|---|---|
| Registro del contratto | per tutta la vita del contratto (prova legale) |
| Registro attività | 24 mesi, poi cancellazione automatica |
| Log tecnici | 90 giorni |

## 4. Lavori da fare

### Fase 1 — Sicurezza (subito)
- [ ] Togliere dai log codici di verifica, firme, corpo delle richieste ed email in chiaro (punti 1–2).
- [ ] Registro delle richieste senza contenuto delle risposte.
- [ ] Test automatico che fallisce se nei log compare un codice di verifica durante un invio di prova.

### Fase 2 — Log tecnici
- [ ] Modulo di log unico; sostituire i `console.*` del server.
- [ ] Gestore errori con identificativo, senza rilanciare.
- [ ] Email al proprietario per gli errori gravi, con raggruppamento.
- [ ] Configurazione sul VPS: file e rotazione (dopo aver saputo come è avviato il sito).

### Fase 3 — Registro attività
- [ ] Tabella e funzione unica `registraAttività(...)`.
- [ ] Eventi: accessi, utenti, modelli, impostazioni, download PDF, errori di invio.
- [ ] Pagina "Attività" per l'admin (solo la sua azienda), con filtri ed export CSV.
- [ ] Avvisi: accessi falliti ripetuti, email non recapitate.
- [ ] Cancellazione automatica oltre il periodo di conservazione.

### Fase 4 — Test
- [ ] Ogni azione dei punti 4–9 produce una riga nel registro attività con l'azienda giusta.
- [ ] L'admin dell'azienda B non vede le attività dell'azienda A.
- [ ] Nessun dato riservato nei log durante il giro completo: invio, codice di verifica, firma, PDF.
- [ ] Test su aziende e utenti di prova dedicati, che si ripuliscono da soli.

## 5. Da chiedere al proprietario
- Come è avviato il sito sul VPS: basta l'output di `pm2 list` (o di `systemctl status` con il nome del servizio).
- A quale email mandare gli avvisi degli errori gravi.
- Conferma dei tempi di conservazione proposti.

## 6. Legami con altre task
- **001:** i nuovi eventi (cambio/recupero password, disattivazione utenti, notifica di firma all'operatore) devono scrivere nel registro attività. Conviene fare la Fase 1 di questa task prima di tutto e la Fase 3 insieme alla Fase A della 001.
- **002 (fatta):** il registro del contratto e il PDF non cambiano, salvo l'evento "PDF scaricato".
