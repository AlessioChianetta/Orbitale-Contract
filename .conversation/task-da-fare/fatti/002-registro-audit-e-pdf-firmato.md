# 002 — Registro audit e PDF firmato: dati veritieri e impaginazione

**Stato:** FATTA il 16/10/2026 (codice, test automatici, PDF e pagina cliente unificati). Le verifiche rimaste (prova end-to-end, aggiornamento del VPS, PDF reale con "WhatsApp") sono passate nella task 001, Fase D.
**Priorità:** alta: il PDF firmato è il documento legale che arriva al cliente. Va fatta prima della consegna alla prima cliente (task 001).
**Segnalazione del proprietario:** nel PDF inviato via email "è tutto sfasato e colorato, con dati non veritieri (es. firma via email ma risulta WhatsApp)".

---

## 1. Come vengono generati i dati oggi

- Tabella `audit_logs`: una riga per evento (`action`, `ip_address`, `user_agent`, `metadata` JSON, `timestamp`). Scritta dalle rotte del server (creazione, invio, apertura del link, invio OTP, tentativo OTP fallito, firma, archiviazione, rigenerazioni…).
- Alla firma (`POST /api/client/contracts/:code/sign`) il server:
  1. verifica l'OTP;
  2. ricava il canale reale dall'ultimo `otp_sent` (`twilioVerify` true = SMS, false = email);
  3. prepara in memoria l'evento "Firmato" e genera il PDF (Puppeteer) con contratto + **tutti** i log del contratto;
  4. salva stato, PDF e log; poi invia l'email "Contratto firmato" con il PDF allegato **e un WhatsApp di congratulazioni** dal numero Twilio del proprietario.
- Il PDF = documento (`generateClientViewIdenticalHtml`) + pagina "REGISTRO AUDIT DIGITALE" (`generateAuditTrailHtml`) in `server/services/pdf-generator-new.ts`.

## 2. Verifica fatta

- PDF di prova generato con il codice ATTUALE e dati di esempio (OTP via email): il canale risulta corretto ("Verifica OTP via Email", contatto verificato = email) e la tabella non esce più dal margine.
- PDF storico in `generated-pdfs/` (luglio 2026, codice precedente): colonna dettagli **tagliata sul bordo destro**, **JSON grezzo** stampato (`client_data_completed`), **"Telefono verificato: 333…" con firma via email**: esattamente il tipo di errore segnalato.
- **Nel codice attuale il registro audit non scrive mai "WhatsApp".** Ipotesi da verificare:
  a) il VPS gira con una versione vecchia del codice (i PDF storici mostrano diciture che nel codice attuale non esistono più);
  b) il "WhatsApp" è il messaggio di congratulazioni che parte a ogni firma (punto 3.2), non il PDF.
  → Serve il PDF reale ricevuto dal cliente e la versione (`git log -1`) presente sul VPS.

## 3. Problemi trovati

### 3.1 Dati non veritieri o fuorvianti
1. **"Documento visualizzato dal cliente" anche quando apre il venditore/admin.** Ogni apertura di `/client/:code` crea un log `viewed` (filtro solo stesso IP entro 5 minuti), anche da utenti loggati. Nel DB di Replit ci sono contratti con 136 "visualizzazioni": il registro diventa di decine di righe, quasi tutte del venditore.
2. **IP falsificabile.** `getRealClientIP` usa il primo valore di `X-Forwarded-For` inviato dal browser: un firmatario può scrivere l'IP che vuole. Va usato `req.ip` con `trust proxy` corretto per il VPS (nginx).
3. **"La manomissione di questo documento è tecnicamente rilevabile"**: falso. Non si salva nessuna impronta (hash) del PDF né del contenuto firmato e il PDF non ha firma digitale.
4. **Email "Contratto firmato"** dichiara "Firma elettronica avanzata" e "Conformità: Standard eIDAS": OTP + firma grafica è una firma elettronica (semplice). L'orario è quello dell'invio email, nel fuso del server (UTC sul VPS), non quello della firma.
5. **Email di richiesta firma** dice "Confermare il tuo numero di telefono" anche quando l'OTP arriva via email.
6. **"Mittente: Utente ID: 1"**: nel registro compare l'id interno invece del nome di chi ha inviato.
7. **"NOME FILE FINALE: contract_X_signed.pdf"** non corrisponde al file reale; "GENERATO IL" cambia a ogni rigenerazione.
8. **Rigenerazione PDF dopo la firma** (`regenerate-pdf`, `regenerate-content`, modifica manuale) ricrea il registro con TUTTI i log, compresi quelli successivi alla firma (archiviazioni, visualizzazioni del venditore): il "documento firmato" cambia nel tempo.
9. **Eliminazione contratti** cancella anche i log di audit (`bulk-delete`): la prova sparisce.

