# 001 — Onboarding della prima cliente (multi-tenant reale)

**Cliente:** evigliano.counseling@gmail.com (studio di counseling)
**Stato:** in corso — Fasi A e B (tranne l'HTML della cliente) completate il 20/10/2026 (vedi §8 Avanzamento). Analisi del 16/10/2026, rivista lo stesso giorno: vedi §2b
**Obiettivo:** la cliente entra con il suo account admin, trova il SUO contratto (preparato una tantum dal proprietario in HTML), crea gli account per sé e per i dipendenti, e chiunque di loro compila e invia il contratto al cliente finale, che lo firma con OTP. Tutto deve essere isolato dai dati del proprietario, con mittente email e SMS della cliente e senza errori in fase di invio.

**Fuori scope (fase successiva):** accesso automatico dall'app esterna in cui questa è incorporata (SSO / login automatico). Vedi sezione 7.

---

## 1. Situazione attuale (cosa c'è già)

La base multi-tenant esiste ed è in buona parte corretta:

- Ogni utente ha una `company_id`; template e contratti sono isolati tramite il creatore/venditore (join su `users.company_id`).
- Ruoli: `admin` (gestisce template, impostazioni, utenti) e `seller` (vede e gestisce solo i propri contratti).
- L'admin crea utenti della propria azienda da **Gestione utenti** (`POST /api/admin/create-user`).
- Email transazionali **per azienda**: SMTP configurato in **Impostazioni Azienda → Configurazione Email** (host, porta, utente, password, mittente). Invio contratto, OTP, notifica firma, avviso blocco OTP e link di co-compilazione usano già le credenziali dell'azienda giusta.
- OTP di firma **per azienda**: `otp_method` = `email` oppure `twilio` con credenziali Twilio Verify salvate nelle impostazioni azienda.
- Tutte le rotte dei contratti (lettura, modifica, archivio, PDF, rigenerazione, invio massivo, cronologia) controllano azienda e proprietario.
- Intestazione documento/PDF presa dai dati azienda (ragione sociale, P.IVA, logo, titolo).

## 2. Problemi trovati (da correggere PRIMA di far entrare la cliente)

### Bloccanti — sicurezza e isolamento
1. **Modifica/eliminazione template senza controllo azienda.** `PUT /api/templates/:id` e `DELETE /api/templates/:id` agiscono su qualunque id: un admin della cliente potrebbe modificare o cancellare i template del proprietario (e viceversa). Va aggiunto il filtro azienda in rotta e in `storage.updateTemplate/deleteTemplate`.
2. **I template del proprietario vengono creati in automatico in ogni azienda.** `getTemplates` lancia `ensureOrbitalTemplate` e `ensureProcacciatoreTemplate` per qualsiasi azienda: al primo accesso la cliente si troverebbe "Sistema Orbitale" e "Contratto Procacciatore" (contratti del proprietario). Va limitato all'azienda del proprietario (flag su `company_settings` o elenco esplicito).
3. **WhatsApp dopo la firma inviato dal numero del proprietario.** `sendCongratulationsWhatsApp` usa sempre le credenziali Twilio globali (`.env`) con testo fisso: ogni cliente della counselor che firma riceverebbe un WhatsApp dal numero del proprietario. Va reso per-azienda e disattivato di default per le nuove aziende. **RISOLTO in task 002**: ora parte solo con le credenziali Twilio dell'azienda stessa.
4. **Registrazione pubblica aperta.** `/api/register` e la scheda "Registrati" permettono a chiunque di creare un'azienda. Le aziende le crea il proprietario: va disattivata (o protetta da un ruolo "super admin").
5. **Ricaduta sui dati della prima azienda.** `storage.getCompanySettings(undefined)` restituisce la PRIMA azienda del DB. Se il venditore di un contratto viene eliminato, la firma e il PDF usano intestazione e impostazioni del proprietario. La funzione deve fallire in modo esplicito senza `companyId`.
6. **Eliminazione utenti.** Eliminare un dipendente con contratti li rende "orfani" (spariscono dalla dashboard e, per il punto 5, prendono i dati del proprietario). Eliminare un admin che ha creato template genera un errore 500 (chiave esterna). Sostituire con **disattivazione** dell'utente (login bloccato, contratti visibili all'admin) o riassegnazione dei contratti.

