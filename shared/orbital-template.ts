import { SECTIONS_MARKER, type ModularSection } from "./sections";

const H2 = `<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">`;
const CARD = `<div style="padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; margin: 16px 0;">`;
const H3 = `<h3 style="font-size: 16px; font-weight: bold; color: #1e293b;">`;

const PREMESSE_AND_DEFINITIONS = `
${H2}PREMESSE</h2>

<p>Il presente Contratto di Licenza d'Uso Software (di seguito "Contratto") disciplina i termini e le condizioni per la concessione in licenza d'uso della piattaforma proprietaria di intelligenza artificiale denominata <strong>Sistema Orbitale</strong> (di seguito "Piattaforma"), sviluppata e di proprietà esclusiva del Fornitore.</p>

<p>La Piattaforma costituisce un sistema integrato di automazione aziendale basato su intelligenza artificiale, progettato per automatizzare la gestione dei lead, le comunicazioni con i clienti, la formazione del personale e le attività commerciali tramite un team di Dipendenti AI specializzati.</p>

<p>Il presente Contratto è strutturato su due livelli complementari:</p>
<ul>
<li><strong>LIVELLO 1 — COMMERCIALE</strong>: disciplina l'oggetto, i servizi inclusi, il modello economico, la durata e le condizioni operative della licenza d'uso;</li>
<li><strong>LIVELLO 2 — PROTEZIONE LEGALE</strong>: disciplina la proprietà intellettuale, la responsabilità, le clausole restrittive, la risoluzione e il foro competente.</li>
</ul>

<div style="text-align: center; padding: 20px; border-radius: 12px; background: linear-gradient(90deg, #4f46e5, #2563eb); color: white; margin: 32px 0; font-weight: bold; font-size: 20px;">
LIVELLO 1 — PARTE COMMERCIALE
</div>

${H2}ARTICOLO 1 — DEFINIZIONI</h2>

<p style="font-style: italic; color: #64748b;">Ai fini del presente Contratto, i seguenti termini assumono il significato di seguito indicato:</p>

<p><strong>"Piattaforma"</strong>: il sistema software proprietario di intelligenza artificiale denominato Sistema Orbitale, comprensivo di tutti i moduli, le funzionalità, le interfacce, le API, i database e i servizi accessori descritti nel presente Contratto, accessibile via web e ospitato su infrastruttura cloud gestita dal Fornitore.</p>
<p><strong>"Licenza d'Uso"</strong>: il diritto non esclusivo, non trasferibile e revocabile concesso al Cliente di utilizzare la Piattaforma nei limiti e secondo le modalità stabilite dal presente Contratto.</p>
<p><strong>"Sistema Orbitale"</strong> (o <strong>"Orbitale"</strong>): il nome commerciale della Piattaforma.</p>
<p><strong>"Dipendente AI"</strong>: ciascuno degli agenti di intelligenza artificiale specializzati integrati nella Piattaforma, addestrabili sulla base dei documenti e delle istruzioni fornite dal Cliente, operanti su diversi canali (WhatsApp, Instagram, Email, Telefono).</p>
<p><strong>"Livello di Accesso"</strong>: il pacchetto di funzionalità e servizi della Piattaforma scelto dal Cliente tra quelli disponibili (Livello 1 Free, Livello 2 Starter, Livello 3 Professional, Livello 4 Setter AI + Hunter, Livello 5 Enterprise, Livello 6 Enterprise + Consulenza). Il Livello sottoscritto è specificato nelle condizioni particolari del presente Contratto: <strong>{{livello_accesso}}</strong>.</p>
<p><strong>"Setter AI" (Stella)</strong>: il Dipendente AI che risponde automaticamente ai lead su WhatsApp e Instagram, li qualifica con framework BANT e prenota appuntamenti nel calendario del Cliente.</p>
<p><strong>"Hunter"</strong>: il Dipendente AI che effettua lead generation proattiva cercando potenziali clienti su Google Maps e Google Search, analizzando la loro presenza online e assegnando un punteggio di compatibilità AI.</p>
<p><strong>"Alessia AI"</strong>: il Dipendente AI vocale che effettua e riceve chiamate telefoniche con voce naturale, gestisce il centralino AI e qualifica i lead via telefono.</p>
<p><strong>"Millie"</strong>: il Dipendente AI che gestisce la inbox email del Cliente, classifica le email per tipo e urgenza, genera risposte professionali e programma follow-up automatici.</p>
<p><strong>"Sofia" (AdVisage AI)</strong>: il Dipendente AI creativo che analizza i testi pubblicitari, genera concept visivi per campagne ads e produce contenuti social professionali.</p>
<p><strong>"Nova"</strong>: il Dipendente AI dedicato al content marketing, alla gestione del calendario editoriale e alla pubblicazione sui social media.</p>
<p><strong>"Marco"</strong>: il Dipendente AI Executive Coach per l'imprenditore, fornisce briefing giornalieri, agenda e supporto strategico.</p>
<p><strong>"Echo"</strong>: il Dipendente AI che produce riepiloghi automatici delle consulenze, trascrizioni, dashboard insights e documentazione.</p>
<p><strong>"Knowledge Base"</strong>: l'archivio documentale digitale alimentabile dal Cliente (PDF, DOCX, TXT, URL) dal quale l'intelligenza artificiale attinge per formulare risposte accurate basate su fonti verificabili (tecnologia RAG — Retrieval Augmented Generation).</p>
<p><strong>"Lead"</strong>: un potenziale cliente del Cliente che ha manifestato interesse o che viene contattato proattivamente tramite i Dipendenti AI della Piattaforma.</p>
<p><strong>"Canone Mensile"</strong>: il corrispettivo fisso ricorrente dovuto dal Cliente al Fornitore per l'utilizzo della Piattaforma, variabile in base al Livello di Accesso sottoscritto.</p>
<p><strong>"Costo di Attivazione"</strong> o <strong>"Setup"</strong>: il corrispettivo una tantum dovuto dal Cliente per la configurazione iniziale della Piattaforma, ove previsto dal Livello di Accesso scelto.</p>

${H2}ARTICOLO 2 — OGGETTO DEL CONTRATTO</h2>

<p><strong>2.1.</strong> Il Fornitore concede al Cliente una Licenza d'Uso della Piattaforma Sistema Orbitale, non esclusiva, non trasferibile e non sublicenziabile, per la durata e alle condizioni stabilite dal presente Contratto, con il Livello di Accesso indicato nelle condizioni particolari (<strong>{{livello_accesso}}</strong>).</p>
<p><strong>2.2.</strong> La Licenza d'Uso comprende l'accesso ai moduli e alle funzionalità della Piattaforma previsti dal Livello di Accesso sottoscritto, come dettagliati nell'Articolo 3, inclusi gli aggiornamenti e le evoluzioni rilasciate dal Fornitore durante il periodo di validità del Contratto.</p>
<p><strong>2.3.</strong> Il Cliente acquisisce il diritto di utilizzare la Piattaforma esclusivamente per la propria attività aziendale. La Licenza d'Uso non comprende il diritto di rivendita, sublicenza o distribuzione della Piattaforma a terzi.</p>
<p><strong>2.4.</strong> La Piattaforma è fornita in modalità SaaS (Software as a Service), accessibile via browser web. Il Fornitore si occupa dell'hosting, della manutenzione dell'infrastruttura e degli aggiornamenti tecnici.</p>
`;