### 3.2 Messaggi con identità sbagliata
10. **WhatsApp di congratulazioni a ogni firma** con le credenziali Twilio globali del proprietario e testo fisso ("Riceverai una copia via email…"), per qualsiasi azienda.

### 3.3 Impaginazione ("sfasato e colorato")
11. Emoji nei dettagli (📧 👁️ ✅ 📱 …) stampate come **quadratini** (font mancante nel Chromium del server).
12. Registro molto colorato (fascia blu, badge verdi/arancio, box giallo): poco adatto a un documento legale; si stampa male in bianco e nero.
13. Colonna "Data e ora" larga con `(Europe/Rome)` ripetuto e testo a capo nei dettagli: righe lunghe e poco leggibili.
14. Font caricato da Google Fonts a runtime: se la rete del server è lenta il PDF cambia carattere.
15. Il registro è concatenato DOPO la chiusura `</html>` del documento (HTML non valido: funziona per tolleranza del browser).
16. Fallback con dati del proprietario ("ALE srl, Capo D'Orlando") se mancano le impostazioni azienda.

## 4. Lavori da fare

### A — Dati veritieri
- [x] Non registrare `viewed` per utenti autenticati (admin/venditore) né dopo la firma; tenere al massimo 1 visualizzazione per IP ogni 30 minuti.
- [x] Nel PDF mostrare solo gli eventi fino alla firma; le visualizzazioni consecutive dello stesso IP raggruppate ("Documento aperto 4 volte tra le 10:02 e le 10:40").
- [x] IP: `req.ip` con `trust proxy` configurato per il VPS; niente header inviati dal browser.
- [x] Alla firma salvare l'hash SHA-256 del contenuto firmato e del PDF (log `signed` + colonna sul contratto) e stamparlo nel registro; dicitura legale aggiornata di conseguenza.
- [x] Rigenerazioni dopo la firma: conservare il PDF originale, generare una copia separata e marcata, registro "congelato" alla firma.
- [x] Eliminazione contratti firmati: vietata, oppure solo archiviazione (i log restano).
- [x] Email "Contratto firmato": rimuovere "avanzata"/"eIDAS", data e ora della firma in Europe/Rome.
- [x] Email di richiesta firma: testo coerente con il canale OTP dell'azienda.
- [x] "Mittente": nome e email dell'utente, non l'id.

### B — WhatsApp
- [x] WhatsApp post-firma per-azienda e spento di default (coordinato con task 001, punto 3).

### C — Impaginazione sobria
- [x] Registro in bianco/nero/grigio, senza emoji, tabella a larghezza fissa (Operazione · Data/ora · Dettagli), fuso orario indicato una volta nell'intestazione.
- [x] Font incorporato localmente (niente Google Fonts a runtime).
- [x] Un unico documento HTML valido (registro dentro `<body>`).
- [x] Nessun dato di riserva del proprietario: errore se mancano le impostazioni azienda.

### D — Test
- [x] Test automatici sulla funzione del registro: OTP via email, OTP via SMS, log storici ambigui (canale "non registrato"), nessuna parola "WhatsApp"/"SMS" quando il canale è email, nessun JSON grezzo, nessuna emoji.
- [x] Generazione PDF di prova (dati finti) + controllo testo estratto (`pdftotext`) e immagine dell'ultima pagina.
- [ ] Prova end-to-end su DB di test: invio → apertura → OTP email → firma → email con PDF allegato.

## 5. Da chiedere al proprietario
- Il PDF reale in cui compare "WhatsApp" (anche con dati oscurati).
- La versione del codice sul VPS (`git log -1 --oneline`).

## 6. Avanzamento (aggiornato al 16/10/2026)

### Fatto
- **Registro nel PDF riscritto** in `server/services/audit-trail.ts` (modulo puro, testabile). `pdf-generator-new.ts` lo inserisce dentro il `<body>` del documento.
  - Bianco/nero/grigio, nessuna emoji, tabella a larghezza fissa (24% / 16% / 60%) con a capo forzato: niente più testo tagliato sul bordo.
  - Stampa solo gli eventi **fino alla firma inclusa**. Le aperture consecutive dallo stesso IP diventano una riga ("Aperto N volte…").
  - Canale OTP con le regole di `.agents/memory/otp-audit-truth.md`. Se un dato non c'è, scrive "non registrato".
  - Chi ha inviato il contratto compare con nome ed email, non più "Utente ID".
  - Rimossi il nome "Turbo Contract" e la frase falsa "manomissione tecnicamente rilevabile". Ora viene stampata l'impronta SHA-256 del testo firmato.
