# 001 — Onboarding della prima cliente (multi-tenant reale)

**Cliente:** evigliano.counseling@gmail.com (studio di counseling)
**Stato:** da fare (analisi completata il 16/10/2026)
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
3. **WhatsApp dopo la firma inviato dal numero del proprietario.** `sendCongratulationsWhatsApp` usa sempre le credenziali Twilio globali (`.env`) con testo fisso: ogni cliente della counselor che firma riceverebbe un WhatsApp dal numero del proprietario. Va reso per-azienda e disattivato di default per le nuove aziende.
4. **Registrazione pubblica aperta.** `/api/register` e la scheda "Registrati" permettono a chiunque di creare un'azienda. Le aziende le crea il proprietario: va disattivata (o protetta da un ruolo "super admin").
5. **Ricaduta sui dati della prima azienda.** `storage.getCompanySettings(undefined)` restituisce la PRIMA azienda del DB. Se il venditore di un contratto viene eliminato, la firma e il PDF usano intestazione e impostazioni del proprietario. La funzione deve fallire in modo esplicito senza `companyId`.
6. **Eliminazione utenti.** Eliminare un dipendente con contratti li rende "orfani" (spariscono dalla dashboard e, per il punto 5, prendono i dati del proprietario). Eliminare un admin che ha creato template genera un errore 500 (chiave esterna). Sostituire con **disattivazione** dell'utente (login bloccato, contratti visibili all'admin) o riassegnazione dei contratti.

### Importanti — il contratto della cliente
7. **Clausola di autorinnovo sempre stampata.** Documento web e PDF mostrano "CLAUSOLA DI AUTORINNOVO" (rinnovo tacito di N mesi) per ogni contratto cliente, anche con autorinnovo disattivato. Va mostrata solo se attivo e/o resa configurabile per template.
8. **Il wizard è costruito sul business del proprietario.** Step "Pacchetti & Bonus", "Prezzo & Durata", campi obbligatori P.IVA/società/sede/referente. Per la cliente serve un percorso semplice, guidato dal template: solo i campi che il suo HTML usa (es. cliente privato: nome, CF, residenza, email, cellulare + eventuali campi specifici come tariffa a seduta). Proposta: impostazione per template "modulo semplice" che nasconde pacchetti/bonus/rate e chiede solo i placeholder presenti nel contenuto.
9. **Blocchi fissi del documento** (bonus, piano pagamenti, validità, dichiarazioni) vanno verificati sul contratto di counseling e resi condizionali dove non servono.