const TEAM_TABLE = `
${CARD}
${H3}Il Team di Dipendenti AI (riferimento trasversale)</h3>
<p>La Piattaforma mette a disposizione del Cliente un team completo di Dipendenti AI specializzati, ciascuno dedicato a una funzione aziendale specifica. La disponibilità di ciascun Dipendente dipende dal Livello di Accesso sottoscritto.</p>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px;">
<thead>
<tr style="background: #eef2ff; border-bottom: 2px solid #c7d2fe;">
<th style="padding: 10px 12px; text-align: left; font-weight: bold; color: #1e293b;">Dipendente AI</th>
<th style="padding: 10px 12px; text-align: left; font-weight: bold; color: #1e293b;">Ruolo</th>
<th style="padding: 10px 12px; text-align: left; font-weight: bold; color: #1e293b;">Livello Minimo</th>
</tr>
</thead>
<tbody>
<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;"><strong>Setter AI (Stella)</strong></td><td style="padding: 10px 12px;">Risponde ai lead su WhatsApp/Instagram, qualifica e prenota appuntamenti</td><td style="padding: 10px 12px;">Livello 4</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;"><td style="padding: 10px 12px;"><strong>Hunter</strong></td><td style="padding: 10px 12px;">Trova nuovi lead su Google, qualifica con AI scoring, contatta automaticamente</td><td style="padding: 10px 12px;">Livello 4</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;"><strong>Alessia AI</strong></td><td style="padding: 10px 12px;">Chiamate vocali con voce naturale, centralino AI inbound/outbound</td><td style="padding: 10px 12px;">Livello 4</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;"><td style="padding: 10px 12px;"><strong>Millie</strong></td><td style="padding: 10px 12px;">Gestione email intelligente, classificazione, risposte e follow-up automatici</td><td style="padding: 10px 12px;">Livello 4</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;"><strong>Marco</strong></td><td style="padding: 10px 12px;">Coach AI per l'imprenditore, briefing giornalieri, agenda, supporto strategico</td><td style="padding: 10px 12px;">Livello 3</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;"><td style="padding: 10px 12px;"><strong>Echo</strong></td><td style="padding: 10px 12px;">Riepiloghi consulenze, trascrizioni, documentazione automatica</td><td style="padding: 10px 12px;">Livello 3</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;"><strong>Nova</strong></td><td style="padding: 10px 12px;">Social media, content studio, calendario editoriale, pubblicazione</td><td style="padding: 10px 12px;">Livello 3</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;"><td style="padding: 10px 12px;"><strong>Sofia (AdVisage AI)</strong></td><td style="padding: 10px 12px;">Campagne ads, concept pubblicitari, fabbrica creativa AI</td><td style="padding: 10px 12px;">Livello 4</td></tr>
<tr><td style="padding: 10px 12px;"><strong>Personalizza</strong></td><td style="padding: 10px 12px;">Assistente AI configurabile liberamente per qualsiasi reparto</td><td style="padding: 10px 12px;">Livello 2</td></tr>
</tbody>
</table>
</div>
`;

// Built dynamically from getOrbitalServicePackages() so the inline (full)
// version of the contract stays in sync with the modular sections (single
// source of truth — same 36.x titles and same content).
function buildInlinePackagesHtml(): string {
  // Each pkg.content already includes its own CARD wrapper (<div>…</div>),
  // so we only emit the heading above it. Wrapping again would leave
  // unbalanced <div> elements and break PDF rendering.
  return getOrbitalServicePackages()
    .map(
      (pkg) => `
${H3}${pkg.title}</h3>
${pkg.content}`,
    )
    .join("\n");
}

const ACCESS_LEVELS_TABLE_NO_PRICES = `
${H2}ARTICOLO 4 — LIVELLI DI ACCESSO E FUNZIONALITÀ</h2>

<p style="font-style: italic; color: #64748b;">La Piattaforma è disponibile in 6 Livelli di Accesso. Il Cliente sottoscrive il Livello indicato nelle condizioni particolari del presente Contratto: <strong>{{livello_accesso}}</strong>.</p>

<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
<thead>
<tr style="background: linear-gradient(90deg, #4f46e5, #2563eb); color: white;">
<th style="padding: 12px; text-align: left; font-weight: bold;">Livello</th>
<th style="padding: 12px; text-align: left; font-weight: bold;">Nome</th>
<th style="padding: 12px; text-align: left; font-weight: bold;">Funzionalità Principali</th>
</tr>
</thead>
<tbody>
<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;"><strong>Livello 1</strong></td><td style="padding: 10px 12px;">Free</td><td style="padding: 10px 12px;">Prova della Piattaforma, accesso limitato, senza carta di credito</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;"><td style="padding: 10px 12px;"><strong>Livello 2</strong></td><td style="padding: 10px 12px;">Starter</td><td style="padding: 10px 12px;">Messaggi illimitati, Dipendente AI personalizzabile</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;"><strong>Livello 3</strong></td><td style="padding: 10px 12px;">Professional</td><td style="padding: 10px 12px;">Corsi, voce, memoria AI persistente, Marco, Echo, Nova</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0; background: #eef2ff;"><td style="padding: 10px 12px;"><strong>Livello 4</strong></td><td style="padding: 10px 12px;"><strong>Setter AI + Hunter</strong></td><td style="padding: 10px 12px;">Il prodotto di punta: Setter AI che prende appuntamenti + Hunter che trova lead + Alessia AI + Millie + Sofia. Team completo di Dipendenti AI</td></tr>
<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;"><strong>Livello 5</strong></td><td style="padding: 10px 12px;">Enterprise</td><td style="padding: 10px 12px;">Infrastruttura completa, configurazioni avanzate, priorità assistenza</td></tr>
<tr><td style="padding: 10px 12px;"><strong>Livello 6</strong></td><td style="padding: 10px 12px;">Enterprise + Consulenza</td><td style="padding: 10px 12px;">Tutto + consulenza strategica sui processi aziendali</td></tr>
</tbody>
</table>

<div style="padding: 14px; border-radius: 10px; background: #eef2ff; border: 1px solid #c7d2fe; margin: 12px 0; font-size: 14px;">
<p style="margin: 0;"><strong>Livello sottoscritto:</strong> {{livello_accesso}} &nbsp;|&nbsp; <strong>Canone Mensile:</strong> {{canone_mensile}} &nbsp;|&nbsp; <strong>Costo di Attivazione:</strong> {{costo_attivazione}}</p>
</div>

<p>Il passaggio a un Livello superiore è sempre possibile durante la vigenza del Contratto, previo aggiornamento delle condizioni economiche. Il passaggio a un Livello inferiore è possibile alla scadenza del periodo contrattuale in corso.</p>
`;