### Importanti — il contratto della cliente
7. **Clausola di autorinnovo sempre stampata.** Documento web e PDF mostrano "CLAUSOLA DI AUTORINNOVO" (rinnovo tacito di N mesi) per ogni contratto cliente, anche con autorinnovo disattivato. Va mostrata solo se attivo (il campo `autoRenewal` del contratto esiste già ma il documento lo ignora). Dalla task 002 pagina e PDF escono da `shared/contract-document.ts`: la correzione si fa una volta sola lì.
8. **Wizard.** Decisione del proprietario: il contratto della cliente usa le stesse impostazioni standard (prezzo, durata, rate, bonus, autorinnovo) — nessun "modulo semplice" per ora. Clienti finali sia privati sia aziende: verificare che il percorso "privato" (tipo_cliente) funzioni end-to-end, senza campi aziendali obbligatori. **Il documento oggi NON gestisce il privato: vedi §2b punto 17.**
9. **Blocchi fissi del documento** (bonus, piano pagamenti, validità, dichiarazioni) vanno verificati sul contratto di counseling e resi condizionali dove non servono.

### Robustezza invio (obiettivo "nessun bug sull'invio")
10. Creazione utente: username ed email sono unici **a livello globale**, ma il controllo è fatto solo dentro l'azienda → in caso di duplicato tra aziende si ottiene un 500 invece di un messaggio chiaro.
11. Singleton Twilio condiviso tra aziende (`twilioVerifyService` viene re-inizializzato a ogni chiamata con le credenziali dell'azienda). Oggi funziona perché init e chiamata avvengono nello stesso tick, ma è fragile: creare un client per chiamata.
12. Il link di firma nelle email usa `BASE_URL` (dominio del proprietario) per tutte le aziende: accettabile, ma da confermare.
13. Manca un modo per l'utente di cambiare la propria password (c'è solo creazione/eliminazione da parte dell'admin).

### Ambiente — rischi operativi (da sapere)
14. Il sito pubblicato usa un database **separato** (confermato dal proprietario). Il DB collegato a Replit è comunque un Supabase con dati storici realistici: i test automatici usano aziende/utenti di prova dedicati, SMTP/Twilio simulati e si ripuliscono da soli. L'account della cliente va creato sul DB di produzione (script idempotente da lanciare sul VPS, non a mano qui).
15. **`scripts/post-merge.sh` esegue `npm run db:push -- --force`** su quel database. Le colonne `contracts.first_opened_at`, `last_activity_at`, `total_presence_ms` non sono in `shared/schema.ts`: un push forzato le cancellerebbe. Rimuovere il push forzato dallo script (o aggiungere le colonne allo schema).
16b. Il generatore PDF, se mancano le impostazioni azienda, usa dati di riserva del proprietario ("ALE srl, Capo D'Orlando"): va eliminato il fallback e generato un errore esplicito. **RISOLTO in task 002.**
16. Nel repository git sono presenti dump del database (`DATABASE/*.sql`) e `cookies.txt` con dati personali dei clienti: da rimuovere dal tracciamento.

## 2b. Revisione del 16/10/2026 — cosa mancava

Ricontrollando codice e flusso dopo la task 002 sono emersi questi punti, non presenti nell'analisi iniziale.

### Bloccanti per il contratto di counseling
17. **Cliente privato stampato come azienda.** Il form permette "privato", ma il documento (pagina e PDF) mostra sempre la tabella aziendale: Società, PEC, codice univoco, REA, "in persona del suo legale rappresentante". I clienti di una counselor sono quasi tutti persone fisiche. Serve una variante "Dati del cliente" per il privato (nome e cognome, codice fiscale, nato a / il, residenza, email, cellulare), scelta da `tipo_cliente`.
18. **Numero contratto globale.** "Contratto n. 103" è il numero interno del database, condiviso tra tutte le aziende: il primo contratto della cliente uscirebbe con un numero alto e lascerebbe intuire quanti contratti fanno le altre aziende. Serve una numerazione per azienda (es. 2026-0001), usata in pagina, PDF ed email.
19. **Blocco "Modello di partnership" con testo fisso da ristorante** ("vendite di cibo e bevande", "catering e delivery"). Compare solo se si attiva la partnership a percentuale, ma per altre aziende è sbagliato: va tolto il testo fisso o reso testo del template.
20. **Informativa privacy assente.** Il cliente deve spuntare "Accetto l'informativa sulla privacy", ma l'informativa non viene mostrata da nessuna parte. Titolare del trattamento è l'azienda della cliente: serve un testo (o link) per azienda nelle Impostazioni, visibile sulla pagina di firma e citato nel registro delle operazioni. Il consenso "comunicazioni commerciali" va reso attivabile/disattivabile per azienda.

### Importanti
21. **Marchio del proprietario visto dai clienti finali.** La scheda del browser sulla pagina di firma si chiama "TurboContract" e il nome di riserva delle email è "Turbo Contract". Il dominio dei link resta quello del proprietario (punto 12, accettato); un dominio personalizzato per azienda è un lavoro futuro.
22. **Editor template con strumenti del proprietario.** I pulsanti "Sistema Orbitale — Completo / Modulare" e la libreria relativa sono visibili a tutte le aziende.
23. **Nessuna notifica di firma all'operatore.** Quando il cliente firma, l'email con il PDF parte solo al cliente; la counselor e i dipendenti lo scoprono solo aprendo la dashboard.
24. **Password dimenticata.** Oltre al cambio password (punto 13) manca il recupero: un utente bloccato deve chiamare il proprietario.
25. **Gmail come mittente.** L'indirizzo della cliente è Gmail: per l'SMTP servono la verifica in due passaggi e una "password per le app"; Gmail invia al massimo circa 500 email al giorno e il mittente deve essere quell'indirizzo. Da sapere prima della configurazione.

### Da migliorare (non bloccanti)
26. **Pagina di firma:** i riquadri dei passaggi (arancioni/grigi, "Firma Richiesta nel Documento") hanno ancora la vecchia grafica; vanno allineati allo stile del documento.
27. **Creazione aziende.** Oggi ogni nuova azienda richiede uno script sul VPS. Per la prima cliente va bene; dalla seconda conviene un pannello del proprietario ("crea azienda + primo admin").
28. **File riservati nel repository:** confermato il 16/10/2026 che `DATABASE/*.sql` e `cookies.txt` sono ancora tracciati da git (punto 16).

### Ordine consigliato
Fase A (sicurezza) → punti 17, 18, 20 (documento e privacy) → Fase C (account, SMTP) → punti 21–25 → Fase D (test e prova reale) → consegna. I punti 26–27 dopo la consegna.

## 3. Lavori da fare

### Fase A — Isolamento e sicurezza (bloccante)
- [x] Filtro azienda su update/delete template (rotta + storage).
- [x] Seed automatico Orbitale/Procacciatore solo per l'azienda del proprietario.
- [x] WhatsApp post-firma per-azienda, spento di default per le nuove aziende (fatto in task 002). Campi WhatsApp visibili nelle impostazioni anche con OTP via email (20/10/2026).
- [x] Disattivare la registrazione pubblica.
- [x] `getCompanySettings` senza `companyId` → errore esplicito; nessuna ricaduta sulla prima azienda.
- [x] Utenti: disattivazione al posto dell'eliminazione; messaggi chiari su username/email duplicati.
- [x] Rimuovere `db:push --force` dal post-merge.

### Fase B — Contratto della cliente
- [ ] Il proprietario fornisce l'HTML del contratto di counseling con i placeholder `{{...}}`.
- [ ] Template caricato nell'azienda della cliente (categoria "Clienti").
- [x] Documento per cliente **privato** (punto 17).
- [x] Autorinnovo solo se attivo; blocco "partnership" senza testo del ristorante (punti 7, 9, 19). Tutto in `shared/contract-document.ts`.
- [x] Numerazione dei contratti per azienda (punto 18).
- [x] Informativa privacy dell'azienda sulla pagina di firma; consenso marketing attivabile per azienda (punto 20).
- [x] Nascondere gli strumenti "Sistema Orbitale" dell'editor template fuori dall'azienda del proprietario (punto 22).

### Fase C — Account e configurazione
- [x] (script pronto: `scripts/onboard-company.ts`; **da lanciare sul VPS dal proprietario**) Creare l'azienda della cliente con i suoi dati fiscali (ragione sociale, indirizzo, CF/P.IVA, PEC, codice univoco, logo).
- [x] (stesso script) Creare l'admin `evigliano.counseling@gmail.com` (password temporanea + cambio password al primo accesso).
- [ ] **Proprietario/cliente:** Predisporre la configurazione SMTP dell'azienda (casella da definire insieme al proprietario: la sezione Impostazioni Azienda → Configurazione Email è già pronta) e verificare con l'email di prova.
- [x] Canale OTP: **email** (lo imposta lo script) (decisione del proprietario). Twilio non usato per questa azienda.
- [x] Pagina "Cambia password" per tutti gli utenti e "Password dimenticata" via email (punto 24).
- [x] Email all'operatore (e all'admin) quando un cliente firma (punto 23).
- [x] Titolo della scheda del browser sulla pagina di firma = nome dell'azienda, non "TurboContract" (punto 21).
- [x] (indicazioni in Impostazioni Azienda quando l'indirizzo è Gmail) Se la cliente usa Gmail come mittente: verifica in due passaggi attiva + "password per le app"; limite di circa 500 email al giorno (punto 25).

### Fase D — Test
- [x] Test automatici di isolamento: un utente dell'azienda B non può leggere, modificare, eliminare, archiviare o scaricare template/contratti/PDF/impostazioni dell'azienda A (e viceversa); il dipendente vede solo i propri contratti.
- [x] (SMTP simulato; SMS non testato in rete: per questa azienda l'OTP è via email e il client Twilio ora si crea per azienda) Test del flusso di invio con SMTP e Twilio simulati: creazione → anteprima → invio email (mittente = azienda giusta) → apertura link → OTP (email e SMS) → firma → PDF → notifica firmato; nessun WhatsApp dal numero del proprietario.
- [x] Test con modalità "il cliente compila i propri dati".
- [ ] **Proprietario:** Prova reale end-to-end con una casella email di test prima della consegna alla cliente.
- [x] (automatico con contratto di prova; da ripetere con l'HTML vero) Contratto di prova con cliente **privato** e con cliente **azienda**: pagina e PDF corretti.
- [ ] **Proprietario:** Ereditato dalla task 002: aggiornare il VPS (`git pull`, `npm install`, riavvio) e controllare nginx; analizzare il PDF reale con "WhatsApp" segnalato dal proprietario insieme a `git log -1 --oneline` del VPS.
- [x] Tutti i test girano su aziende/utenti di prova dedicati e si ripuliscono da soli (il DB è quello reale).

## 4. Criteri di accettazione
- La cliente accede, vede solo il suo contratto e i suoi dati; il proprietario non vede i suoi e viceversa.
- La cliente crea un dipendente; il dipendente accede, compila e invia il contratto; il cliente finale riceve l'email dal mittente della cliente, firma con OTP e riceve il PDF firmato con l'intestazione della cliente.
- Nessun messaggio (email, SMS, WhatsApp) parte con identità o credenziali del proprietario.
- Suite di test verde.

## 5. Decisioni prese (16/10/2026)
- Email: casella da definire più avanti, intanto si predispone tutto.
- OTP di firma: via email.
- Clienti finali: sia privati sia aziende.
- Contratto: basato sulle impostazioni standard già esistenti; l'HTML arriverà dal proprietario.
- Database: quello del sito pubblicato è separato da quello di Replit.
- Correzioni a registro audit e PDF firmato: vedi task 002 (da fare prima della consegna).

## 6. Note tecniche
- Schema DB: niente `drizzle db:push`; modifiche con SQL idempotente all'avvio (stesso schema di `ensureTemplateCategorySchema`) + allineamento manuale di `shared/schema.ts`.
- `npm run check` ha errori preesistenti: valutare solo nuovi errori sui file toccati.

## 7. Fase successiva — accesso automatico dall'app esterna
L'app è incorporata in un'altra app. Oggi non c'è alcuna integrazione (nessun SSO, token o postMessage) e il cookie di sessione non ha `SameSite=None; Secure`, quindi in un iframe su un dominio diverso il login non viene mantenuto. Da progettare a parte: token firmato emesso dall'app esterna → login automatico qui, sincronizzazione degli account, impostazioni cookie per l'iframe.

## 8. Avanzamento

### 20/10/2026 — Fase A completata
- **Template:** modifica ed eliminazione agiscono solo sui template della propria azienda (altrimenti 404 "Template non trovato"). Non è più possibile spostare un template in un'altra azienda cambiando `createdBy`.
- **Azienda proprietaria:** nuova colonna `company_settings.is_owner`. Alla creazione della colonna il flag va all'azienda con l'id più basso (sul DB di Replit: id 1, "Orbitale di Chianetta Trovato Alessio"). Solo quell'azienda riceve i template Orbitale e Procacciatore. Il flag non è modificabile dalle Impostazioni Azienda. Servirà anche per il punto 22 (strumenti "Sistema Orbitale" nell'editor).
- **Registrazione pubblica rimossa:** niente rotta `/api/register`, niente scheda "Registra Azienda" nella pagina di accesso; la landing invita ad accedere. Le rotte `/api/...` inesistenti ora rispondono 404 JSON (prima il server restituiva la pagina HTML con 200).
- **`getCompanySettings`** senza `companyId` valido genera un errore esplicito. La firma di un contratto senza venditore viene bloccata con un messaggio chiaro invece di usare i dati di un'altra azienda.
- **Utenti:** nuova colonna `users.is_active`. In Gestione utenti il cestino è sostituito da "Disattiva"/"Riattiva": l'utente disattivato non può accedere (anche le sessioni già aperte decadono), i suoi contratti e template restano all'azienda. Non si può disattivare il proprio account. La vecchia rotta di eliminazione non esiste più.
- **Creazione utenti:** username ed email controllati su tutta la piattaforma, con messaggi in italiano ("Username già in uso", "Email già associata a un altro account") invece dell'errore 500. Il login mostra "Username o password non corretti" o "Account disattivato".
- **Post-merge:** `scripts/post-merge.sh` esegue solo `npm install`.
- **Migrazione:** `server/tenant-schema.ts`, eseguita all'avvio prima delle rotte (idempotente). Sul VPS parte da sola dopo `git pull` + riavvio. **Da verificare sul VPS** che l'azienda con id più basso sia quella del proprietario: `SELECT id, company_name, is_owner FROM company_settings ORDER BY id;`
- **Test:** `tests/tenant-isolation.test.ts` (aziende e utenti di prova, si ripulisce da solo). `npm test` e `npm run test:pdf` verdi. Verificate anche via HTTP: modifica/eliminazione template tra aziende, disattivazione tra aziende, sessione e login dell'utente disattivato, duplicati.


### 20/10/2026 — Fase B completata (manca solo l'HTML del contratto della cliente)
- **Contratti già esistenti invariati:** nuova colonna `contracts.document_layout`. Alla sua creazione tutti i contratti esistenti ricevono 1 e continuano a essere resi esattamente come prima (autorinnovo sempre stampato, privato come azienda, "+ IVA" fisso). Motivo: sul DB di Replit 21 contratti firmati hanno `auto_renewal = false` ma riportano la clausola, 5 contratti firmati di privati sono stati stampati come azienda. I nuovi contratti hanno 2 (regole sotto).
- **Cliente privato (punto 17):** sezione "Dati del cliente" con nome e cognome, codice fiscale, nato/a a, data di nascita, residenza, email, cellulare; firma "Firma del Cliente". Niente società, PEC, codice univoco, REA, legale rappresentante. Anche le email salutano la persona (nome e cognome del privato, referente per l'azienda).
- **Autorinnovo (7, 9):** nel form c'è la casella "Rinnovo automatico" (al posto della frase "Tutti i contratti si rinnovano automaticamente"); la clausola si stampa solo se attiva. Il form inviava sempre `autoRenewal: true` al controllo di anteprima: corretto.
- **Partnership (19):** il testo da ristorante resta solo per l'azienda proprietaria; le altre hanno un testo generico ("Compenso: X% del fatturato…").
- **Dicitura IVA:** Impostazioni Azienda → "Contratto e privacy": "+ IVA", "IVA inclusa" o nessuna dicitura (utile per forfettari/prestazioni esenti).
- **Numerazione (18):** `contracts.contract_number` + tabella `company_contract_counters`. Numero per azienda e anno (es. 2026-0001) assegnato in transazione alla creazione (contratti creati insieme non si sovrappongono; un inserimento fallito non consuma il numero). Usato in pagina, PDF (titolo, piè di pagina, registro), email di richiesta firma e di contratto firmato, nome dell'allegato. I contratti storici mostrano ancora l'id, come già stampato. Un contratto eliminato lascia un buco nella numerazione.
- **Informativa privacy (20):** in Impostazioni Azienda testo e/o link dell'informativa (avviso se mancano entrambi) e casella "Chiedi il consenso alle comunicazioni commerciali". Sulla pagina di firma "informativa sulla privacy" apre il testo (titolare = azienda) o il link. Il server rifiuta la firma senza consenso privacy (400). Alla firma si registrano link e impronta SHA-256 del testo dell'informativa e, solo se richiesto, il consenso commerciale; il registro delle operazioni li stampa (solo per le firme nuove).
- **Editor template (22):** "Parti da un modello pronto" (Partnership, Sistema Orbitale, Procacciatore) visibile solo all'azienda proprietaria; esempi delle sezioni resi neutri.
- **Test:** `tests/contract-document.test.ts` (privato, impaginazione storica, autorinnovo, IVA, numero, partnership) e `tests/contract-numbering.test.ts` (numeri concorrenti, per azienda, inserimento fallito). `npm test` e `npm run test:pdf` verdi.

### 20/10/2026 — Fasi C e D completate (lato sviluppo)
- **Password (24):** "Cambia password" (icona chiave accanto a "Esci" nelle dashboard, pagina `/cambia-password`) e "Password dimenticata?" nella pagina di accesso (`/password-dimenticata` → email con link a `/reimposta-password`, valido 1 ora, monouso, massimo 3 richieste all'ora; del link si salva solo l'impronta). La risposta alla richiesta è sempre la stessa, che l'account esista o no. L'email parte dall'SMTP dell'azienda dell'utente. Dopo il cambio le altre sessioni aperte si chiudono. Minimo 8 caratteri.
- **Password temporanea:** gli utenti creati dall'admin (e l'admin creato dallo script) devono cambiarla al primo accesso: finché non lo fanno il server rifiuta ogni altra richiesta (403) e la pagina li porta su "Cambia password".
- **Avviso firma all'operatore (23):** quando il cliente firma, il venditore che ha inviato il contratto e gli admin attivi della sua azienda ricevono un'email con il PDF firmato, dal mittente dell'azienda. Non rallenta la firma; se fallisce resta nel registro del contratto.
- **Scheda del browser (21):** pagina di firma e di compilazione mostrano il nome dell'azienda; i testi di riserva non dicono più "TurboContract".
- **Gmail (25):** in Impostazioni Azienda → Configurazione Email, se l'indirizzo è Gmail compaiono server/porta, "password per le app" con verifica in due passaggi e limite di circa 500 email al giorno.
- **SMS (Twilio):** il client si crea a ogni invio con le credenziali dell'azienda del contratto (prima un'istanza condivisa poteva usare le credenziali di un'altra azienda in caso di invii contemporanei). Le credenziali globali del server valgono solo per l'azienda proprietaria. Tolto dal log il codice OTP in chiaro della verifica SMS.
- **Script per il VPS:** `scripts/onboard-company.ts` + esempio `scripts/onboard-company.example.json`. Crea o aggiorna azienda (dati fiscali, logo, informativa privacy, dicitura IVA), admin con password temporanea (stampata una sola volta), OTP via email, template dal file HTML (categoria "Clienti"). Rilanciabile senza doppioni; `--dry-run` per provare; elenca i segnaposto `{{...}}` trovati nell'HTML; rifiuta un'email che appartiene all'azienda del proprietario.
- **Correzioni trovate dai test:**
  - Co-compilazione: un utente poteva creare una bozza su un template di un'altra azienda passando il suo id. Ora 403.
  - "Il cliente compila i propri dati": l'invio singolo veniva bloccato se il testo usava i segnaposto anagrafici che il cliente deve ancora compilare, e il controllo dell'anteprima risultava "cambiato" quando mancava il tipo cliente. Ora l'invio passa; prima di mandare il codice di firma si verifica che nel testo non resti nessun `{{...}}` (altrimenti si chiede al cliente di completare quei campi).
- **Test nuovi:** `tenant-isolation-routes` (rotte HTTP con due aziende: liste, letture e scritture per id, operazioni in blocco, impostazioni, utenti, preset, co-compilazione; venditore vede solo i suoi contratti; utente disattivato perde la sessione), `send-sign-flow` (SMTP simulato: invio dal mittente giusto, OTP via email, firma senza privacy rifiutata, PDF, avvisi a cliente e operatori, nessun WhatsApp, privato/azienda, cliente compila), `password`, `onboarding`. `npm test` 52/52, `npm run test:pdf` OK.
- **Repository:** i dump `DATABASE/*.sql` e `cookies.txt` non sono più tracciati da git (restano sul disco, ignorati).

**Restano al proprietario:**
1. Inviare l'HTML del contratto di counseling (o lanciare lo script con il suo percorso).
2. Sul VPS: `git pull`, `npm install`, `npm run build`, riavvio; controllare `SELECT id, company_name, is_owner FROM company_settings ORDER BY id;` (deve risultare proprietaria solo la sua azienda).
3. Sul VPS: preparare il file JSON (dati fiscali della cliente) e lanciare `npx tsx --require ./server/loadEnv.cjs scripts/onboard-company.ts <file.json> --dry-run`, poi senza `--dry-run`; comunicare alla cliente username e password temporanea.
4. Con la cliente: configurare la casella email in Impostazioni Azienda e inviare l'email di prova.
5. Prova reale end-to-end con una casella di test (contratto privato e azienda) prima di consegnare.


### 20/10/2026 — Contratti della cliente (Elvira Vigliano – TALES&TONGUES)
La cliente ha mandato il suo contratto di collaborazione (Punti di Vista) e la nota di revisione. Non è counseling: è consulenza per lo sviluppo commerciale internazionale. Nessun template di counseling è stato inventato.
- **Due template** in `scripts/onboarding/vigliano/`, generalizzati dal contratto (niente riferimenti a Punti di Vista, UAE/UK, Montaji, SCPN; "Metodo TALES" senza ®):
  1. *Collaborazione sviluppo commerciale internazionale (3 mesi)*: testo completo, 3 fasi, Allegati A e B, approvazione specifica.
  2. *Analisi preliminare di mercato (1 mese)*: solo la prima fase, consegna di analisi/shortlist/report.
  Ognuno ha un **preset** condiviso ("Percorso export 3 mesi": 1.500 € + IVA, 3 mesi, senza rinnovo; "Analisi preliminare 1 mese": 1 mese, senza rinnovo, prezzo da inserire).
- **Dati specifici del contratto (`{{var_*}}`):** variabili libere decise da chi scrive il template (es. mercati, attività dell'azienda). Il form mostra un campo per ciascuna ("Dati specifici del contratto"); etichetta e tipo si dichiarano con `<!-- VAR var_x | Etichetta | testo lungo | suggerimento -->`. Un campo vuoto blocca l'invio. Nuovo segnaposto `{{prezzo_totale_eur}}` ("EUR 1500,00"). La sezione "Variabili contratto" (canone, attivazione, livello) compare solo se il template le usa.
- **Seconda firma per le clausole (artt. 1341-1342 c.c.):** il testo tra `<!-- APPROVAZIONE_SPECIFICA -->` e `<!-- /APPROVAZIONE_SPECIFICA -->` diventa una sezione dopo la firma, con un secondo riquadro firma. Senza quella firma il server rifiuta (400) e il codice OTP non si consuma; il registro segna `specificApproval`. I contratti senza il blocco restano identici.
- **Rate in base alla durata:** sotto i 12 mesi il numero di rate segue la durata (3 mesi → 3 rate mensili); da 12 mesi in su resta tutto come prima.
- **Script:** accetta `templates` (più template, ciascuno con il suo preset), resta compatibile con `template`. Si ferma se nel file restano campi "INSERIRE_...".
- **Informativa privacy** della cliente: `scripts/onboarding/vigliano/informativa-privacy.txt` (testo standard, da far verificare).
- **Correzioni trovate durante il lavoro:**
  - PDF: con `--single-process` Chromium perdeva la pagina generando un PDF con immagini dopo uno senza (succede a un'azienda senza logo: anteprima e poi firma) → firma rifiutata con errore. Ora il browser si riavvia e si riprova una volta.
  - Date delle rate: dal 16/10 il documento leggeva "07/04/2026" all'americana (4 luglio). Ripristinata la stampa così com'è. Nessun contratto firmato nel DB di Replit nel periodo; sul VPS controllare i firmati dopo l'aggiornamento del 16/10, se c'è stato.
  - `package-lock.json`: un pacchetto puntava al proxy interno di Replit e `npm install` sul VPS falliva. Corretto; `scripts/post-merge.sh` lo ripulisce dopo ogni installazione e un test lo controlla.
- `npm test` 68/68, `npm run test:pdf` OK, PDF di prova dei due template controllati.

**Da completare prima di lanciare lo script per la cliente:** codice fiscale (il documento stampa "C.F. e P.I." dal codice fiscale) e PEC in `scripts/onboarding/vigliano/config.json`; codice univoco se diverso da 0000000; logo se vuole. Poi sul VPS: `npx tsx --require ./server/loadEnv.cjs scripts/onboard-company.ts scripts/onboarding/vigliano/config.json --dry-run`, poi senza `--dry-run`.

### 20/10/2026 — Template base e prova reale da venditore
- **Terzo template, "Contratto base di incarico professionale"** (`contratto-base.html`, primo nell'elenco, preset "Incarico base"): vale per qualsiasi servizio e per clienti privati o aziende. Il cliente è indicato tramite la sezione "Dati del cliente" (nessun campo aziendale nel testo); il venditore scrive oggetto, servizi (uno per riga) e modalità. Contiene recesso del consumatore (14 giorni, contratto a distanza) e foro del consumatore.
- **Prova da venditore nel DB di Replit:** azienda di prova id 176 creata con lo script (C.F. e PEC fittizi, admin `chianettaalessio+elvira-admin@gmail.com`), venditore `venditore.prova.tales`, SMTP copiato da quello del proprietario solo per la prova. Contratto 2026-0001 (id 335) compilato dal form come un venditore e inviato a chianettaalessio@gmail.com, link sul dominio di sviluppo di Replit.
- **Correzioni trovate nella prova:** riepilogo laterale mostrava come "Durata" i mesi del rinnovo (ora dalle date); per contratti sotto i 12 mesi con inizio futuro le rate partivano da oggi (ora dall'inizio del contratto, da 12 mesi in su invariato); campo "testo lungo" stretto; esempio "ORB-2026-0123" nella conferma di invio sostituito con "2026-0001".

### 20/10/2026 — Errore in firma (seconda firma clausole) e nuova grafica del pannello firma
- **Bug:** con un testo che chiede l'approvazione specifica delle clausole la pagina cliente non mostrava il secondo riquadro firma (leggeva il testo da un campo che il server non invia), quindi il server rifiutava la firma con "Manca la firma per l'approvazione specifica delle clausole". Ora la pagina usa lo stesso testo del server.
- Tolta l'opzione "Applica a tutti i campi firma": ogni riquadro firma vale solo per sé (la firma delle clausole deve restare un atto separato).
- **Nuovo pannello "Firma il contratto"** sotto il documento, nello stile del documento: 3 passaggi (firme nel documento → codice → consensi e firma), con stato e avanzamento. Il codice si chiede solo dopo aver firmato. Rifatti anche la conferma "Contratto firmato" e la finestra della firma (senza emoji).
- **Test nel browser vero** (`tests/client-sign-ui.test.ts`, dentro `npm test`): firma con disegno e con nome scritto, due firme quando servono, codice email, privacy, firma; desktop e telefono; nessuna chiamata deve fallire. Verificato che senza la correzione il test fallisce.

### 20/10/2026 — Firma meno "statica" e nuove email
- **Pagina di firma:** dopo ogni firma la pagina porta da sola al passaggio successivo (riquadro clausole → codice → firma finale); il campo del codice si attiva da solo; passaggi, spunte e riquadri firma entrano con brevi animazioni (spente per chi ha "riduci movimento"). Testi più rassicuranti: "Nulla è definitivo finché non premi Firma il contratto", "Il codice vale 10 minuti, controlla anche lo spam", sotto il pulsante cosa manca o cosa succede dopo.
- **Attesa della firma:** mentre il server registra la firma compare "Stiamo registrando la tua firma" con i passaggi (codice, firme, PDF, copia via email) e una barra di avanzamento; poi si va alla conferma.
- **Pagina "Contratto firmato"** (`/firmato/...`) rifatta: spunta animata, cosa succede adesso, dati della firma; ora firmata in ora italiana.
- **Email** (richiesta di firma, codice, conferma al cliente, avviso all'operatore, link dati, nuova password, promemoria blocco codice, email di prova) con la stessa grafica: nome dell'azienda in alto, scheda bianca, pulsante nero, nessun "Sistema di gestione contratti". La richiesta di firma ha anche la versione solo testo (aiuta a non finire nello spam) e l'oggetto "Contratto da firmare — <azienda>".