### Robustezza invio (obiettivo "nessun bug sull'invio")
10. Creazione utente: username ed email sono unici **a livello globale**, ma il controllo è fatto solo dentro l'azienda → in caso di duplicato tra aziende si ottiene un 500 invece di un messaggio chiaro.
11. Singleton Twilio condiviso tra aziende (`twilioVerifyService` viene re-inizializzato a ogni chiamata con le credenziali dell'azienda). Oggi funziona perché init e chiamata avvengono nello stesso tick, ma è fragile: creare un client per chiamata.
12. Il link di firma nelle email usa `BASE_URL` (dominio del proprietario) per tutte le aziende: accettabile, ma da confermare.
13. Manca un modo per l'utente di cambiare la propria password (c'è solo creazione/eliminazione da parte dell'admin).

### Ambiente — rischi operativi (da sapere)
14. **Il workspace Replit è collegato al database reale (Supabase)** con i contratti veri (63 firmati). Ogni test fatto qui tocca dati veri: i test automatici devono usare aziende/utenti di prova dedicati e SMTP/Twilio simulati, oppure un DB separato.
15. **`scripts/post-merge.sh` esegue `npm run db:push -- --force`** su quel database. Le colonne `contracts.first_opened_at`, `last_activity_at`, `total_presence_ms` non sono in `shared/schema.ts`: un push forzato le cancellerebbe. Rimuovere il push forzato dallo script (o aggiungere le colonne allo schema).
16. Nel repository git sono presenti dump del database (`DATABASE/*.sql`) e `cookies.txt` con dati personali dei clienti: da rimuovere dal tracciamento.

## 3. Lavori da fare

### Fase A — Isolamento e sicurezza (bloccante)
- [ ] Filtro azienda su update/delete template (rotta + storage).
- [ ] Seed automatico Orbitale/Procacciatore solo per l'azienda del proprietario.
- [ ] WhatsApp post-firma per-azienda, spento di default per le nuove aziende.
- [ ] Disattivare la registrazione pubblica.
- [ ] `getCompanySettings` senza `companyId` → errore esplicito; nessuna ricaduta sulla prima azienda.
- [ ] Utenti: disattivazione al posto dell'eliminazione (o riassegnazione contratti); messaggi chiari su username/email duplicati.
- [ ] Rimuovere `db:push --force` dal post-merge.

### Fase B — Contratto della cliente
- [ ] Il proprietario fornisce l'HTML del contratto di counseling con i placeholder `{{...}}`.
- [ ] Template caricato nell'azienda della cliente (categoria "Clienti").
- [ ] Modalità "modulo semplice" per template: il wizard chiede solo i campi usati dal template; niente pacchetti/bonus/rate se non servono.
- [ ] Autorinnovo e blocchi fissi del documento condizionali (web + PDF allineati).

### Fase C — Account e configurazione
- [ ] Creare l'azienda della cliente con i suoi dati fiscali (ragione sociale, indirizzo, CF/P.IVA, PEC, codice univoco, logo).
- [ ] Creare l'admin `evigliano.counseling@gmail.com` (password temporanea + cambio password al primo accesso).
- [ ] Configurare l'SMTP dell'azienda (scelta da confermare, vedi domande) e inviare l'email di prova.
- [ ] Configurare il canale OTP (email oppure Twilio con le credenziali scelte).
- [ ] Pagina "Cambia password" per tutti gli utenti.

### Fase D — Test
- [ ] Test automatici di isolamento: un utente dell'azienda B non può leggere, modificare, eliminare, archiviare o scaricare template/contratti/PDF/impostazioni dell'azienda A (e viceversa); il dipendente vede solo i propri contratti.
- [ ] Test del flusso di invio con SMTP e Twilio simulati: creazione → anteprima → invio email (mittente = azienda giusta) → apertura link → OTP (email e SMS) → firma → PDF → notifica firmato; nessun WhatsApp dal numero del proprietario.
- [ ] Test con modalità "il cliente compila i propri dati".
- [ ] Prova reale end-to-end con una casella email di test prima della consegna alla cliente.
- [ ] Tutti i test girano su aziende/utenti di prova dedicati e si ripuliscono da soli (il DB è quello reale).

## 4. Criteri di accettazione
- La cliente accede, vede solo il suo contratto e i suoi dati; il proprietario non vede i suoi e viceversa.
- La cliente crea un dipendente; il dipendente accede, compila e invia il contratto; il cliente finale riceve l'email dal mittente della cliente, firma con OTP e riceve il PDF firmato con l'intestazione della cliente.
- Nessun messaggio (email, SMS, WhatsApp) parte con identità o credenziali del proprietario.
- Suite di test verde.

## 5. Domande aperte
- Email: SMTP della cliente (es. Gmail con password per le app) o SMTP del proprietario con il nome della cliente come mittente?
- OTP: solo email, oppure SMS Twilio? Con quale account Twilio (proprietario o cliente)?
- Contratto: i clienti della counselor sono privati o aziende? Servono prezzo, rate, durata, autorinnovo?
- Il database collegato a Replit è lo stesso del sito pubblicato?

## 6. Note tecniche
- Schema DB: niente `drizzle db:push`; modifiche con SQL idempotente all'avvio (stesso schema di `ensureTemplateCategorySchema`) + allineamento manuale di `shared/schema.ts`.
- `npm run check` ha errori preesistenti: valutare solo nuovi errori sui file toccati.

## 7. Fase successiva — accesso automatico dall'app esterna
L'app è incorporata in un'altra app. Oggi non c'è alcuna integrazione (nessun SSO, token o postMessage) e il cookie di sessione non ha `SameSite=None; Secure`, quindi in un iframe su un dominio diverso il login non viene mantenuto. Da progettare a parte: token firmato emesso dall'app esterna → login automatico qui, sincronizzazione degli account, impostazioni cookie per l'iframe.