- **Alla firma** (`POST /api/client/contracts/:code/sign`):
  - il log `signed` contiene `contentSha256` (testo firmato), `pdfSha256` e `pdfFile` (file PDF originale; l'impronta del PDF sta solo nel DB);
  - la data accanto alla firma nel PDF è quella della firma, non quella di generazione.
- **Aperture del link**:
  - non registrate se chi apre è loggato (admin/venditore) né dopo la firma;
  - al massimo 1 riga ogni 30 minuti per IP.
- **IP**: `server/services/client-ip.ts` usa `req.ip` (con `trust proxy` = 1 in `server/auth.ts`). Prima si leggeva X-Forwarded-For grezzo, che il browser può falsificare.
- **Contratti firmati**:
  - testo non modificabile: `PATCH /content` → 409 e voce "Modifica documento" nascosta;
  - non eliminabili: `bulk-delete` li salta e lo dice nel messaggio;
  - `regenerate-pdf` scrive il log `pdf_regenerated` con il file precedente, che resta su disco;
  - `regenerate-content` salva `previousPdfFile`.
- **PDF**:
  - font Inter incorporato da `@fontsource/inter`, niente Google Fonts;
  - nessun dato di riserva "ALE srl / Capo D'Orlando": se mancano le impostazioni azienda viene generato un errore esplicito;
  - le righe dell'intestazione vuote vengono omesse.
- **Email**:
  - "Contratto firmato": tolti "Firma elettronica avanzata" ed "eIDAS"; data e ora della firma in ora italiana; la frase "in allegato" compare solo se il PDF è davvero allegato;
  - "Richiesta firma": il testo segue il canale OTP dell'azienda (email o SMS).
- **WhatsApp dopo la firma**: parte SOLO se l'azienda ha nelle sue impostazioni Account SID, Auth Token e "WhatsApp From". Le credenziali globali del `.env` non vengono più usate. Messaggio senza emoji, con il nome dell'azienda.
- **Test**:
  - `npm test`: 13 test unitari in `tests/audit-trail.test.ts`, senza DB;
  - `npm run test:pdf`: genera un PDF vero con dati finti in `generated-artifacts/pdf-audit-smoke.pdf` e lo controlla con `pdftotext`/`pdffonts`.
  - Entrambi passano.

### Da fare
- [ ] Prova end-to-end su azienda di test (invio → apertura → OTP email → firma → email con PDF), con SMTP di test.
- [ ] **VPS**:
  - aggiornare il codice e lanciare `npm install` (nuova dipendenza `@fontsource/inter`);
  - verificare che nginx passi `X-Forwarded-For` (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`). Se davanti a nginx c'è anche Cloudflare, `trust proxy` va portato a 2.
- [ ] **VPS, solo se il proprietario vuole continuare a ricevere il WhatsApp di conferma**: inserire nelle impostazioni della sua azienda il mittente "WhatsApp From". Nota: nella UI i campi Twilio sono visibili solo con metodo OTP "twilio" (da rivedere in task 001).
- [ ] Analizzare il PDF reale con "WhatsApp" segnalato dal proprietario e la versione del codice sul VPS (`git log -1 --oneline`).
- [x] Grafica del PDF rifatta (16/10/2026, richiesta del proprietario: "più professionale, stile Apple"): palette neutra, sezioni numerate, dati anagrafici a etichetta + valore, piano pagamenti in tabella, linea firma, piè di pagina "Pagina X di Y". Il testo resta identico alla pagina cliente: cambia solo la grafica. Anteprima di un contratto reale: `npx tsx --require ./server/loadEnv.cjs scripts/pdf-preview.ts <id>`.
- [x] Pagina cliente e PDF unificati alla radice (16/10/2026, regola del proprietario: "devono sempre essere uguali, mai distinte"). Il documento (testo + grafica) è generato da un solo file, `shared/contract-document.ts`, usato da PDF, pagina di firma `/client/:codice` e anteprime del gestionale. La pagina web aggiunge solo cornice, indice e area firma cliccabile. La pagina pubblica ora riceve gli stessi dati del PDF (titolo, contenuto personalizzato, condizioni di pagamento, bonus, codice univoco azienda). Tolte dalla pagina le diciture false su eIDAS. Il test `tests/contract-document.test.ts` fallisce se qualcuno ricopia il documento altrove.
- [ ] La clausola di autorinnovo è sempre stampata: da sistemare nella task 001, insieme alla pagina cliente.