const REMAINING_ARTICLES = `
${H2}ARTICOLO 5 — AGGIORNAMENTI E MANUTENZIONE</h2>

<p><strong>5.1. Aggiornamenti Base.</strong> Il Fornitore rilascia periodicamente aggiornamenti della Piattaforma che includono: correzioni di bug, miglioramenti delle prestazioni, aggiornamenti di sicurezza ed evoluzioni delle funzionalità esistenti. Tali aggiornamenti sono sempre inclusi nel Canone Mensile senza costi aggiuntivi.</p>
<p><strong>5.2. Manutenzione Programmata.</strong> Il Fornitore può eseguire interventi di manutenzione programmata che comportino temporanea indisponibilità della Piattaforma, previo avviso al Cliente con almeno 24 ore di anticipo.</p>

${H2}ARTICOLO 6 — SUPPORTO TECNICO</h2>

<p><strong>6.1. Livello 1 — Supporto Operativo.</strong> Il supporto di primo livello è a disposizione del Cliente tramite: assistenza WhatsApp AI 24/7, documentazione della Piattaforma e materiali formativi inclusi.</p>
<p><strong>6.2. Livello 2 — Supporto Tecnico.</strong> Per problematiche tecniche (bug, malfunzionamenti, errori), il Cliente può aprire un ticket via email. Il Fornitore si impegna a fornire una prima risposta entro quarantotto (48) ore lavorative.</p>
<p><strong>6.3. Esclusioni.</strong> Il supporto non copre: problemi derivanti da uso improprio della Piattaforma, interruzioni di servizi di terze parti (WhatsApp, Meta, Google, Twilio), personalizzazioni extra non previste dal Livello di Accesso, formazione individuale oltre ai materiali forniti.</p>

${H2}ARTICOLO 7 — MODELLO ECONOMICO — CORRISPETTIVI</h2>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">7.1. Costo di Attivazione (Setup)</h3>
<p>All'atto della sottoscrizione, ove previsto dal Livello di Accesso scelto, il Cliente corrisponde un costo di attivazione una tantum pari a <strong>{{costo_attivazione}}</strong>, comprensivo di: configurazione iniziale della Piattaforma, creazione dell'ambiente dedicato, setup dei Dipendenti AI, caricamento iniziale della Knowledge Base, formazione iniziale (onboarding guidato).</p>
<p>Il costo di attivazione può essere ridotto o azzerato a insindacabile discrezione del Fornitore nell'ambito di promozioni o offerte commerciali.</p>
</div>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">7.2. Canone Mensile Fisso</h3>
<p>Il Cliente corrisponde un canone mensile fisso pari a <strong>{{canone_mensile}}</strong>, corrispondente al Livello di Accesso sottoscritto ({{livello_accesso}}), dovuto anticipatamente entro il giorno 5 di ogni mese solare, a partire dal mese successivo alla data di attivazione.</p>
<p>Il Canone include: accesso ai moduli previsti dal Livello, aggiornamenti base, assistenza WhatsApp AI 24/7, supporto tecnico via ticket.</p>
</div>

<p><strong>7.3. Costi di Servizi Terzi.</strong> Restano a carico del Cliente i costi di servizi di terze parti necessari al funzionamento di alcuni moduli: messaggistica WhatsApp (Twilio, ~€0,05/msg), API AI (Google Vertex AI / Gemini), invio email (SMTP), configurazione WhatsApp Business (Meta). Il Fornitore non è responsabile per variazioni di prezzo dei fornitori terzi.</p>
<p><strong>7.4. Modalità di Pagamento.</strong> Pagamenti tramite Stripe o bonifico bancario. Le condizioni specifiche del piano di pagamento sono indicate in {{payment_plan}}.</p>

${H2}ARTICOLO 8 — DURATA E RINNOVO</h2>

<p><strong>8.1.</strong> Il presente Contratto ha durata minima di 12 mesi dalla data di sottoscrizione.</p>
<p><strong>8.2.</strong> Rinnovo automatico per ulteriori periodi di 12 mesi ciascuno, salvo disdetta nei termini dell'Articolo 9.</p>
<p><strong>8.3.</strong> Il Canone resta invariato per il periodo contrattuale in corso. Eventuali adeguamenti sono comunicati con almeno 60 giorni di preavviso prima della scadenza, con facoltà di recesso entro 30 giorni dalla comunicazione senza penali.</p>

${H2}ARTICOLO 9 — RECESSO</h2>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">9.1. Recesso del Cliente</h3>
<p>Preavviso minimo di 30 giorni via PEC o raccomandata A/R. Il recesso ha effetto alla scadenza del periodo contrattuale in corso (12 mesi). Il Cliente resta obbligato al pagamento dei canoni residui fino alla naturale scadenza.</p>
</div>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">9.2. Recesso del Fornitore</h3>
<p>Preavviso minimo di 30 giorni via PEC o raccomandata A/R. Il Cliente non è tenuto al pagamento di canoni successivi alla data di efficacia del recesso. Il Fornitore garantisce 30 giorni per l'esportazione dei dati.</p>
</div>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">9.3. Effetti del Recesso</h3>
<p>Alla cessazione del Contratto:</p>
<ul>
<li>l'accesso alla Piattaforma viene disattivato;</li>
<li>il Cliente perde il diritto di utilizzo di tutti i materiali, software, prompt, architettura e configurazioni della Piattaforma;</li>
<li>i dati anagrafici dei clienti del Cliente sono disponibili per l'esportazione entro 30 giorni dalla cessazione;</li>
<li>le configurazioni dei Dipendenti AI, i corsi generati e i contenuti creati tramite la Piattaforma non sono esportabili.</li>
</ul>
</div>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">9.4. Cessazione dell'attività del Fornitore</h3>
<p>Il presente Contratto si intende automaticamente risolto, senza necessità di ulteriori formalità, qualora il Fornitore cessi la propria attività e non trasferisca a un soggetto terzo il ramo d'azienda, la Piattaforma, i dati e le configurazioni necessari a garantire la continuità del servizio al Cliente. La risoluzione decorre dalla data della comunicazione formale dell'evento al Cliente.</p>
<p>In tal caso il Cliente non è tenuto al pagamento di canoni successivi a tale data e ha diritto al rimborso pro-quota del canone eventualmente già corrisposto e non goduto. Il Fornitore garantisce in ogni caso la disponibilità all'esportazione dei dati anagrafici dei clienti del Cliente per 30 giorni dalla comunicazione di cessazione.</p>
</div>

<div style="text-align: center; padding: 20px; border-radius: 12px; background: linear-gradient(90deg, #4f46e5, #2563eb); color: white; margin: 32px 0; font-weight: bold; font-size: 20px;">
LIVELLO 2 — PROTEZIONE LEGALE
</div>

${H2}ARTICOLO 10 — PROPRIETÀ INTELLETTUALE</h2>

<p><strong>10.1.</strong> La Piattaforma, in ogni sua componente, è di proprietà esclusiva del Fornitore: codice sorgente e compilato, architettura, design, prompt AI, istruzioni di addestramento, quiz, template, materiali formativi, nomi, marchi, loghi, documentazione tecnica, algoritmi, logiche operative, know-how.</p>
<p><strong>10.2.</strong> Qualsiasi sviluppo custom realizzato dal Fornitore su richiesta del Cliente, anche se pagato, è di proprietà esclusiva del Fornitore, che può riutilizzarlo liberamente.</p>
<p><strong>10.3.</strong> Il Cliente si impegna a non decompilare, disassemblare, effettuare reverse engineering, copiare, riprodurre, modificare, adattare, tradurre, creare opere derivate o tentare di risalire al codice sorgente, ai prompt, all'architettura o alla logica della Piattaforma.</p>

${H2}ARTICOLO 11 — TITOLARITÀ E TRATTAMENTO DEI DATI</h2>

<p><strong>11.1.</strong> Il Cliente è titolare dei propri dati anagrafici e di contatto e di quelli dei propri clienti inseriti nella Piattaforma. In caso di cessazione, tali dati saranno disponibili per l'esportazione entro 30 giorni.</p>
<p><strong>11.2.</strong> Il Fornitore è titolare dei dati generati dall'utilizzo della Piattaforma: log conversazioni AI, dati di utilizzo e analytics, contenuti generati dall'AI, metriche, dati di addestramento.</p>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">11.3. Segregazione e Riservatezza dei Dati</h3>
<ul>
<li>Ciascun Cliente vede esclusivamente i propri dati all'interno della Piattaforma. Non ha accesso ai dati di altri Clienti;</li>
<li>la Knowledge Base è segregata tra i diversi Clienti: ciascun Cliente ha una Knowledge Base indipendente e inaccessibile agli altri;</li>
<li>i Dipendenti AI del Cliente operano in un contesto isolato, elaborando esclusivamente i dati del Cliente e utilizzando la sua Knowledge Base.</li>
</ul>
</div>

${CARD}
<h3 style="font-weight: bold; color: #1e293b;">11.4. Sicurezza dei Dati</h3>
<ul>
<li>Misure tecniche e organizzative adeguate a garantire riservatezza, integrità e disponibilità dei dati;</li>
<li>backup automatici e ridondanza dell'infrastruttura per assicurare continuità operativa;</li>
<li>crittografia dei dati in transito (TLS/HTTPS) e a riposo nei database;</li>
<li>monitoraggio continuo della sicurezza e aggiornamenti tempestivi.</li>
</ul>
</div>

<p><strong>11.5. Trattamento dei Dati Personali.</strong> Ciascuna Parte tratta i dati personali nel rispetto del GDPR (Reg. UE 2016/679) e della normativa nazionale vigente. Le Parti si impegnano a sottoscrivere, ove necessario, un Data Processing Agreement.</p>

${H2}ARTICOLO 12 — MANLEVA E LIMITAZIONE DI RESPONSABILITÀ</h2>

<div style="padding: 16px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa; margin: 16px 0;">
<p><strong>12.1. Manleva sull'AI.</strong> Il Cliente riconosce che l'AI opera su modelli probabilistici e può generare risposte inesatte ("allucinazioni"). Il Cliente manleva e tiene indenne il Fornitore da qualsiasi responsabilità, danno, costo, pretesa o azione legale derivante da: risposte errate dell'AI, decisioni prese sulla base di informazioni generate dall'AI, danni di qualsiasi natura derivanti dall'utilizzo delle risposte AI, violazioni normative derivanti da uso improprio della Piattaforma.</p>
</div>

<p><strong>12.2.</strong> La responsabilità complessiva del Fornitore non potrà in nessun caso eccedere l'importo dei Canoni Mensili corrisposti dal Cliente nei 12 mesi precedenti l'evento che ha dato origine alla pretesa.</p>
<p><strong>12.3.</strong> La Piattaforma è fornita "così com'è" e "come disponibile". Nessuna garanzia espressa o implicita circa l'idoneità a scopi particolari, l'assenza di errori, la disponibilità ininterrotta o l'accuratezza dell'AI.</p>

${H2}ARTICOLO 13 — SOSPENSIONE DEL SERVIZIO</h2>

<p><strong>13.1.</strong> Il Fornitore può sospendere l'accesso alla Piattaforma, con preavviso di 24 ore, nei seguenti casi: mancato pagamento oltre 15 giorni dalla scadenza, violazione contrattuale, uso illegale o contrario alle policy della Piattaforma, rischio per la sicurezza, richiesta dell'autorità giudiziaria o amministrativa.</p>
<p><strong>13.2.</strong> Nessun indennizzo, riduzione o compensazione è dovuto al Cliente durante il periodo di sospensione. Il Canone Mensile resta dovuto.</p>
<p><strong>13.3.</strong> Riattivazione entro 24 ore dalla rimozione della causa che ha determinato la sospensione.</p>

${H2}ARTICOLO 14 — CESSIONE DEL CONTRATTO</h2>

<p><strong>14.1.</strong> Il Fornitore può cedere il presente Contratto a terzi con 30 giorni di preavviso, senza necessità di consenso del Cliente.</p>
<p><strong>14.2.</strong> Il Cliente non può cedere il presente Contratto senza previo consenso scritto del Fornitore.</p>

${H2}ARTICOLO 15 — BRANDING E ATTRIBUZIONE</h2>

<p><strong>15.1.</strong> La Piattaforma riporta la dicitura "Powered by Sistema Orbitale" (o equivalente) in ogni manifestazione visibile ai clienti finali. Il Cliente si impegna a non rimuovere, oscurare o modificare tale attribuzione.</p>
<p><strong>15.2.</strong> Il Fornitore può utilizzare nome e logo del Cliente come referenza commerciale, salvo diverso accordo scritto.</p>

${H2}ARTICOLO 16 — RISERVATEZZA</h2>

<p><strong>16.1.</strong> Ciascuna Parte mantiene riservate tutte le informazioni confidenziali ricevute dall'altra Parte nell'ambito del presente Contratto.</p>
<p><strong>16.2.</strong> L'obbligo di riservatezza permane per 5 anni dalla cessazione del Contratto.</p>
<p><strong>16.3.</strong> Sono escluse dall'obbligo di riservatezza: le informazioni di dominio pubblico, quelle già in legittimo possesso della Parte ricevente, quelle che devono essere divulgate per obbligo di legge.</p>

${H2}ARTICOLO 17 — CLAUSOLA RISOLUTIVA ESPRESSA</h2>

<p>Ai sensi dell'art. 1456 c.c., il Fornitore può dichiarare risolto il Contratto, mediante comunicazione via PEC, nei seguenti casi:</p>
<ul>
<li>mancato pagamento di 2 o più canoni consecutivi;</li>
<li>violazione delle clausole di proprietà intellettuale (Art. 10);</li>
<li>cessione non autorizzata del Contratto;</li>
<li>violazione dell'obbligo di riservatezza;</li>
<li>rimozione del branding e attribuzione;</li>
<li>uso illecito o contrario alle policy della Piattaforma;</li>
<li>fallimento, insolvenza o apertura di procedura concorsuale a carico del Cliente.</li>
</ul>
<p>In caso di risoluzione per inadempimento del Cliente, il Fornitore ha diritto ai canoni residui fino alla scadenza del periodo contrattuale in corso, oltre al risarcimento del maggior danno.</p>

${H2}ARTICOLO 18 — FORZA MAGGIORE</h2>

<p>Nessuna Parte è responsabile per inadempimenti causati da eventi di forza maggiore: calamità naturali, guerre, atti di terrorismo, pandemie, provvedimenti dell'autorità, interruzioni prolungate di servizi essenziali di terze parti.</p>

${H2}ARTICOLO 19 — NON ESCLUSIVITÀ</h2>

<p>Il presente Contratto non conferisce al Cliente alcun diritto di esclusiva. Il Fornitore è libero di concedere licenze ad altri soggetti, anche nello stesso settore o area geografica del Cliente.</p>

${H2}ARTICOLO 20 — COMUNICAZIONI</h2>

<p>Tutte le comunicazioni formali devono essere effettuate in forma scritta via PEC o raccomandata A/R agli indirizzi indicati in intestazione del Contratto. Le comunicazioni si intendono ricevute alla data di ricezione della PEC o della raccomandata.</p>

${H2}ARTICOLO 21 — LEGGE APPLICABILE E FORO COMPETENTE</h2>

<p><strong>21.1.</strong> Il presente Contratto è regolato dalla legge italiana.</p>
<p><strong>21.2.</strong> Per qualsiasi controversia derivante dal presente Contratto o ad esso connessa, le Parti riconoscono la competenza esclusiva del Foro di Messina, con espressa rinuncia a qualsiasi altro foro concorrente.</p>

${H2}ARTICOLO 22 — DISPOSIZIONI FINALI</h2>

<p><strong>22.1. Intero Accordo.</strong> Il presente Contratto costituisce l'intero accordo tra le Parti in relazione al suo oggetto e sostituisce qualsiasi precedente accordo, intesa o comunicazione, scritta o orale.</p>
<p><strong>22.2. Modifiche.</strong> Qualsiasi modifica al presente Contratto deve essere concordata per iscritto e sottoscritta da entrambe le Parti.</p>
<p><strong>22.3. Nullità Parziale.</strong> Se una clausola del presente Contratto è dichiarata nulla o inefficace, le restanti clausole rimangono pienamente valide ed efficaci. Le Parti si impegnano a sostituire la clausola nulla con una clausola valida di effetto economico e giuridico il più possibile simile.</p>
<p><strong>22.4. Tolleranza.</strong> La mancata applicazione di una clausola da parte del Fornitore non costituisce rinuncia al diritto di applicarla successivamente.</p>
<p><strong>22.5. Copie.</strong> Il presente Contratto è redatto in due copie originali, una per ciascuna Parte.</p>

<div style="text-align: center; padding: 20px; border-radius: 12px; background: linear-gradient(90deg, #4f46e5, #2563eb); color: white; margin: 32px 0; font-weight: bold; font-size: 18px;">
APPROVAZIONE SPECIFICA<br>
<span style="font-size: 13px; font-weight: normal; opacity: 0.9;">ai sensi degli articoli 1341 e 1342 del Codice Civile</span>
</div>

<p>Il Cliente <strong>{{cliente_nome}}</strong> per <strong>{{societa}}</strong> (P.IVA {{p_iva}}, con sede in {{sede}}), con la sottoscrizione del presente Contratto, dichiara di aver letto, compreso e di approvare specificamente le seguenti clausole:</p>

<div style="padding: 16px; border-radius: 12px; background: #fef2f2; border: 1px solid #fecaca; margin: 16px 0;">
<ul>
<li><strong>Art. 8</strong> — Durata minima e rinnovo automatico</li>
<li><strong>Art. 9</strong> — Recesso e obbligo pagamento canoni residui</li>
<li><strong>Art. 10</strong> — Proprietà intellettuale esclusiva del Fornitore</li>
<li><strong>Art. 12</strong> — Manleva AI e limitazione di responsabilità</li>
<li><strong>Art. 13</strong> — Sospensione del servizio senza indennizzo</li>
<li><strong>Art. 14</strong> — Cessione del contratto</li>
<li><strong>Art. 17</strong> — Clausola risolutiva espressa</li>
<li><strong>Art. 19</strong> — Non esclusività</li>
<li><strong>Art. 21</strong> — Foro esclusivo di Messina</li>
</ul>
</div>

<p>La firma digitale apposta tramite OTP al presente Contratto costituisce accettazione espressa di tutte le clausole sopra elencate ai sensi e per gli effetti degli artt. 1341 e 1342 del Codice Civile.</p>
`;

