export function getPartnershipContractHtml(): string {
  return `
<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">PREMESSE</h2>

<p>Il presente Contratto di Partnership Tecnologica (di seguito "Contratto") disciplina i termini e le condizioni per la concessione in licenza d'uso della piattaforma proprietaria di intelligenza artificiale (di seguito "Piattaforma") sviluppata e di proprietà esclusiva del Fornitore.</p>

<p>La Piattaforma costituisce un sistema integrato di gestione aziendale basato su intelligenza artificiale, progettato per la gestione clienti, l'automazione delle comunicazioni, la formazione strutturata e la vendita assistita tramite agenti AI.</p>

<p>Il presente Contratto è strutturato su due livelli complementari:</p>
<ul>
<li><strong>LIVELLO 1 — COMMERCIALE</strong>: disciplina l'oggetto, i servizi inclusi, il modello economico, la durata e le condizioni operative della partnership;</li>
<li><strong>LIVELLO 2 — PROTEZIONE LEGALE</strong>: disciplina la proprietà intellettuale, la responsabilità, le clausole restrittive, la risoluzione e il foro competente.</li>
</ul>

<div style="text-align: center; padding: 20px; border-radius: 12px; background: linear-gradient(90deg, #4f46e5, #2563eb); color: white; margin: 32px 0; font-weight: bold; font-size: 20px;">
LIVELLO 1 — PARTE COMMERCIALE
</div>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 1 — DEFINIZIONI</h2>

<p style="font-style: italic; color: #64748b;">Ai fini del presente Contratto, i seguenti termini assumono il significato di seguito indicato:</p>

<p><strong>"Piattaforma"</strong>: il sistema software proprietario di intelligenza artificiale, comprensivo di tutti i moduli, le funzionalità, le interfacce, le API, i database e i servizi accessori descritti nel presente Contratto, accessibile via web e ospitato su infrastruttura cloud gestita dal Fornitore.</p>
<p><strong>"Licenza d'Uso"</strong>: il diritto non esclusivo, non trasferibile e revocabile concesso al Partner di utilizzare la Piattaforma nei limiti e secondo le modalità stabilite dal presente Contratto.</p>
<p><strong>"Orbitale"</strong>: il nome commerciale della Piattaforma.</p>
<p><strong>"Assistente AI"</strong>: l'intelligenza artificiale integrata nella Piattaforma Orbitale, personalizzabile e addestrabile sulla base dei documenti e delle istruzioni fornite dall'utilizzatore. Opera con capacità conversazionali, analitiche e generative.</p>
<p><strong>"Licenza Diamond"</strong>: il pacchetto di accesso alla Piattaforma Orbitale riservato al Partner in qualità di consulente. Comprende l'accesso completo a tutti i moduli: dashboard consulente, gestione clienti, Lead Hub, agenti AI WhatsApp, Knowledge Base, Content Marketing Studio, AI Course Builder, Email Hub, calendario, analytics avanzate. È la licenza oggetto del presente Contratto.</p>
<p><strong>"Licenza Gold"</strong>: il pacchetto di accesso alla Piattaforma destinato ai clienti finali del Partner (non al Partner stesso). Include: assistente AI con memoria persistente, percorsi formativi strutturati, assistente AI personale, dipendente AI virtuale, Knowledge Base personalizzata, AI Analytics, Script Manager, sistema di gamification Momentum e Streak.</p>
<p><strong>"Licenza Silver"</strong>: il pacchetto di accesso alla Piattaforma destinato ai clienti finali del Partner (non al Partner stesso), con funzionalità ridotte rispetto alla Gold. Include: assistente AI senza memoria persistente tra le sessioni. Ogni conversazione inizia senza contesto delle precedenti.</p>
<p><strong>"Agente AI WhatsApp"</strong>: il modulo della Piattaforma che consente la creazione di dipendenti virtuali operanti su WhatsApp Business, in grado di gestire conversazioni automatizzate, qualificare lead, prenotare appuntamenti e fornire assistenza clienti, 24 ore su 24, 7 giorni su 7.</p>
<p><strong>"Knowledge Base"</strong>: l'archivio documentale digitale alimentabile dal Partner (PDF, DOCX, TXT, URL) dal quale l'intelligenza artificiale attinge per formulare risposte accurate, pertinenti e basate su fonti verificabili, senza inventare informazioni (tecnologia RAG — Retrieval Augmented Generation).</p>
<p><strong>"Lead"</strong>: un potenziale cliente del Partner che ha manifestato interesse o che viene contattato proattivamente tramite campagne automatizzate.</p>
<p><strong>"Canone Mensile"</strong>: il corrispettivo fisso ricorrente dovuto dal Partner al Fornitore per l'utilizzo della Piattaforma.</p>
<p><strong>"Revenue Share"</strong>: la percentuale sulle vendite di licenze Gold e Silver effettuate dal Partner a favore dei propri clienti finali, dovuta al Fornitore in via permanente e irrevocabile.</p>
<p><strong>"Stripe Connect"</strong>: il sistema di gestione dei pagamenti integrato che consente il tracciamento automatico delle transazioni e la ripartizione dei ricavi tra Fornitore e Partner.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 2 — OGGETTO DEL CONTRATTO</h2>

<p><strong>2.1.</strong> Il Fornitore concede al Partner una Licenza Diamond della Piattaforma Orbitale, non esclusiva, non trasferibile e non sublicenziabile, per la durata e alle condizioni stabilite dal presente Contratto.</p>
<p><strong>2.2.</strong> La Licenza Diamond comprende l'accesso a tutti i moduli e le funzionalità della Piattaforma come dettagliati nell'Articolo 3, in qualità di consulente, inclusi gli aggiornamenti e le evoluzioni rilasciate dal Fornitore durante il periodo di validità del Contratto.</p>
<p><strong>2.3.</strong> Il Partner acquisisce il diritto di utilizzare la Piattaforma Orbitale per la propria attività e di rivendere licenze Gold e Silver ai propri clienti finali, nel rispetto delle condizioni economiche e operative stabilite nel presente Contratto. Le licenze Gold e Silver sono destinate esclusivamente ai clienti del Partner e non al Partner stesso.</p>
<p><strong>2.4.</strong> La Piattaforma è fornita in modalità SaaS (Software as a Service), accessibile via browser web, senza necessità di installazione locale. Il Fornitore si occupa dell'hosting, della manutenzione dell'infrastruttura e degli aggiornamenti tecnici.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 3 — DESCRIZIONE DEI SERVIZI INCLUSI</h2>

<p style="font-style: italic; color: #64748b;">La Piattaforma include i seguenti moduli e funzionalità, qui descritti in dettaglio affinché il Partner abbia piena consapevolezza di ciò che acquisisce.</p>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #eff6ff, #eef2ff); border: 1px solid #bfdbfe; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #1e3a8a;">3.1. Assistenza Clienti AI su WhatsApp — 24/7</h3>
<p>La Piattaforma consente al Partner di attivare agenti AI operanti su WhatsApp Business che funzionano come veri e propri dipendenti virtuali. Questi agenti:</p>
<ul>
<li>rispondono automaticamente ai messaggi in arrivo dai clienti, a qualsiasi ora del giorno e della notte, senza pause e senza ritardi;</li>
<li>attingono alla Knowledge Base del Partner per fornire risposte accurate e basate sui documenti caricati (FAQ, listini prezzi, procedure, guide);</li>
<li>gestiscono le obiezioni più comuni seguendo script personalizzabili con variazioni naturali nel linguaggio;</li>
<li>eseguono l'escalation automatica a un operatore umano quando il cliente lo richiede esplicitamente, quando l'agente non riesce a rispondere dopo due tentativi, o quando rileva frustrazione nel tono della conversazione;</li>
<li>inviano check-in settimanali automatici ai clienti, ruotando tra cinque template predefiniti e personalizzando i messaggi con il nome del cliente, l'ultimo esercizio completato e i progressi formativi;</li>
<li>operano con un ritardo configurabile tra le risposte (da 3 a 8 secondi) per simulare un comportamento naturale e non robotico;</li>
<li>rispettano fasce orarie configurabili e giorni di attività definiti dal Partner;</li>
<li>inviano notifiche in tempo reale al Partner quando un cliente prenota un appuntamento o quando si verifica un'escalation.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #ecfdf5, #f0fdfa); border: 1px solid #a7f3d0; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #065f46;">3.2. Venditore AI che Qualifica i Lead su WhatsApp</h3>
<p>La Piattaforma mette a disposizione del Partner un sistema completo di acquisizione clienti automatizzato:</p>

<h4 style="font-weight: 600; color: #047857; margin: 12px 0 8px 0;">a) Lead Hub — Centro di Controllo Acquisizione</h4>
<ul>
<li>importazione massiva di lead da file Excel e CSV con mappatura automatica delle colonne;</li>
<li>creazione manuale di singoli lead con tag personalizzabili per fonte, priorità, interesse;</li>
<li>gestione duplicati intelligente con opzioni di salto, aggiornamento o creazione forzata;</li>
<li>organizzazione dei lead con tag illimitati;</li>
<li>visualizzazione dello stato di ogni lead: in attesa, contattato, ha risposto, qualificato, appuntamento fissato, convertito in cliente, perso;</li>
<li>filtri avanzati per tag, stato, punteggio e campagna di appartenenza.</li>
</ul>

<h4 style="font-weight: 600; color: #047857; margin: 12px 0 8px 0;">b) Lead Scoring Automatico</h4>
<ul>
<li>punteggio automatico basato sulle interazioni: +10 per risposta, +20 per prenotazione appuntamento, +15 per richiesta informazioni, +5 per clic su link;</li>
<li>penalizzazioni: -2 per ogni giorno senza risposta, -50 per richiesta di non essere contattato, -10 per messaggio non consegnato;</li>
<li>classificazione: lead caldo (>70 punti), tiepido (40-70), freddo (<40).</li>
</ul>

<h4 style="font-weight: 600; color: #047857; margin: 12px 0 8px 0;">c) Campagne WhatsApp Automatizzate</h4>
<ul>
<li>creazione di campagne con nome, descrizione, "uncino" e offerta;</li>
<li>selezione dei lead per tag, stato o manualmente;</li>
<li>collegamento a template WhatsApp approvati da Meta;</li>
<li>modalità "Dry Run" per testare la campagna senza inviare messaggi reali;</li>
<li>statistiche in tempo reale: messaggi inviati, consegnati, letti, risposte, appuntamenti, conversioni.</li>
</ul>

<h4 style="font-weight: 600; color: #047857; margin: 12px 0 8px 0;">d) Agente AI "Setter" — Il Venditore Virtuale</h4>
<ul>
<li>contatta proattivamente i lead e gestisce le risposte in arrivo;</li>
<li>segue uno script di vendita personalizzabile con fasi strutturate: apertura, qualifica, obiezioni, proposta, chiusura;</li>
<li>qualifica automaticamente i lead attraverso domande strategiche;</li>
<li>propone fasce orarie per appuntamenti basate sulla disponibilità del calendario;</li>
<li>prenota automaticamente e invia conferma al lead e notifica al Partner;</li>
<li>passa al Partner soltanto i lead qualificati e con appuntamento fissato.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #f5f3ff, #faf5ff); border: 1px solid #ddd6fe; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #5b21b6;">3.3. Intelligenza Artificiale Personalizzata — Strutturata a Livelli</h3>

<div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.6); border: 1px solid #c4b5fd; margin: 12px 0;">
<h4 style="font-weight: bold; color: #6d28d9; margin-bottom: 8px;">Licenza Gold — Il Pacchetto Completo</h4>
<ul>
<li>Consulente AI addestrato con memoria: l'AI ricorda ogni conversazione precedente con il cliente, riprende il discorso dove era stato lasciato, conosce progressi, obiettivi e preferenze;</li>
<li>Percorsi formativi strutturati: corsi organizzati in moduli e lezioni (testo, video, quiz, file scaricabili), con tracciamento dei progressi e percentuale di completamento;</li>
<li>Sistema esercizi con feedback: template riutilizzabili, consegna da parte del cliente, revisione con feedback e valutazione;</li>
<li>Assistente AI personale: disponibile 24/7 per domande sui corsi, aiuto con esercizi, analisi progressi, consigli personalizzati;</li>
<li>Dipendente AI addestrato: agente AI su WhatsApp, addestrato sulla documentazione specifica del cliente;</li>
<li>Knowledge Base personalizzata: il cliente può caricare documenti per risposte ancora più accurate;</li>
<li>AI Analytics: monitoraggio utilizzo con token consumati, richieste, costo stimato, tempo medio di risposta;</li>
<li>Script Manager: gestione script di vendita con fasi personalizzabili;</li>
<li>Momentum e Streak: gamification con giorni consecutivi di attività e record personali.</li>
</ul>
</div>

<div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.6); border: 1px solid #e2e8f0; margin: 12px 0;">
<h4 style="font-weight: bold; color: #475569; margin-bottom: 8px;">Licenza Silver — Il Pacchetto Base</h4>
<ul>
<li>Assistente AI addestrato senza memoria: AI addestrata sulla documentazione aziendale, risponde accuratamente ma ogni sessione inizia senza contesto delle precedenti;</li>
<li>Accesso alle funzionalità base della Piattaforma con limitazioni rispetto alla Licenza Gold.</li>
</ul>
</div>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fffbeb, #fff7ed); border: 1px solid #fcd34d; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #92400e;">3.4. Onboarding Venditori e Dipendenti</h3>
<ul>
<li>creazione di account per venditori e dipendenti con invio automatico delle credenziali di accesso via email;</li>
<li>assegnazione di corsi formativi e percorsi di onboarding strutturati;</li>
<li>ogni dipendente dispone della propria dashboard con progressi, esercizi, calendario e accesso all'AI;</li>
<li>monitoraggio dei progressi formativi, revisione esercizi e feedback;</li>
<li>supporto doppio ruolo: un utente può essere contemporaneamente consulente e cliente nella stessa piattaforma;</li>
<li>le prime 5 licenze dipendente sono incluse gratuitamente nel pacchetto del Partner.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #ecfeff, #f0f9ff); border: 1px solid #a5f3fc; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #155e75;">3.5. Knowledge Base e AI — Il Cervello Documentale</h3>
<ul>
<li>caricamento di documenti in formato PDF, DOCX, TXT e URL di pagine web;</li>
<li>organizzazione per categorie (Servizi e Prezzi, Materiale Formativo, Procedure Interne, FAQ Clienti);</li>
<li>configurazione granulare dell'accesso: ogni documento può essere reso disponibile all'AI del consulente, dei clienti, degli Agenti WhatsApp, o combinazioni;</li>
<li>tecnologia RAG (Retrieval Augmented Generation): l'AI cerca nei documenti, estrae informazioni rilevanti, formula risposte con fonti verificabili;</li>
<li>l'AI non inventa mai informazioni: se non trova la risposta nei documenti, lo comunica chiaramente.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fff1f2, #fdf2f8); border: 1px solid #fda4af; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #9f1239;">3.6. AI Course Builder — Generazione Automatica di Corsi</h3>
<ul>
<li>generazione di corsi strutturati a partire da un URL di un video YouTube;</li>
<li>estrazione automatica della trascrizione, analisi dei contenuti, generazione di moduli e lezioni, creazione di quiz;</li>
<li>un video di 1 ora può generare un corso completo (5 moduli, 15 lezioni, 5 quiz) in circa 10 minuti;</li>
<li>revisione e modifica del corso generato prima della pubblicazione.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fdf4ff, #fdf2f8); border: 1px solid #f0abfc; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #86198f;">3.7. Content Marketing Studio</h3>
<ul>
<li>generatore di idee per contenuti basato sull'AI, personalizzato per settore e target del Partner;</li>
<li>creazione automatica di copy per social media (LinkedIn, Instagram, Facebook) con controllo su tono, lunghezza, emoji, hashtag e call-to-action;</li>
<li>generazione di immagini AI tramite Google Gemini Imagen 3, con scelta del formato e dello stile;</li>
<li>Campaign Builder guidato in 6 step: obiettivo, target, canali, contenuti, calendario, review e lancio;</li>
<li>organizzazione dei contenuti in cartelle e calendario editoriale visuale;</li>
<li>libreria brand assets per logo, palette colori, bio e descrizioni.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #f0fdfa, #ecfdf5); border: 1px solid #99f6e4; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #115e59;">3.8. Email e Automazioni</h3>
<ul>
<li><strong>Email Journey:</strong> sequenze di email automatiche programmate nel tempo (benvenuto, come iniziare, primo corso, check-in, feedback);</li>
<li><strong>Email Nurturing 365:</strong> sistema automatico che genera e invia 365 email personalizzate nell'arco di un anno per scaldare i lead, una al giorno;</li>
<li><strong>Email Hub:</strong> inbox unificata multi-account con sincronizzazione IMAP, risposte AI automatiche, sistema ticket, rilevamento email urgenti;</li>
<li><strong>Email post-consulenza:</strong> riepilogo automatico con punti chiave discussi, decisioni prese, prossimi step e data prossimo appuntamento;</li>
<li><strong>Automazioni:</strong> regole trigger-condizione-azione personalizzabili (es: se lead non risponde da 3 giorni, invia follow-up WhatsApp).</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #f0f9ff, #eff6ff); border: 1px solid #7dd3fc; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #0c4a6e;">3.9. Calendario, Consulenze e Task</h3>
<ul>
<li>calendario integrato con gestione appuntamenti e consulenze;</li>
<li>videochiamate integrate con link generato automaticamente 15 minuti prima dell'appuntamento;</li>
<li>preparazione consulenza assistita dall'AI con riepilogo della situazione del cliente;</li>
<li>sistema task con scadenze, priorità e gestione quotidiana;</li>
<li>completamento consulenza con note, email di riepilogo automatica, nuovi esercizi e programmazione prossimo appuntamento.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #eef2ff, #f5f3ff); border: 1px solid #c7d2fe; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #3730a3;">3.10. Dashboard e Analytics</h3>
<ul>
<li>dashboard consulente con 4 KPI principali: clienti attivi, esercizi da revisionare, consulenze della settimana, lead prioritari;</li>
<li>sezione "Items in Attesa" con consulenze da completare, bozze email, task scaduti, lead non contattati;</li>
<li>dashboard WhatsApp con statistiche in tempo reale: messaggi oggi, conversazioni attive, tasso risposta, lead convertiti;</li>
<li>profilo cliente completo con 6 tab: panoramica, percorso formativo, consulenze, documenti, comunicazioni, analytics;</li>
<li>dashboard cliente con progressi formativi, esercizi, calendario e accesso all'AI Assistant.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fdf2f8, #fff1f2); border: 1px solid #f9a8d4; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #9d174d;">3.11. Integrazione Instagram DM</h3>
<ul>
<li>collegamento dell'account Instagram Business tramite API Meta;</li>
<li>risposta automatica ai DM con la stessa AI degli agenti WhatsApp;</li>
<li>gestione story replies e conversione follower in lead;</li>
<li>rispetto della finestra 24 ore imposta da Instagram per le risposte.</li>
</ul>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #eff6ff, #eef2ff); border: 1px solid #bfdbfe; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #1e40af;">3.12. Assistenza WhatsApp AI — 24/7</h3>
<p>Il Partner riceve accesso a un canale di assistenza gestito da un'intelligenza artificiale addestrata sulla documentazione della Piattaforma, disponibile 24 ore su 24 tramite WhatsApp. L'assistenza AI è in grado di rispondere a domande sull'utilizzo della Piattaforma, guidare il Partner nelle configurazioni e risolvere dubbi operativi.</p>
<p>Per problematiche tecniche complesse (bug, malfunzionamenti, errori di sistema), il Partner può aprire un ticket via email come disciplinato dall'Articolo 5.</p>
</div>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 4 — AGGIORNAMENTI E MANUTENZIONE</h2>

<p><strong>4.1. Aggiornamenti Base.</strong> Il Fornitore rilascia periodicamente aggiornamenti della Piattaforma che includono: correzioni di bug, miglioramenti delle prestazioni, aggiornamenti di sicurezza ed evoluzioni delle funzionalità esistenti. Tali aggiornamenti sono sempre inclusi nel Canone Mensile senza costi aggiuntivi.</p>
<p><strong>4.2. Aggiornamenti Custom.</strong> Il Partner ha diritto a una (1) richiesta di personalizzazione al mese, da intendersi come una modifica specifica, un adattamento funzionale o una configurazione dedicata richiesta dal Partner. Le richieste custom:</p>
<ul>
<li>non sono cumulabili: se il Partner non utilizza la richiesta in un determinato mese, non può sommarla a quella del mese successivo;</li>
<li>devono essere inviate via email o tramite il canale di assistenza dedicato;</li>
<li>saranno valutate dal Fornitore in termini di fattibilità e tempistiche;</li>
<li>il Fornitore si riserva il diritto di rifiutare richieste che comportino modifiche strutturali all'architettura della Piattaforma.</li>
</ul>
<p><strong>4.3. Manutenzione Programmata.</strong> Il Fornitore può eseguire interventi di manutenzione programmata che comportino temporanea indisponibilità della Piattaforma, previo avviso al Partner con almeno 24 ore di anticipo.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 5 — SUPPORTO TECNICO</h2>

<p><strong>5.1. Livello 1 — Supporto Operativo.</strong> Il supporto di primo livello è a carico del Partner, che potrà avvalersi della documentazione fornita, dell'assistenza WhatsApp AI 24/7 e dei materiali formativi inclusi.</p>
<p><strong>5.2. Livello 2 — Supporto Tecnico.</strong> Per problematiche tecniche (bug, malfunzionamenti, errori), il Partner può aprire un ticket via email. Il Fornitore si impegna a fornire una prima risposta entro quarantotto (48) ore lavorative.</p>
<p><strong>5.3. Esclusioni.</strong> Il supporto non copre: problemi da uso improprio, interruzioni di servizi terzi (WhatsApp, Meta, Google, Twilio), personalizzazioni extra, formazione individuale oltre ai materiali forniti.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 6 — MODELLO ECONOMICO — CORRISPETTIVI</h2>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #86efac; margin: 16px 0;">
<h3 style="font-weight: bold; color: #166534;">6.1. Costo di Attivazione (Setup)</h3>
<p>All'atto della sottoscrizione, il Partner corrisponde un costo di attivazione una tantum fino a un massimo di <strong>Euro 2.000,00</strong>, comprensivo di: configurazione iniziale della Piattaforma, creazione dell'ambiente dedicato, setup degli agenti AI WhatsApp, caricamento iniziale della Knowledge Base, formazione iniziale.</p>
<p>Il costo di attivazione può essere ridotto o azzerato a insindacabile discrezione del Fornitore.</p>
<div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.8); border: 1px solid #86efac;">
<p><strong>Costo di attivazione concordato:</strong> Euro ______________ (____________________/00)</p>
</div>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #eff6ff, #eef2ff); border: 1px solid #93c5fd; margin: 16px 0;">
<h3 style="font-weight: bold; color: #1e40af;">6.2. Canone Mensile Fisso</h3>
<p>Il Partner corrisponde un canone mensile fisso, dovuto anticipatamente entro il giorno 5 di ogni mese solare, a partire dal mese successivo alla data di attivazione.</p>
<div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.8); border: 1px solid #93c5fd;">
<p><strong>Canone mensile concordato:</strong> Euro ______________ (____________________/00) + IVA</p>
</div>
<p>Il Canone include: accesso completo a tutti i moduli, aggiornamenti base, 1 richiesta custom/mese, 5 licenze dipendente gratuite, assistenza WhatsApp AI 24/7, supporto tecnico via ticket.</p>
</div>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fffbeb, #fff7ed); border: 1px solid #fbbf24; margin: 16px 0;">
<h3 style="font-weight: bold; color: #92400e;">6.3. Licenze Dipendenti Aggiuntive</h3>
<p>Le prime <strong>5 licenze</strong> per dipendenti sono incluse gratuitamente. A partire dalla sesta, il costo è di <strong>Euro 20,00/mese per pacchetto di 5 licenze</strong>. Non è possibile acquistare licenze singole.</p>
<div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.8); border: 1px solid #fbbf24; font-size: 13px; font-style: italic; color: #64748b;">
Esempio: 8 dipendenti = 5 gratuite + 1 pacchetto da 5 (€20/mese) = 10 licenze disponibili
</div>
</div>

<p><strong>6.4. Costi di Servizi Terzi.</strong> Restano a carico del Partner: messaggistica WhatsApp (Twilio, ~€0,05/msg), API AI (Google Vertex AI / Gemini), invio email (SMTP), configurazione WhatsApp Business (Meta). Il Fornitore non è responsabile per variazioni di prezzo dei fornitori terzi.</p>
<p><strong>6.5. Modalità di Pagamento.</strong> Pagamenti preferibilmente tramite Stripe Connect per tracciamento automatico e ripartizione ricavi. In alternativa, bonifico bancario.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 7 — REVENUE SHARE</h2>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #faf5ff, #f5f3ff); border: 1px solid #d8b4fe; margin: 16px 0;">
<p><strong>7.1.</strong> Il Partner che rivende licenze Gold o Silver è tenuto a corrispondere al Fornitore il <strong>50% del ricavo netto</strong> generato da ciascuna licenza rivenduta.</p>
<p><strong>7.2.</strong> Si applica a: canoni mensili delle licenze rivendute, costi di attivazione applicati ai clienti finali, servizi aggiuntivi collegati alla Piattaforma. Non si applica a: consulenze professionali, formazione e attività commerciali non connesse alla Piattaforma.</p>
<div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.8); border: 1px solid #d8b4fe;">
<p style="color: #6b21a8; font-weight: 600;"><strong>7.3.</strong> L'obbligo di Revenue Share è PERMANENTE e IRREVOCABILE per tutta la durata del rapporto tra Partner e cliente finale, anche oltre la cessazione del presente Contratto.</p>
</div>
<p><strong>7.4.</strong> Tracciamento preferibilmente tramite Stripe Connect. Il Partner si impegna a fornire documentazione attestante i ricavi su richiesta.</p>
<p><strong>7.5.</strong> La quota del Fornitore è liquidata mensilmente entro il giorno 15 del mese successivo. Con Stripe Connect, la ripartizione avviene automaticamente.</p>
</div>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 8 — DURATA E RINNOVO</h2>

<p><strong>8.1.</strong> Durata minima di <strong>12 mesi</strong> dalla data di sottoscrizione.</p>
<p><strong>8.2.</strong> Rinnovo automatico per ulteriori periodi di 12 mesi ciascuno, salvo disdetta nei termini dell'Articolo 9.</p>
<p><strong>8.3.</strong> Canone invariato per il periodo in corso. Adeguamenti comunicati con almeno 60 giorni di preavviso prima della scadenza, con facoltà di recesso entro 30 giorni senza penali.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 9 — RECESSO</h2>

<h3 style="font-weight: 600; color: #1e293b; margin: 12px 0 8px 0;">9.1. Recesso del Partner</h3>
<p>Preavviso minimo di 30 giorni via PEC o raccomandata A/R. Il recesso ha effetto alla scadenza del periodo in corso (12 mesi). Il Partner resta obbligato al pagamento dei canoni residui fino alla naturale scadenza.</p>
<div style="padding: 12px; border-radius: 8px; background: #fffbeb; border: 1px solid #fbbf24; font-size: 13px; font-style: italic; color: #92400e; margin: 8px 0;">
Esempio: Contratto dal 1° gennaio, recesso comunicato il 15 giugno → resta efficace fino al 31 dicembre, canoni dovuti da luglio a dicembre.
</div>

<h3 style="font-weight: 600; color: #1e293b; margin: 12px 0 8px 0;">9.2. Recesso del Fornitore</h3>
<p>Preavviso minimo di 30 giorni via PEC o raccomandata A/R. Il Partner non è tenuto al pagamento di canoni successivi. Il Fornitore garantisce 30 giorni per l'esportazione dei dati.</p>

<h3 style="font-weight: 600; color: #1e293b; margin: 12px 0 8px 0;">9.3. Effetti del Recesso</h3>
<p>Alla cessazione: accesso disattivato; perdita del diritto di utilizzo di materiale, software, prompt, architettura; dati anagrafici clienti disponibili per esportazione entro 30 giorni; obbligo di Revenue Share permanente per i clienti acquisiti durante la vigenza.</p>

<div style="text-align: center; padding: 20px; border-radius: 12px; background: linear-gradient(90deg, #7c3aed, #6b21a8); color: white; margin: 32px 0; font-weight: bold; font-size: 20px;">
LIVELLO 2 — PROTEZIONE LEGALE
</div>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 10 — PROPRIETÀ INTELLETTUALE</h2>

<p><strong>10.1.</strong> La Piattaforma, in ogni componente, è di proprietà esclusiva del Fornitore: codice sorgente e compilato, architettura, design, prompt AI, istruzioni di addestramento, quiz, template, materiali formativi, nomi, marchi, loghi, documentazione tecnica, algoritmi, logiche, know-how.</p>
<p><strong>10.2.</strong> Qualsiasi sviluppo custom realizzato dal Fornitore su richiesta del Partner, anche se pagato, è di proprietà esclusiva del Fornitore, che può riutilizzarlo liberamente.</p>
<p><strong>10.3.</strong> Il Partner si impegna a non decompilare, disassemblare, effettuare reverse engineering, copiare, riprodurre, modificare, adattare, tradurre, creare opere derivate o tentare di risalire al codice sorgente, ai prompt, all'architettura o alla logica della Piattaforma.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 11 — TITOLARITÀ E TRATTAMENTO DEI DATI</h2>

<p><strong>11.1.</strong> Il Partner è titolare dei dati anagrafici e di contatto dei propri clienti. In caso di cessazione, tali dati saranno disponibili per l'esportazione.</p>
<p><strong>11.2.</strong> Il Fornitore è titolare dei dati generati dall'utilizzo della Piattaforma: log conversazioni AI, dati di utilizzo e analytics, contenuti generati dall'AI, metriche, dati di addestramento.</p>

<h3 style="font-size: 16px; font-weight: bold; color: #6d28d9; margin: 16px 0 8px 0;">11.3. Segregazione e Riservatezza dei Dati tra Clienti Finali</h3>
<ul>
<li>Ciascun cliente del Partner vede esclusivamente i propri dati all'interno della Piattaforma. Non ha accesso ai dati di altri clienti dello stesso Partner;</li>
<li>La Knowledge Base è segregata tra i diversi Partner: ciascun Partner ha una Knowledge Base indipendente e inaccessibile ai concorrenti;</li>
<li>Per i clienti con Licenza Gold, l'intelligenza artificiale utilizza esclusivamente i dati e i documenti specifici di quel cliente per formulare risposte personalizzate;</li>
<li>Il Fornitore implementa controlli di accesso granulare ai documenti della Knowledge Base: ogni documento può essere reso disponibile selettivamente all'AI del consulente, all'AI dei clienti, agli Agenti WhatsApp, o a specifiche combinazioni;</li>
<li>Gli Agenti AI WhatsApp del Partner operano in un contesto isolato, elaborando esclusivamente i dati dei clienti del Partner e utilizzando la Knowledge Base del Partner, senza accesso ai dati o alla Knowledge Base di altri Partner.</li>
</ul>

<h3 style="font-size: 16px; font-weight: bold; color: #6d28d9; margin: 16px 0 8px 0;">11.4. Sicurezza dei Dati</h3>
<ul>
<li>Il Fornitore implementa misure tecniche e organizzative adeguate a garantire la riservatezza, l'integrità e la disponibilità dei dati, conformemente alle migliori pratiche del settore;</li>
<li>Backup automatici e ridondanza dell'infrastruttura per assicurare continuità operativa e recupero da malfunzionamenti;</li>
<li>Crittografia dei dati in transito (TLS/HTTPS) e a riposo nei database;</li>
<li>Monitoraggio continuo della sicurezza, audit regolari e aggiornamenti tempestivi delle misure di protezione.</li>
</ul>

<h3 style="font-size: 16px; font-weight: bold; color: #6d28d9; margin: 16px 0 8px 0;">11.5. Trattamento dei Dati Personali</h3>
<p>Ciascuna Parte tratta i dati personali nel rispetto del GDPR (Reg. UE 2016/679) e della normativa nazionale vigente. Le Parti si impegnano a sottoscrivere, ove necessario, un Data Processing Agreement.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 12 — MANLEVA E LIMITAZIONE DI RESPONSABILITÀ</h2>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fef2f2, #fff1f2); border: 1px solid #fca5a5; margin: 16px 0;">
<p><strong>12.1. Manleva Totale sull'AI.</strong> Il Partner riconosce che l'AI opera su modelli probabilistici e può generare risposte inesatte ("allucinazioni"). Il Partner manleva e tiene indenne il Fornitore da qualsiasi responsabilità, danno, costo, pretesa o azione legale derivante da: risposte errate dell'AI, decisioni prese sulla base di informazioni AI, danni di qualsiasi natura, violazioni normative da uso improprio.</p>
<p><strong>12.2.</strong> La responsabilità complessiva del Fornitore non potrà eccedere l'importo dei Canoni Mensili corrisposti nei 12 mesi precedenti.</p>
<p><strong>12.3.</strong> La Piattaforma è fornita "così com'è" e "come disponibile". Nessuna garanzia espressa o implicita circa idoneità, assenza di errori, disponibilità ininterrotta o accuratezza dell'AI.</p>
</div>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 13 — NON CONCORRENZA</h2>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fff7ed, #fffbeb); border: 1px solid #fdba74; margin: 16px 0;">
<p><strong>13.1.</strong> Per tutta la durata del Contratto e per <strong>3 anni</strong> successivi alla cessazione, il Partner si impegna a non: sviluppare o partecipare a piattaforme concorrenti; collaborare con soggetti che sviluppano prodotti concorrenti; utilizzare il know-how acquisito per creare prodotti concorrenti; sollecitare o assumere dipendenti o collaboratori del Fornitore.</p>
<p><strong>13.2.</strong> Penale per violazione: <strong>Euro 50.000,00</strong> per ciascuna violazione accertata, fermo restando il diritto al risarcimento del maggior danno.</p>
<p><strong>13.3.</strong> Ambito territoriale: intero territorio nazionale italiano e mercati esteri in cui il Fornitore operi o abbia manifestato interesse durante la vigenza.</p>
</div>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 14 — SOSPENSIONE DEL SERVIZIO</h2>

<p><strong>14.1.</strong> Sospensione con preavviso di <strong>24 ore</strong> nei casi di: mancato pagamento oltre 15 giorni, violazione contrattuale, uso illegale, rischio sicurezza, richiesta dell'autorità.</p>
<p><strong>14.2.</strong> Nessun indennizzo, riduzione o compensazione durante la sospensione. Il Canone Mensile resta dovuto.</p>
<p><strong>14.3.</strong> Riattivazione entro 24 ore dalla rimozione della causa.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 15 — CESSIONE DEL CONTRATTO</h2>

<p><strong>15.1.</strong> Il Fornitore può cedere il Contratto a terzi con 30 giorni di preavviso, senza consenso del Partner.</p>
<p><strong>15.2.</strong> Il Partner non può cedere il Contratto senza previo consenso scritto del Fornitore.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 16 — BRANDING E ATTRIBUZIONE</h2>

<p><strong>16.1.</strong> La Piattaforma riporta la dicitura <strong>"Powered by Alessio Chianetta"</strong> in ogni manifestazione visibile ai clienti finali. Il Partner si impegna a non rimuovere, oscurare o modificare tale attribuzione.</p>
<p><strong>16.2.</strong> Il Fornitore può utilizzare nome e logo del Partner come referenza commerciale, salvo diverso accordo scritto.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 17 — RISERVATEZZA</h2>

<p><strong>17.1.</strong> Ciascuna Parte mantiene riservate tutte le informazioni confidenziali ricevute dall'altra.</p>
<p><strong>17.2.</strong> L'obbligo permane per 5 anni dalla cessazione.</p>
<p><strong>17.3.</strong> Esclusioni: informazioni di dominio pubblico, già in possesso legittimo, da divulgare per obbligo di legge.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 18 — CLAUSOLA RISOLUTIVA ESPRESSA</h2>

<p>Ai sensi dell'art. 1456 c.c., il Fornitore può dichiarare risolto il Contratto via PEC nei seguenti casi: mancato pagamento di 2 o più canoni consecutivi; violazione non concorrenza; violazione proprietà intellettuale; cessione non autorizzata; violazione riservatezza; rimozione branding; uso illecito; fallimento o insolvenza del Partner.</p>
<p>In caso di risoluzione per inadempimento del Partner, il Fornitore ha diritto ai canoni residui fino alla scadenza del periodo in corso, oltre al risarcimento del maggior danno.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 19 — FORZA MAGGIORE</h2>

<p>Nessuna Parte è responsabile per inadempimenti causati da eventi di forza maggiore: calamità naturali, guerre, atti di terrorismo, pandemie, provvedimenti dell'autorità, interruzioni prolungate di servizi essenziali terzi.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 20 — NON ESCLUSIVITÀ</h2>

<p>Il Contratto non conferisce alcun diritto di esclusiva. Il Fornitore è libero di concedere licenze ad altri soggetti, anche nello stesso settore o area geografica del Partner.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 21 — COMUNICAZIONI</h2>

<p>Tutte le comunicazioni in forma scritta via PEC o raccomandata A/R agli indirizzi in intestazione. Si intendono ricevute alla data di ricezione della PEC o della raccomandata.</p>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 22 — LEGGE APPLICABILE E FORO COMPETENTE</h2>

<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; margin: 16px 0;">
<p><strong>22.1.</strong> Il presente Contratto è regolato dalla legge italiana.</p>
<p><strong>22.2.</strong> Per qualsiasi controversia, le Parti riconoscono la competenza esclusiva del <strong>Foro di Messina</strong>, con espressa rinuncia a qualsiasi altro foro concorrente.</p>
</div>

<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO 23 — DISPOSIZIONI FINALI</h2>

<p><strong>23.1. Intero Accordo.</strong> Il presente Contratto costituisce l'intero accordo tra le Parti e sostituisce qualsiasi precedente accordo, intesa o comunicazione.</p>
<p><strong>23.2. Modifiche.</strong> Qualsiasi modifica deve essere concordata per iscritto e sottoscritta da entrambe le Parti.</p>
<p><strong>23.3. Nullità Parziale.</strong> Se una clausola è dichiarata nulla, le restanti rimangono valide. Le Parti la sostituiranno con una clausola valida di effetto simile.</p>
<p><strong>23.4. Tolleranza.</strong> La mancata applicazione di una clausola non costituisce rinuncia al diritto di applicarla successivamente.</p>
<p><strong>23.5. Copie.</strong> Redatto in due copie originali, una per ciascuna Parte.</p>

<h2 style="font-size: 16px; font-weight: bold; color: #1e293b; text-align: center; margin: 32px 0 8px 0;">APPROVAZIONE SPECIFICA</h2>
<p style="text-align: center; font-size: 13px; font-style: italic; color: #475569;">ai sensi degli articoli 1341 e 1342 del Codice Civile</p>

<p>Il Partner dichiara di aver letto, compreso e di approvare specificamente le seguenti clausole:</p>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0;">
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 7 — Revenue Share permanente e irrevocabile
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 8 — Durata minima e rinnovo automatico
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 9 — Recesso e obbligo pagamento canoni residui
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 10 — Proprietà intellettuale esclusiva
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 12 — Manleva AI e limitazione responsabilità
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 13 — Non concorrenza 3 anni con penale
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 14 — Sospensione senza indennizzo
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 15 — Cessione del contratto
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 18 — Clausola risolutiva espressa
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 20 — Non esclusività
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155;">
<span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0;"></span>
Art. 22 — Foro esclusivo di Messina
</div>
</div>

<div style="padding: 24px; border-radius: 12px; border: 2px dashed #ddd6fe; background: rgba(245,243,255,0.3); text-align: center; margin-top: 32px;">
<h3 style="font-weight: bold; color: #5b21b6; margin-bottom: 12px;">IL PARTNER</h3>
<p style="font-size: 13px; color: #475569;">Nome e Cognome: ______________________________</p>
<p style="font-size: 13px; color: #475569; margin-top: 16px;">Firma: ______________________________</p>
<p style="font-size: 13px; color: #475569; margin-top: 16px;">Data: ______________________________</p>
</div>
`;
}