const ART3_HEADER = `
${H2}ARTICOLO 3 — PACCHETTI DI SERVIZI INCLUSI (Capitolo 36 del Manuale)</h2>

<p style="font-style: italic; color: #64748b;">La Piattaforma è organizzata in <strong>11 Pacchetti di Servizi</strong> (Capitolo 36 del Manuale operativo: 36.1 → 36.11), descritti in dettaglio affinché il Cliente abbia piena consapevolezza di ciò che acquisisce. La disponibilità di ciascun Pacchetto dipende dal Livello di Accesso sottoscritto ({{livello_accesso}}).</p>
`;

const BONUS_BLOCK = `
${H2}BONUS INCLUSI</h2>
<p style="font-style: italic; color: #64748b;">Eventuali bonus aggiuntivi specifici dell'offerta sottoscritta dal Cliente.</p>
<ul>
<!-- BLOCK:BONUS_LIST -->
<li>{{bonus_descrizione}}</li>
<!-- END_BLOCK:BONUS_LIST -->
</ul>
`;

export function getOrbitalContractFullHtml(): string {
  return `${PREMESSE_AND_DEFINITIONS}
${ART3_HEADER}
${TEAM_TABLE}
${buildInlinePackagesHtml()}
${ACCESS_LEVELS_TABLE_NO_PRICES}
${BONUS_BLOCK}
${REMAINING_ARTICLES}`;
}

export function getOrbitalContractEmptyHtml(): string {
  return `${PREMESSE_AND_DEFINITIONS}
${ART3_HEADER}
${TEAM_TABLE}

<p style="font-style: italic; color: #64748b; margin: 12px 0;">Di seguito sono descritti in dettaglio i Pacchetti di Servizi sottoscritti dal Cliente nelle condizioni particolari del presente Contratto. Solo i pacchetti effettivamente attivati formano parte integrante della Licenza d'Uso.</p>

${SECTIONS_MARKER}

${ACCESS_LEVELS_TABLE_NO_PRICES}
${BONUS_BLOCK}
${REMAINING_ARTICLES}`;
}

export function getOrbitalServicePackages(): ModularSection[] {
  return [
    {
      id: "pkg_setter_ai",
      title: "36.1 SETTER AI – Acquisizione & Primo Contatto",
      description: "Agenti WhatsApp 24/7, presa appuntamento automatica, Weekly Check-in, campagne marketing.",
      defaultEnabled: true,
      required: false,
      order: 0,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Il pacchetto fondamentale per acquisire nuovi clienti e gestire il primo contatto in modo automatizzato. Trasforma lead freddi in appuntamenti qualificati grazie al Setter AI (Stella) su WhatsApp e Instagram, all'email di outreach e alla presa appuntamento automatica. Include la possibilità di configurare agenti WhatsApp dedicati all'assistenza clienti post-vendita.</p>
<p><strong>Per chi è pensato.</strong> Qualsiasi professionista che vuole automatizzare l'acquisizione clienti, non perdere mai un lead, e delegare l'assistenza clienti a un AI addestrato che lavora al posto suo.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Setter AI (Stella) — WhatsApp e Instagram:</strong> risposta automatica 24/7, qualifica BANT, prenotazione appuntamenti nel calendario del Cliente con escalation umana intelligente.</li>
<li><strong>Template WhatsApp:</strong> template pre-approvati da Meta per iniziare conversazioni con i lead.</li>
<li><strong>Email Hub Outreach:</strong> invio email di primo contatto e follow-up automatico ai lead.</li>
<li><strong>Presa Appuntamento:</strong> booking automatico integrato con il calendario del Cliente.</li>
<li><strong>Weekly Check-in:</strong> sistema automatico di contatto settimanale via WhatsApp per mantenere il rapporto.</li>
<li><strong>Campagne Marketing WhatsApp:</strong> invio massivo di template a liste di contatti segmentate, con statistiche di consegna, lettura e conversione.</li>
<li><strong>Venditori Autonomi AI:</strong> agenti AI per conversazioni di vendita su landing page pubblica.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> Configurazione iniziale di API Key AI, SMTP e WhatsApp Business (Twilio).</p>
</div>`,
    },
    {
      id: "pkg_dipendenti_autonomi",
      title: "36.2 DIPENDENTI AI AUTONOMI – Team AI 24/7",
      description: "Team di Dipendenti AI specializzati che lavorano in autonomia su email, WhatsApp, social, briefing e knowledge.",
      defaultEnabled: true,
      required: false,
      order: 1,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Un team completo di Dipendenti AI che lavorano autonomamente 24 ore su 24. Ogni Dipendente ha un ruolo specifico: dalla gestione email alla ricerca lead, dall'analisi executive al supporto clienti. Configurali una volta e lascia che lavorino per il Cliente. I clienti finali con licenza Premium possono accedere a un proprio AI Assistant personale in piattaforma con memoria persistente.</p>
<p><strong>Per chi è pensato.</strong> Consulenti e professionisti che vogliono delegare attività operative all'AI senza supervisione costante e offrire ai propri clienti un'esperienza premium.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Sistema AI Autonomy:</strong> piattaforma centrale per gestire i Dipendenti AI con task, scheduling e monitoraggio.</li>
<li><strong>Alessia AI</strong> — receptionist virtuale e assistente principale.</li>
<li><strong>Millie</strong> — gestione email automatizzata con risposte AI (richiede SMTP configurato; per il pacchetto Email Journey vedi Pacchetto 4).</li>
<li><strong>Stella (Setter AI)</strong> — assistente WhatsApp per follow-up e nurturing (vedi anche Pacchetto 1).</li>
<li><strong>Echo</strong> — riepilogatore e analista, genera sommari e dashboard insights automatici.</li>
<li><strong>Nova</strong> — social media manager AI per contenuti e pubblicazione (vedi anche Pacchetto 7).</li>
<li><strong>Marco</strong> — Executive Coach AI per analisi strategica, briefing giornalieri e suggerimenti operativi.</li>
<li><strong>Hunter</strong> — vedi Pacchetto 3 per il dettaglio delle 4 modalità.</li>
<li><strong>Sofia (AdVisage AI)</strong> — vedi Pacchetto 7 per la fabbrica creativa.</li>
<li><strong>Personalizza:</strong> Dipendenti AI personalizzabili con ruolo e istruzioni custom per qualsiasi reparto.</li>
<li><strong>Telegram Bot:</strong> integrazione Telegram per ricevere notifiche e interagire con i Dipendenti AI.</li>
<li><strong>AI Assistant Cliente Finale:</strong> assistente AI con memoria persistente per i clienti del Cliente, addestrabile via System Prompt e Knowledge Base.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> API Key AI configurata. Per Stella: WhatsApp Business; per Millie: SMTP; per Hunter: Lead Scraper attivo.</p>
</div>`,
    },
    {
      id: "pkg_hunter",
      title: "36.3 HUNTER – Lead Generation & Outreach Proattivo",
      description: "Ricerca lead su Google Maps/Search con AI scoring e contatto automatico multicanale.",
      defaultEnabled: true,
      required: false,
      order: 2,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Il sistema completo per trovare nuovi lead, arricchirli con informazioni e contattarli in modo proattivo tramite chiamate, email e WhatsApp. Hunter lavora in 4 modalità (Ricerca, Strutturato, Outreach, People) per coprire ogni fase del prospecting.</p>
<p><strong>Per chi è pensato.</strong> Consulenti, agenzie e venditori che fanno cold outreach e vogliono automatizzare la ricerca e il contatto di nuovi clienti.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Lead Scraper:</strong> ricerca lead su Google Maps e Google Search con arricchimento AI (sito, email, telefono, team).</li>
<li><strong>Sales Agent Config:</strong> configurazione dello script di vendita e del comportamento dell'agente AI durante le chiamate.</li>
<li><strong>CRM Lead:</strong> gestione completa dei lead trovati con stati, note e storico interazioni.</li>
<li><strong>Hunter (4 modalità):</strong> Ricerca autonoma, contatto strutturato, outreach multicanale, ricerca persone.</li>
<li><strong>Auto-Call:</strong> sistema di chiamate automatiche ai lead con coda intelligente e retry.</li>
<li><strong>Outreach Pipeline:</strong> pipeline completa dal lead trovato al contatto effettuato con tracking di ogni step.</li>
<li><strong>Anti-duplicazione a 4 livelli</strong> (place_id, nome azienda, telefono, dominio).</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> API Key AI, Lead Scraper configurato; per Auto-Call: VoIP/Telnyx configurato.</p>
</div>`,
    },
    {
      id: "pkg_email_journey",
      title: "36.4 EMAIL JOURNEY & NURTURING – Comunicazione Continuativa",
      description: "Email Hub con Millie, sequenze automatiche, nurturing 365 e email post-consulenza.",
      defaultEnabled: true,
      required: false,
      order: 3,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Gestisci tutta la comunicazione email in modo intelligente: dall'Email Journey automatico che accompagna i clienti nel percorso, alle email post-consulenza, fino al nurturing continuativo dei lead. Millie gestisce le risposte automaticamente.</p>
<p><strong>Per chi è pensato.</strong> Professionisti che vogliono mantenere un contatto costante con clienti e lead senza scrivere ogni email manualmente.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Email Hub (Millie):</strong> centro di gestione email con risposte AI automatiche, inbox unificata multi-account, sistema ticket.</li>
<li><strong>Email Journey:</strong> sequenze email automatiche personalizzate per ogni fase del percorso cliente.</li>
<li><strong>Email Nurturing 365:</strong> generazione e invio di 365 email personalizzate nell'arco di un anno per scaldare i lead.</li>
<li><strong>Email post-consulenza:</strong> follow-up automatici dopo ogni consulenza con riepilogo e azioni.</li>
<li><strong>Profilo Commerciale:</strong> configurazione del tono di voce, firma e stile comunicativo per tutte le email AI.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> SMTP configurato, API Key AI. Per Email Hub completo: account IMAP configurato.</p>
</div>`,
    },
    {
      id: "pkg_lavoro_quotidiano",
      title: "36.5 LAVORO QUOTIDIANO & CONSULENZE – Operatività",
      description: "Dashboard, gestione clienti, calendario, consulenze AI-assisted, Echo riepiloghi.",
      defaultEnabled: true,
      required: false,
      order: 4,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Gli strumenti per la gestione operativa quotidiana: dashboard con KPI, gestione clienti, calendario appuntamenti, consulenze AI-assisted e analisi dati. Tutto ciò che serve per lavorare ogni giorno in modo efficiente.</p>
<p><strong>Per chi è pensato.</strong> Tutti i consulenti e professionisti — è il pacchetto base operativo.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Dashboard:</strong> panoramica KPI, attività recenti, accesso rapido a tutte le funzioni.</li>
<li><strong>Gestione Clienti:</strong> profili clienti completi con progressi, storico, note e analisi AI.</li>
<li><strong>Consulenze AI:</strong> consulenze video con preparazione AI, brief automatici e trascrizioni.</li>
<li><strong>Echo Riepiloghi:</strong> dashboard con insights automatici generati da Echo su clienti e attività.</li>
<li><strong>Calendario / Booking:</strong> gestione appuntamenti, disponibilità, prenotazione automatica.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> Account attivo con almeno un cliente; API Key AI per le funzionalità AI.</p>
</div>`,
    },
    {
      id: "pkg_formazione",
      title: "36.6 FORMAZIONE & CORSI – Academy",
      description: "Corsi manuali, AI Course Builder da YouTube, esercizi/template, Università per i clienti.",
      defaultEnabled: true,
      required: false,
      order: 5,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Crea un'accademia professionale per i clienti del Cliente. Dai corsi manuali ai corsi generati automaticamente dall'AI partendo da video YouTube, con esercizi, template e percorsi strutturati. I clienti imparano al loro ritmo con supporto AI 24/7.</p>
<p><strong>Per chi è pensato.</strong> Formatori, coach, consulenti che offrono percorsi formativi strutturati ai propri clienti.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Corsi manuali:</strong> creazione corsi con moduli, lezioni, contenuti multimediali.</li>
<li><strong>AI Course Builder:</strong> generazione automatica di corsi completi partendo da URL di video YouTube.</li>
<li><strong>Esercizi e Template:</strong> creazione e gestione di esercizi pratici con template riutilizzabili e sistema di consegna/revisione.</li>
<li><strong>Università:</strong> portale formativo completo per i clienti con progressi tracciati e certificati.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> Almeno un cliente attivo; API Key AI per AI Course Builder.</p>
</div>`,
    },
    {
      id: "pkg_content_studio",
      title: "36.7 CONTENT STUDIO – Marketing & Contenuti",
      description: "Idee AI, calendario editoriale, brand assets, AdVisage AI (Sofia) per concept pubblicitari.",
      defaultEnabled: true,
      required: false,
      order: 6,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> La suite creativa completa per generare contenuti marketing. Dalla generazione di idee AI al calendario editoriale, dalla gestione brand assets alla creazione di concept pubblicitari con AdVisage AI (Sofia).</p>
<p><strong>Per chi è pensato.</strong> Consulenti e agenzie che producono contenuti marketing, gestiscono social media o creano campagne pubblicitarie.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Dashboard Content:</strong> centro di controllo per tutti i contenuti creati e programmati.</li>
<li><strong>Idee AI:</strong> generatore di idee per contenuti basato su AI, settore e trend.</li>
<li><strong>Calendario editoriale:</strong> programmazione e organizzazione della pubblicazione.</li>
<li><strong>Brand Assets:</strong> gestione centralizzata di loghi, colori, font e linee guida del brand.</li>
<li><strong>AdVisage AI (Sofia):</strong> Creative Factory per concept pubblicitari multi-piattaforma con mood e stili diversi.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> API Key AI configurata; per AdVisage AI: piano avanzato attivo.</p>
</div>`,
    },
    {
      id: "pkg_voce_ai",
      title: "36.8 VOCE AI – Centralino & Chiamate",
      description: "Alessia AI inbound/outbound, centralino intelligente, coda d'attesa, template vocali, Brand Voice.",
      defaultEnabled: true,
      required: false,
      order: 7,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Il sistema vocale AI completo. Alessia risponde al telefono come receptionist virtuale, gestisce la coda d'attesa, qualifica le chiamate in ingresso ed effettua chiamate in uscita. Configurabile con template vocali e Brand Voice per parlare con il tono del Cliente.</p>
<p><strong>Per chi è pensato.</strong> Professionisti e studi che ricevono chiamate e vogliono un centralino AI intelligente, o che fanno cold calling automatizzato.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Alessia Voice:</strong> assistente vocale AI per chiamate in ingresso e uscita con conversazione naturale.</li>
<li><strong>Centralino AI:</strong> routing intelligente delle chiamate con riconoscimento intento e trasferimento.</li>
<li><strong>Coda d'Attesa:</strong> sistema di overflow per gestire più chiamate simultanee con musica d'attesa e callback.</li>
<li><strong>Template Vocali:</strong> script e template per le conversazioni vocali AI personalizzabili per scenario.</li>
<li><strong>VoIP Provisioning:</strong> configurazione e gestione dei numeri telefonici VoIP (Telnyx).</li>
<li><strong>Brand Voice:</strong> configurazione di tono, personalità e stile comunicativo dell'AI vocale.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> VoIP/Telnyx configurato, API Key AI, configurazione Brand Voice.</p>
</div>`,
    },
    {
      id: "pkg_pagamenti_stripe",
      title: "36.9 PAGAMENTI & STRIPE – Monetizzazione",
      description: "Stripe Connect, payment automations, revenue sharing, gestione piani/tier.",
      defaultEnabled: true,
      required: false,
      order: 8,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Gestisci i pagamenti dei clienti direttamente dalla Piattaforma tramite Stripe Connect. Crea piani di abbonamento, genera link di pagamento, attiva automaticamente gli account clienti dopo il pagamento e gestisci il revenue sharing.</p>
<p><strong>Per chi è pensato.</strong> Consulenti che vendono servizi ricorrenti, abbonamenti o percorsi formativi a pagamento.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Stripe Connect:</strong> connessione account Stripe Express per ricevere pagamenti.</li>
<li><strong>Payment Automations:</strong> automazioni post-pagamento (attivazione account, welcome journey, assegnazione livello).</li>
<li><strong>Revenue Sharing:</strong> ripartizione automatica dei ricavi tra Cliente e Piattaforma, ove previsto.</li>
<li><strong>Piani / Tier:</strong> creazione e gestione di piani con prezzi e funzionalità differenziate.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> Account Stripe; Stripe Connect configurato nella Piattaforma.</p>
</div>`,
    },
    {
      id: "pkg_team_umani",
      title: "36.10 TEAM & DIPENDENTI UMANI – Gestione Team",
      description: "Reparti, licenze multi-utente, AI Assistant per dipendente, multi-profilo.",
      defaultEnabled: true,
      required: false,
      order: 9,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p><strong>Descrizione.</strong> Per chi non lavora da solo. Gestisci il tuo team con reparti, licenze multi-utente, AI Assistant dedicato per ogni dipendente e supporto multi-profilo. Ogni membro del team ha il proprio accesso con permessi configurabili.</p>
<p><strong>Per chi è pensato.</strong> Studi professionali, agenzie e team con più di una persona che utilizza la Piattaforma.</p>
<p><strong>Moduli inclusi:</strong></p>
<ul>
<li><strong>Reparti:</strong> organizzazione del team in reparti con responsabili e permessi specifici.</li>
<li><strong>Licenze:</strong> gestione delle licenze utente con attivazione/disattivazione e monitoraggio utilizzo.</li>
<li><strong>AI Assistant per dipendente:</strong> ogni membro del team ha il proprio AI Assistant con contesto e memoria dedicati.</li>
<li><strong>Multi-profilo:</strong> supporto per più profili sotto lo stesso account con switching rapido.</li>
</ul>
<p><strong>Prerequisiti operativi.</strong> Livello di Accesso che supporta multi-utente; almeno 2 licenze attive.</p>
</div>`,
    },
    {
      id: "pkg_faq",
      title: "36.11 FAQ – Domande Frequenti sui Pacchetti",
      description: "Domande frequenti su attivazione, ordine consigliato, integrazione e gestione dei pacchetti.",
      defaultEnabled: false,
      required: false,
      order: 10,
      content: `${CARD.replace('margin: 16px 0', 'margin: 8px 0')}
<p style="font-style: italic; color: #64748b;">Allegato facoltativo: chiarimenti operativi sui Pacchetti di Servizi descritti nel presente Contratto. Non costituisce un pacchetto attivabile.</p>
<ol>
<li><strong>Devo attivare tutti i pacchetti subito?</strong> No. È possibile iniziare con i pacchetti fondamentali (Lavoro Quotidiano e Setter AI) e aggiungere progressivamente quelli più avanzati.</li>
<li><strong>Qual è l'ordine consigliato di attivazione?</strong> 1) Lavoro Quotidiano &amp; Consulenze; 2) Setter AI; 3) Email Journey &amp; Nurturing; 4) Dipendenti AI Autonomi; 5) gli altri in base alle esigenze.</li>
<li><strong>Posso usare solo alcuni moduli di un pacchetto?</strong> Sì. I pacchetti sono raggruppamenti logici, non vincoli tecnici.</li>
<li><strong>Quanto tempo serve per configurare un pacchetto?</strong> Lavoro Quotidiano richiede poche ore; Hunter e Voce AI richiedono 1–2 settimane per configurazione completa e ottimizzazione.</li>
<li><strong>Servono competenze tecniche?</strong> No: ogni modulo ha un wizard di configurazione guidato.</li>
<li><strong>I costi dei pacchetti.</strong> Sono inclusi nel Livello di Accesso sottoscritto ({{livello_accesso}}). Restano a carico del Cliente i costi di terze parti (Twilio, Telnyx, Stripe, fornitori AI) come da Articolo 7.</li>
<li><strong>I Dipendenti AI lavorano anche di notte e nei weekend?</strong> Sì, i Dipendenti del Pacchetto 2 lavorano 24/7. Per il Pacchetto Voce AI è possibile configurare orari specifici.</li>
<li><strong>Posso disattivare un pacchetto dopo averlo configurato?</strong> Sì. È possibile disattivare singoli moduli o interi pacchetti senza perdere i dati; la riattivazione ripristina la configurazione.</li>
<li><strong>I pacchetti comunicano tra loro?</strong> Sì: Hunter trova lead → Setter AI li contatta → Email Journey li nutre → Voce AI li chiama.</li>
<li><strong>Differenza tra Setter AI e Hunter.</strong> Setter AI gestisce lead inbound (risposte WhatsApp, booking automatico). Hunter cerca attivamente nuovi lead outbound (scraping, cold outreach, auto-call).</li>
<li><strong>Posso usare la Piattaforma senza WhatsApp?</strong> Sì. WhatsApp è fondamentale per Setter AI ma è possibile lavorare solo con email (Pacchetto 4) e telefono (Pacchetto 8).</li>
<li><strong>Brand Voice.</strong> È una configurazione centralizzata che si applica a email, WhatsApp, chiamate vocali e contenuti.</li>
<li><strong>Posso personalizzare i Dipendenti AI?</strong> Sì: oltre a quelli pre-configurati è possibile crearne con ruolo, istruzioni e obiettivi custom.</li>
<li><strong>Cosa succede se un cliente paga tramite Stripe e poi annulla?</strong> Il sistema gestisce automaticamente i webhook Stripe: il cliente viene notificato e il livello aggiornato.</li>
<li><strong>Posso esportare i dati di lead e clienti?</strong> Sì, in CSV. Conversazioni WhatsApp ed email sono archiviate e consultabili.</li>
</ol>
</div>`,
    },
  ];
}

export const ORBITAL_TEMPLATE_NAME = "Sistema Orbitale — Modulare";
export const ORBITAL_TEMPLATE_DESCRIPTION =
  "Contratto di Licenza d'Uso Sistema Orbitale con 11 Pacchetti di Servizi modulari (Setter AI, Dipendenti AI, Hunter, Email Journey, Lavoro Quotidiano, Formazione, Content Studio, Voce AI, Pagamenti, Team, FAQ). Selezionare i pacchetti per ciascun contratto.";
