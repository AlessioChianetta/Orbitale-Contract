import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, ChevronRight, Printer, ArrowUp } from "lucide-react";

const CONTRACT_SECTIONS = [
  { id: "premesse", title: "Premesse", level: 0 },
  { id: "parti", title: "Parti Contraenti", level: 0 },
  { id: "livello1", title: "LIVELLO 1 — COMMERCIALE", level: 0, divider: true },
  { id: "art1", title: "Art. 1 — Definizioni", level: 1 },
  { id: "art2", title: "Art. 2 — Oggetto", level: 1 },
  { id: "art3", title: "Art. 3 — Servizi Inclusi", level: 1 },
  { id: "art3-1", title: "3.1 Assistenza AI WhatsApp", level: 2 },
  { id: "art3-2", title: "3.2 Venditore AI Lead", level: 2 },
  { id: "art3-3", title: "3.3 AI Personalizzata Gold/Silver", level: 2 },
  { id: "art3-4", title: "3.4 Onboarding Dipendenti", level: 2 },
  { id: "art3-5", title: "3.5 Knowledge Base e AI", level: 2 },
  { id: "art3-6", title: "3.6 AI Course Builder", level: 2 },
  { id: "art3-7", title: "3.7 Content Marketing Studio", level: 2 },
  { id: "art3-8", title: "3.8 Email e Automazioni", level: 2 },
  { id: "art3-9", title: "3.9 Calendario e Task", level: 2 },
  { id: "art3-10", title: "3.10 Dashboard e Analytics", level: 2 },
  { id: "art3-11", title: "3.11 Instagram DM", level: 2 },
  { id: "art3-12", title: "3.12 Assistenza WhatsApp AI", level: 2 },
  { id: "art4", title: "Art. 4 — Aggiornamenti", level: 1 },
  { id: "art5", title: "Art. 5 — Supporto Tecnico", level: 1 },
  { id: "art6", title: "Art. 6 — Corrispettivi", level: 1 },
  { id: "art7", title: "Art. 7 — Revenue Share", level: 1 },
  { id: "art8", title: "Art. 8 — Durata e Rinnovo", level: 1 },
  { id: "art9", title: "Art. 9 — Recesso", level: 1 },
  { id: "livello2", title: "LIVELLO 2 — PROTEZIONE", level: 0, divider: true },
  { id: "art10", title: "Art. 10 — Proprietà Intellettuale", level: 1 },
  { id: "art11", title: "Art. 11 — Dati", level: 1 },
  { id: "art12", title: "Art. 12 — Manleva e Responsabilità", level: 1 },
  { id: "art13", title: "Art. 13 — Non Concorrenza", level: 1 },
  { id: "art14", title: "Art. 14 — Sospensione", level: 1 },
  { id: "art15", title: "Art. 15 — Cessione", level: 1 },
  { id: "art16", title: "Art. 16 — Branding", level: 1 },
  { id: "art17", title: "Art. 17 — Riservatezza", level: 1 },
  { id: "art18", title: "Art. 18 — Clausola Risolutiva", level: 1 },
  { id: "art19", title: "Art. 19 — Forza Maggiore", level: 1 },
  { id: "art20", title: "Art. 20 — Non Esclusività", level: 1 },
  { id: "art21", title: "Art. 21 — Comunicazioni", level: 1 },
  { id: "art22", title: "Art. 22 — Foro Competente", level: 1 },
  { id: "art23", title: "Art. 23 — Disposizioni Finali", level: 1 },
  { id: "approvazione", title: "Approvazione ex Art. 1341-1342 c.c.", level: 0 },
];

export default function ContractView() {
  const [activeSection, setActiveSection] = useState("premesse");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        setShowScrollTop(contentRef.current.scrollTop > 600);
        const sections = contentRef.current.querySelectorAll("[data-section]");
        let currentId = "premesse";
        sections.forEach((section) => {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 200) {
            currentId = section.getAttribute("data-section") || currentId;
          }
        });
        setActiveSection(currentId);
      }
    };
    const el = contentRef.current;
    if (el) el.addEventListener("scroll", handleScroll);
    return () => { if (el) el.removeEventListener("scroll", handleScroll); };
  }, []);

  const scrollToSection = (id: string) => {
    const el = contentRef.current?.querySelector(`[data-section="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent leading-tight">
                Contratto di Partnership
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Licenza d'Uso Piattaforma AI — Bozza
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-2 text-slate-600 border-slate-200 hover:bg-slate-50"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4" />
              Stampa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Table of Contents */}
        <aside
          className={`${
            sidebarOpen ? "w-72 xl:w-80" : "w-0"
          } transition-all duration-300 border-r border-slate-200/60 bg-white/60 backdrop-blur-sm flex-shrink-0 overflow-hidden print:hidden`}
        >
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <div className="p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">
                Indice
              </h2>
              <nav className="space-y-0.5">
                {CONTRACT_SECTIONS.map((section) => (
                  <div key={section.id}>
                    {section.divider && (
                      <div className="my-3 mx-2 border-t border-indigo-200/60" />
                    )}
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                        section.level === 0
                          ? "font-semibold"
                          : section.level === 1
                          ? "pl-5 font-medium"
                          : "pl-8 text-xs"
                      } ${
                        activeSection === section.id
                          ? "bg-indigo-50 text-indigo-700 shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      {section.title}
                    </button>
                  </div>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12">
            {/* Document Paper */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden print:shadow-none print:border-none print:rounded-none">
              <div className="px-6 sm:px-10 lg:px-14 py-10 sm:py-14 space-y-10 contract-content">

                {/* Title */}
                <div data-section="premesse" className="text-center space-y-6 pb-8 border-b border-slate-200">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tracking-tight">
                    CONTRATTO DI PARTNERSHIP TECNOLOGICA
                  </h1>
                  <h2 className="text-lg sm:text-xl font-semibold text-indigo-700">
                    PER LICENZA D'USO PIATTAFORMA AI
                  </h2>
                </div>

                {/* Premesse */}
                <section className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">PREMESSE</h2>
                  <p className="text-slate-700 leading-relaxed">
                    Il presente Contratto di Partnership Tecnologica (di seguito "Contratto") disciplina i termini e le condizioni per la concessione in licenza d'uso della piattaforma proprietaria di intelligenza artificiale (di seguito "Piattaforma") sviluppata e di proprietà esclusiva del Fornitore.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    La Piattaforma costituisce un sistema integrato di gestione aziendale basato su intelligenza artificiale, progettato per la gestione clienti, l'automazione delle comunicazioni, la formazione strutturata e la vendita assistita tramite agenti AI.
                  </p>
                  <p className="text-slate-700 leading-relaxed">Il presente Contratto è strutturato su due livelli complementari:</p>
                  <ul className="space-y-2 ml-4">
                    <li className="flex gap-2 text-slate-700">
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                      <span><strong>LIVELLO 1 — COMMERCIALE</strong>: disciplina l'oggetto, i servizi inclusi, il modello economico, la durata e le condizioni operative della partnership;</span>
                    </li>
                    <li className="flex gap-2 text-slate-700">
                      <span className="inline-block w-2 h-2 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                      <span><strong>LIVELLO 2 — PROTEZIONE LEGALE</strong>: disciplina la proprietà intellettuale, la responsabilità, le clausole restrittive, la risoluzione e il foro competente.</span>
                    </li>
                  </ul>
                </section>

                {/* Parti Contraenti */}
                <section data-section="parti" className="space-y-6">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">PARTI CONTRAENTI</h2>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100">
                      <h3 className="font-bold text-indigo-800 mb-3">IL FORNITORE</h3>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>Nome / Ragione Sociale: <span className="text-slate-400">______________________________</span></p>
                        <p>CF / P.IVA: <span className="text-slate-400">______________________________</span></p>
                        <p>Sede Legale: <span className="text-slate-400">______________________________</span></p>
                        <p>PEC: <span className="text-slate-400">______________________________</span></p>
                      </div>
                    </div>
                    <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100">
                      <h3 className="font-bold text-violet-800 mb-3">IL PARTNER</h3>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>Nome / Ragione Sociale: <span className="text-slate-400">______________________________</span></p>
                        <p>CF / P.IVA: <span className="text-slate-400">______________________________</span></p>
                        <p>Sede Legale: <span className="text-slate-400">______________________________</span></p>
                        <p>PEC: <span className="text-slate-400">______________________________</span></p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* LIVELLO 1 */}
                <div data-section="livello1" className="py-6">
                  <div className="text-center py-6 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-200">
                    <h2 className="text-2xl font-bold tracking-wide">LIVELLO 1</h2>
                    <p className="text-indigo-100 mt-1 font-medium">PARTE COMMERCIALE</p>
                  </div>
                </div>

                {/* Art 1 - Definizioni */}
                <section data-section="art1" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 1 — DEFINIZIONI</h2>
                  <p className="text-slate-600 text-sm italic">Ai fini del presente Contratto, i seguenti termini assumono il significato di seguito indicato:</p>
                  <div className="space-y-3">
                    {[
                      { term: "Piattaforma", def: "il sistema software proprietario di intelligenza artificiale, comprensivo di tutti i moduli, le funzionalità, le interfacce, le API, i database e i servizi accessori descritti nel presente Contratto, accessibile via web e ospitato su infrastruttura cloud gestita dal Fornitore." },
                      { term: "Licenza d'Uso", def: "il diritto non esclusivo, non trasferibile e revocabile concesso al Partner di utilizzare la Piattaforma nei limiti e secondo le modalità stabilite dal presente Contratto." },
                      { term: "Orbitale", def: "il nome commerciale della Piattaforma." },
                      { term: "Assistente AI", def: "l'intelligenza artificiale integrata nella Piattaforma Orbitale, personalizzabile e addestrabile sulla base dei documenti e delle istruzioni fornite dall'utilizzatore. Opera con capacità conversazionali, analitiche e generative." },
                      { term: "Licenza Diamond", def: "il pacchetto di accesso alla Piattaforma Orbitale riservato al Partner in qualità di consulente. Comprende l'accesso completo a tutti i moduli: dashboard consulente, gestione clienti, Lead Hub, agenti AI WhatsApp, Knowledge Base, Content Marketing Studio, AI Course Builder, Email Hub, calendario, analytics avanzate. È la licenza oggetto del presente Contratto." },
                      { term: "Licenza Gold", def: "il pacchetto di accesso alla Piattaforma destinato ai clienti finali del Partner (non al Partner stesso). Include: assistente AI con memoria persistente, percorsi formativi strutturati, assistente AI personale, dipendente AI virtuale, Knowledge Base personalizzata, AI Analytics, Script Manager, sistema di gamification Momentum e Streak." },
                      { term: "Licenza Silver", def: "il pacchetto di accesso alla Piattaforma destinato ai clienti finali del Partner (non al Partner stesso), con funzionalità ridotte rispetto alla Gold. Include: assistente AI senza memoria persistente tra le sessioni. Ogni conversazione inizia senza contesto delle precedenti." },
                      { term: "Agente AI WhatsApp", def: "il modulo della Piattaforma che consente la creazione di dipendenti virtuali operanti su WhatsApp Business, in grado di gestire conversazioni automatizzate, qualificare lead, prenotare appuntamenti e fornire assistenza clienti, 24 ore su 24, 7 giorni su 7." },
                      { term: "Knowledge Base", def: "l'archivio documentale digitale alimentabile dal Partner (PDF, DOCX, TXT, URL) dal quale l'intelligenza artificiale attinge per formulare risposte accurate, pertinenti e basate su fonti verificabili, senza inventare informazioni (tecnologia RAG — Retrieval Augmented Generation)." },
                      { term: "Lead", def: "un potenziale cliente del Partner che ha manifestato interesse o che viene contattato proattivamente tramite campagne automatizzate." },
                      { term: "Canone Mensile", def: "il corrispettivo fisso ricorrente dovuto dal Partner al Fornitore per l'utilizzo della Piattaforma." },
                      { term: "Revenue Share", def: "la percentuale sulle vendite di licenze Gold e Silver effettuate dal Partner a favore dei propri clienti finali, dovuta al Fornitore in via permanente e irrevocabile." },
                      { term: "Stripe Connect", def: "il sistema di gestione dei pagamenti integrato che consente il tracciamento automatico delle transazioni e la ripartizione dei ricavi tra Fornitore e Partner." },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="text-slate-400 font-mono text-xs mt-0.5">1.{i + 1}.</span>
                        <p className="text-slate-700"><strong className="text-slate-900">"{item.term}"</strong>: {item.def}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Art 2 - Oggetto */}
                <section data-section="art2" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 2 — OGGETTO DEL CONTRATTO</h2>
                  {[
                    "Il Fornitore concede al Partner una Licenza Diamond della Piattaforma Orbitale, non esclusiva, non trasferibile e non sublicenziabile, per la durata e alle condizioni stabilite dal presente Contratto.",
                    "La Licenza Diamond comprende l'accesso a tutti i moduli e le funzionalità della Piattaforma come dettagliati nell'Articolo 3, in qualità di consulente, inclusi gli aggiornamenti e le evoluzioni rilasciate dal Fornitore durante il periodo di validità del Contratto.",
                    "Il Partner acquisisce il diritto di utilizzare la Piattaforma Orbitale per la propria attività e di rivendere licenze Gold e Silver ai propri clienti finali, nel rispetto delle condizioni economiche e operative stabilite nel presente Contratto. Le licenze Gold e Silver sono destinate esclusivamente ai clienti del Partner e non al Partner stesso.",
                    "La Piattaforma è fornita in modalità SaaS (Software as a Service), accessibile via browser web, senza necessità di installazione locale. Il Fornitore si occupa dell'hosting, della manutenzione dell'infrastruttura e degli aggiornamenti tecnici.",
                  ].map((text, i) => (
                    <p key={i} className="text-slate-700 leading-relaxed"><span className="text-slate-400 font-mono text-xs mr-2">2.{i + 1}.</span>{text}</p>
                  ))}
                </section>

                {/* Art 3 - Servizi */}
                <section data-section="art3" className="space-y-8">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 3 — DESCRIZIONE DEI SERVIZI INCLUSI</h2>
                  <p className="text-slate-600 text-sm italic">La Piattaforma include i seguenti moduli e funzionalità, qui descritti in dettaglio affinché il Partner abbia piena consapevolezza di ciò che acquisisce.</p>

                  {/* 3.1 */}
                  <div data-section="art3-1" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.1. Assistenza Clienti AI su WhatsApp — 24/7</h3>
                    <p className="text-slate-700 text-sm leading-relaxed">La Piattaforma consente al Partner di attivare agenti AI operanti su WhatsApp Business che funzionano come veri e propri dipendenti virtuali. Questi agenti:</p>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {[
                        "rispondono automaticamente ai messaggi in arrivo dai clienti, a qualsiasi ora del giorno e della notte, senza pause e senza ritardi;",
                        "attingono alla Knowledge Base del Partner per fornire risposte accurate e basate sui documenti caricati (FAQ, listini prezzi, procedure, guide);",
                        "gestiscono le obiezioni più comuni seguendo script personalizzabili con variazioni naturali nel linguaggio;",
                        "eseguono l'escalation automatica a un operatore umano quando il cliente lo richiede esplicitamente, quando l'agente non riesce a rispondere dopo due tentativi, o quando rileva frustrazione nel tono della conversazione;",
                        "inviano check-in settimanali automatici ai clienti, ruotando tra cinque template predefiniti e personalizzando i messaggi con il nome del cliente, l'ultimo esercizio completato e i progressi formativi;",
                        "operano con un ritardo configurabile tra le risposte (da 3 a 8 secondi) per simulare un comportamento naturale e non robotico;",
                        "rispettano fasce orarie configurabili e giorni di attività definiti dal Partner;",
                        "inviano notifiche in tempo reale al Partner quando un cliente prenota un appuntamento o quando si verifica un'escalation.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400 mt-0.5">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.2 */}
                  <div data-section="art3-2" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.2. Venditore AI che Qualifica i Lead su WhatsApp</h3>
                    <p className="text-slate-700 text-sm leading-relaxed">La Piattaforma mette a disposizione del Partner un sistema completo di acquisizione clienti automatizzato:</p>

                    <div className="space-y-4 mt-3">
                      <div>
                        <h4 className="font-semibold text-slate-700 text-sm mb-2">a) Lead Hub — Centro di Controllo Acquisizione</h4>
                        <ul className="space-y-1.5 text-sm text-slate-700 ml-4">
                          {[
                            "importazione massiva di lead da file Excel e CSV con mappatura automatica delle colonne;",
                            "creazione manuale di singoli lead con tag personalizzabili per fonte, priorità, interesse;",
                            "gestione duplicati intelligente con opzioni di salto, aggiornamento o creazione forzata;",
                            "organizzazione dei lead con tag illimitati;",
                            "visualizzazione dello stato di ogni lead: in attesa, contattato, ha risposto, qualificato, appuntamento fissato, convertito in cliente, perso;",
                            "filtri avanzati per tag, stato, punteggio e campagna di appartenenza.",
                          ].map((text, i) => (
                            <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-700 text-sm mb-2">b) Lead Scoring Automatico</h4>
                        <ul className="space-y-1.5 text-sm text-slate-700 ml-4">
                          {[
                            "punteggio automatico basato sulle interazioni: +10 per risposta, +20 per prenotazione appuntamento, +15 per richiesta informazioni, +5 per clic su link;",
                            "penalizzazioni: -2 per ogni giorno senza risposta, -50 per richiesta di non essere contattato, -10 per messaggio non consegnato;",
                            "classificazione: lead caldo (>70 punti), tiepido (40-70), freddo (<40).",
                          ].map((text, i) => (
                            <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-700 text-sm mb-2">c) Campagne WhatsApp Automatizzate</h4>
                        <ul className="space-y-1.5 text-sm text-slate-700 ml-4">
                          {[
                            "creazione di campagne con nome, descrizione, \"uncino\" e offerta;",
                            "selezione dei lead per tag, stato o manualmente;",
                            "collegamento a template WhatsApp approvati da Meta;",
                            "modalità \"Dry Run\" per testare la campagna senza inviare messaggi reali;",
                            "statistiche in tempo reale: messaggi inviati, consegnati, letti, risposte, appuntamenti, conversioni.",
                          ].map((text, i) => (
                            <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-700 text-sm mb-2">d) Agente AI "Setter" — Il Venditore Virtuale</h4>
                        <ul className="space-y-1.5 text-sm text-slate-700 ml-4">
                          {[
                            "contatta proattivamente i lead e gestisce le risposte in arrivo;",
                            "segue uno script di vendita personalizzabile con fasi strutturate: apertura, qualifica, obiezioni, proposta, chiusura;",
                            "qualifica automaticamente i lead attraverso domande strategiche;",
                            "propone fasce orarie per appuntamenti basate sulla disponibilità del calendario;",
                            "prenota automaticamente e invia conferma al lead e notifica al Partner;",
                            "passa al Partner soltanto i lead qualificati e con appuntamento fissato.",
                          ].map((text, i) => (
                            <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 3.3 */}
                  <div data-section="art3-3" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.3. Intelligenza Artificiale Personalizzata — Strutturata a Livelli</h3>

                    <div className="space-y-4 mt-3">
                      <div className="p-4 rounded-lg bg-white/60 border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-2">Licenza Gold — Il Pacchetto Completo</h4>
                        <ul className="space-y-1.5 text-sm text-slate-700">
                          {[
                            "Consulente AI addestrato con memoria: l'AI ricorda ogni conversazione precedente con il cliente, riprende il discorso dove era stato lasciato, conosce progressi, obiettivi e preferenze;",
                            "Percorsi formativi strutturati: corsi organizzati in moduli e lezioni (testo, video, quiz, file scaricabili), con tracciamento dei progressi e percentuale di completamento;",
                            "Sistema esercizi con feedback: template riutilizzabili, consegna da parte del cliente, revisione con feedback e valutazione;",
                            "Assistente AI personale: disponibile 24/7 per domande sui corsi, aiuto con esercizi, analisi progressi, consigli personalizzati;",
                            "Dipendente AI addestrato: agente AI su WhatsApp, addestrato sulla documentazione specifica del cliente;",
                            "Knowledge Base personalizzata: il cliente può caricare documenti per risposte ancora più accurate;",
                            "AI Analytics: monitoraggio utilizzo con token consumati, richieste, costo stimato, tempo medio di risposta;",
                            "Script Manager: gestione script di vendita con fasi personalizzabili;",
                            "Momentum e Streak: gamification con giorni consecutivi di attività e record personali.",
                          ].map((text, i) => (
                            <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-lg bg-white/60 border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-2">Licenza Silver — Il Pacchetto Base</h4>
                        <ul className="space-y-1.5 text-sm text-slate-700">
                          <li className="flex gap-2"><span className="text-slate-400">•</span><span>Assistente AI addestrato senza memoria: AI addestrata sulla documentazione aziendale, risponde accuratamente ma ogni sessione inizia senza contesto delle precedenti;</span></li>
                          <li className="flex gap-2"><span className="text-slate-400">•</span><span>Accesso alle funzionalità base della Piattaforma con limitazioni rispetto alla Licenza Gold.</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 3.4 */}
                  <div data-section="art3-4" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.4. Onboarding Venditori e Dipendenti</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {[
                        "creazione di account per venditori e dipendenti con invio automatico delle credenziali di accesso via email;",
                        "assegnazione di corsi formativi e percorsi di onboarding strutturati;",
                        "ogni dipendente dispone della propria dashboard con progressi, esercizi, calendario e accesso all'AI;",
                        "monitoraggio dei progressi formativi, revisione esercizi e feedback;",
                        "supporto doppio ruolo: un utente può essere contemporaneamente consulente e cliente nella stessa piattaforma;",
                        "le prime 5 licenze dipendente sono incluse gratuitamente nel pacchetto del Partner.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.5 */}
                  <div data-section="art3-5" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.5. Knowledge Base e AI — Il Cervello Documentale</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {[
                        "caricamento di documenti in formato PDF, DOCX, TXT e URL di pagine web;",
                        "organizzazione per categorie (Servizi e Prezzi, Materiale Formativo, Procedure Interne, FAQ Clienti);",
                        "configurazione granulare dell'accesso: ogni documento può essere reso disponibile all'AI del consulente, dei clienti, degli Agenti WhatsApp, o combinazioni;",
                        "tecnologia RAG (Retrieval Augmented Generation): l'AI cerca nei documenti, estrae informazioni rilevanti, formula risposte con fonti verificabili;",
                        "l'AI non inventa mai informazioni: se non trova la risposta nei documenti, lo comunica chiaramente.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.6 */}
                  <div data-section="art3-6" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.6. AI Course Builder — Generazione Automatica di Corsi</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {[
                        "generazione di corsi strutturati a partire da un URL di un video YouTube;",
                        "estrazione automatica della trascrizione, analisi dei contenuti, generazione di moduli e lezioni, creazione di quiz;",
                        "un video di 1 ora può generare un corso completo (5 moduli, 15 lezioni, 5 quiz) in circa 10 minuti;",
                        "revisione e modifica del corso generato prima della pubblicazione.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.7 */}
                  <div data-section="art3-7" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.7. Content Marketing Studio</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {[
                        "generatore di idee per contenuti basato sull'AI, personalizzato per settore e target del Partner;",
                        "creazione automatica di copy per social media (LinkedIn, Instagram, Facebook) con controllo su tono, lunghezza, emoji, hashtag e call-to-action;",
                        "generazione di immagini AI tramite Google Gemini Imagen 3, con scelta del formato e dello stile;",
                        "Campaign Builder guidato in 6 step: obiettivo, target, canali, contenuti, calendario, review e lancio;",
                        "organizzazione dei contenuti in cartelle e calendario editoriale visuale;",
                        "libreria brand assets per logo, palette colori, bio e descrizioni.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.8 */}
                  <div data-section="art3-8" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.8. Email e Automazioni</h3>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {[
                        { label: "Email Journey", text: "sequenze di email automatiche programmate nel tempo (benvenuto, come iniziare, primo corso, check-in, feedback);" },
                        { label: "Email Nurturing 365", text: "sistema automatico che genera e invia 365 email personalizzate nell'arco di un anno per scaldare i lead, una al giorno;" },
                        { label: "Email Hub", text: "inbox unificata multi-account con sincronizzazione IMAP, risposte AI automatiche, sistema ticket, rilevamento email urgenti;" },
                        { label: "Email post-consulenza", text: "riepilogo automatico con punti chiave discussi, decisioni prese, prossimi step e data prossimo appuntamento;" },
                        { label: "Automazioni", text: "regole trigger-condizione-azione personalizzabili (es: se lead non risponde da 3 giorni, invia follow-up WhatsApp)." },
                      ].map((item, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span><strong>{item.label}:</strong> {item.text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.9 */}
                  <div data-section="art3-9" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.9. Calendario, Consulenze e Task</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {[
                        "calendario integrato con gestione appuntamenti e consulenze;",
                        "videochiamate integrate con link generato automaticamente 15 minuti prima dell'appuntamento;",
                        "preparazione consulenza assistita dall'AI con riepilogo della situazione del cliente;",
                        "sistema task con scadenze, priorità e gestione quotidiana;",
                        "completamento consulenza con note, email di riepilogo automatica, nuovi esercizi e programmazione prossimo appuntamento.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.10 */}
                  <div data-section="art3-10" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.10. Dashboard e Analytics</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {[
                        "dashboard consulente con 4 KPI principali: clienti attivi, esercizi da revisionare, consulenze della settimana, lead prioritari;",
                        "sezione \"Items in Attesa\" con consulenze da completare, bozze email, task scaduti, lead non contattati;",
                        "dashboard WhatsApp con statistiche in tempo reale: messaggi oggi, conversazioni attive, tasso risposta, lead convertiti;",
                        "profilo cliente completo con 6 tab: panoramica, percorso formativo, consulenze, documenti, comunicazioni, analytics;",
                        "dashboard cliente con progressi formativi, esercizi, calendario e accesso all'AI Assistant.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.11 */}
                  <div data-section="art3-11" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.11. Integrazione Instagram DM</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {[
                        "collegamento dell'account Instagram Business tramite API Meta;",
                        "risposta automatica ai DM con la stessa AI degli agenti WhatsApp;",
                        "gestione story replies e conversione follower in lead;",
                        "rispetto della finestra 24 ore imposta da Instagram per le risposte.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* 3.12 */}
                  <div data-section="art3-12" className="space-y-3 p-5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <h3 className="text-lg font-bold text-slate-800">3.12. Assistenza WhatsApp AI — 24/7</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Il Partner riceve accesso a un canale di assistenza gestito da un'intelligenza artificiale addestrata sulla documentazione della Piattaforma, disponibile 24 ore su 24 tramite WhatsApp. L'assistenza AI è in grado di rispondere a domande sull'utilizzo della Piattaforma, guidare il Partner nelle configurazioni e risolvere dubbi operativi.
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Per problematiche tecniche complesse (bug, malfunzionamenti, errori di sistema), il Partner può aprire un ticket via email come disciplinato dall'Articolo 5.
                    </p>
                  </div>
                </section>

                {/* Art 4 */}
                <section data-section="art4" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 4 — AGGIORNAMENTI E MANUTENZIONE</h2>
                  <div className="space-y-3">
                    <p className="text-slate-700 leading-relaxed"><strong>4.1. Aggiornamenti Base.</strong> Il Fornitore rilascia periodicamente aggiornamenti della Piattaforma che includono: correzioni di bug, miglioramenti delle prestazioni, aggiornamenti di sicurezza ed evoluzioni delle funzionalità esistenti. Tali aggiornamenti sono sempre inclusi nel Canone Mensile senza costi aggiuntivi.</p>
                    <p className="text-slate-700 leading-relaxed"><strong>4.2. Aggiornamenti Custom.</strong> Il Partner ha diritto a una (1) richiesta di personalizzazione al mese, da intendersi come una modifica specifica, un adattamento funzionale o una configurazione dedicata richiesta dal Partner. Le richieste custom:</p>
                    <ul className="ml-6 space-y-1 text-sm text-slate-700">
                      <li className="flex gap-2"><span className="text-slate-400">•</span><span>non sono cumulabili: se il Partner non utilizza la richiesta in un determinato mese, non può sommarla a quella del mese successivo;</span></li>
                      <li className="flex gap-2"><span className="text-slate-400">•</span><span>devono essere inviate via email o tramite il canale di assistenza dedicato;</span></li>
                      <li className="flex gap-2"><span className="text-slate-400">•</span><span>saranno valutate dal Fornitore in termini di fattibilità e tempistiche;</span></li>
                      <li className="flex gap-2"><span className="text-slate-400">•</span><span>il Fornitore si riserva il diritto di rifiutare richieste che comportino modifiche strutturali all'architettura della Piattaforma.</span></li>
                    </ul>
                    <p className="text-slate-700 leading-relaxed"><strong>4.3. Manutenzione Programmata.</strong> Il Fornitore può eseguire interventi di manutenzione programmata che comportino temporanea indisponibilità della Piattaforma, previo avviso al Partner con almeno 24 ore di anticipo.</p>
                  </div>
                </section>

                {/* Art 5 */}
                <section data-section="art5" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 5 — SUPPORTO TECNICO</h2>
                  <p className="text-slate-700 leading-relaxed"><strong>5.1. Livello 1 — Supporto Operativo.</strong> Il supporto di primo livello è a carico del Partner, che potrà avvalersi della documentazione fornita, dell'assistenza WhatsApp AI 24/7 e dei materiali formativi inclusi.</p>
                  <p className="text-slate-700 leading-relaxed"><strong>5.2. Livello 2 — Supporto Tecnico.</strong> Per problematiche tecniche (bug, malfunzionamenti, errori), il Partner può aprire un ticket via email. Il Fornitore si impegna a fornire una prima risposta entro quarantotto (48) ore lavorative.</p>
                  <p className="text-slate-700 leading-relaxed"><strong>5.3. Esclusioni.</strong> Il supporto non copre: problemi da uso improprio, interruzioni di servizi terzi (WhatsApp, Meta, Google, Twilio), personalizzazioni extra, formazione individuale oltre ai materiali forniti.</p>
                </section>

                {/* Art 6 */}
                <section data-section="art6" className="space-y-6">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 6 — MODELLO ECONOMICO — CORRISPETTIVI</h2>

                  <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-4">
                    <h3 className="font-bold text-slate-800">6.1. Costo di Attivazione (Setup)</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">All'atto della sottoscrizione, il Partner corrisponde un costo di attivazione una tantum fino a un massimo di <strong>Euro 2.000,00</strong>, comprensivo di: configurazione iniziale della Piattaforma, creazione dell'ambiente dedicato, setup degli agenti AI WhatsApp, caricamento iniziale della Knowledge Base, formazione iniziale.</p>
                    <p className="text-sm text-slate-700 leading-relaxed">Il costo di attivazione può essere ridotto o azzerato a insindacabile discrezione del Fornitore.</p>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-4">
                    <h3 className="font-bold text-slate-800">6.2. Canone Mensile Fisso</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">Il Partner corrisponde un canone mensile fisso, dovuto anticipatamente entro il giorno 5 di ogni mese solare, a partire dal mese successivo alla data di attivazione.</p>
                    <p className="text-sm text-slate-700">Il Canone include: accesso completo a tutti i moduli, aggiornamenti base, 1 richiesta custom/mese, 5 licenze dipendente gratuite, assistenza WhatsApp AI 24/7, supporto tecnico via ticket.</p>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-3">
                    <h3 className="font-bold text-slate-800">6.3. Licenze Dipendenti Aggiuntive</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">Le prime <strong>5 licenze</strong> per dipendenti sono incluse gratuitamente. A partire dalla sesta, il costo è di <strong>Euro 20,00/mese per pacchetto di 5 licenze</strong>. Non è possibile acquistare licenze singole.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-slate-700 leading-relaxed"><strong>6.4. Costi di Servizi Terzi.</strong> Restano a carico del Partner: messaggistica WhatsApp (Twilio, ~€0,05/msg), API AI (Google Vertex AI / Gemini), invio email (SMTP), configurazione WhatsApp Business (Meta). Il Fornitore non è responsabile per variazioni di prezzo dei fornitori terzi.</p>
                    <p className="text-slate-700 leading-relaxed"><strong>6.5. Modalità di Pagamento.</strong> Pagamenti preferibilmente tramite Stripe Connect per tracciamento automatico e ripartizione ricavi. In alternativa, bonifico bancario.</p>
                  </div>
                </section>

                {/* Art 7 */}
                <section data-section="art7" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 7 — REVENUE SHARE</h2>
                  <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-4">
                    <p className="text-slate-700 leading-relaxed"><strong>7.1.</strong> Il Partner che rivende licenze Gold o Silver è tenuto a corrispondere al Fornitore il <strong>50% del ricavo netto</strong> generato da ciascuna licenza rivenduta.</p>
                    <p className="text-slate-700 leading-relaxed"><strong>7.2.</strong> Si applica a: canoni mensili delle licenze rivendute, costi di attivazione applicati ai clienti finali, servizi aggiuntivi collegati alla Piattaforma. Non si applica a: consulenze professionali, formazione e attività commerciali non connesse alla Piattaforma.</p>
                    <div className="p-3 rounded-lg bg-white/80 border border-slate-200">
                      <p className="text-sm text-slate-800 font-semibold">7.3. L'obbligo di Revenue Share è PERMANENTE e IRREVOCABILE per tutta la durata del rapporto tra Partner e cliente finale, anche oltre la cessazione del presente Contratto.</p>
                    </div>
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>7.4.</strong> Tracciamento preferibilmente tramite Stripe Connect. Il Partner si impegna a fornire documentazione attestante i ricavi su richiesta.</p>
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>7.5.</strong> La quota del Fornitore è liquidata mensilmente entro il giorno 15 del mese successivo. Con Stripe Connect, la ripartizione avviene automaticamente.</p>
                  </div>
                </section>

                {/* Art 8 */}
                <section data-section="art8" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 8 — DURATA E RINNOVO</h2>
                  <p className="text-slate-700 leading-relaxed"><strong>8.1.</strong> Durata minima di <strong>12 mesi</strong> dalla data di sottoscrizione.</p>
                  <p className="text-slate-700 leading-relaxed"><strong>8.2.</strong> Rinnovo automatico per ulteriori periodi di 12 mesi ciascuno, salvo disdetta nei termini dell'Articolo 9.</p>
                  <p className="text-slate-700 leading-relaxed"><strong>8.3.</strong> Canone invariato per il periodo in corso. Adeguamenti comunicati con almeno 60 giorni di preavviso prima della scadenza, con facoltà di recesso entro 30 giorni senza penali.</p>
                </section>

                {/* Art 9 */}
                <section data-section="art9" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">ARTICOLO 9 — RECESSO</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">9.1. Recesso del Partner</h3>
                      <p className="text-slate-700 leading-relaxed text-sm">Preavviso minimo di 30 giorni via PEC o raccomandata A/R. Il recesso ha effetto alla scadenza del periodo in corso (12 mesi). Il Partner resta obbligato al pagamento dei canoni residui fino alla naturale scadenza.</p>
                      <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 italic">
                        Esempio: Contratto dal 1° gennaio, recesso comunicato il 15 giugno → resta efficace fino al 31 dicembre, canoni dovuti da luglio a dicembre.
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">9.2. Recesso del Fornitore</h3>
                      <p className="text-slate-700 leading-relaxed text-sm">Preavviso minimo di 30 giorni via PEC o raccomandata A/R. Il Partner non è tenuto al pagamento di canoni successivi. Il Fornitore garantisce 30 giorni per l'esportazione dei dati.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">9.3. Effetti del Recesso</h3>
                      <p className="text-slate-700 leading-relaxed text-sm">Alla cessazione: accesso disattivato; perdita del diritto di utilizzo di materiale, software, prompt, architettura; dati anagrafici clienti disponibili per esportazione entro 30 giorni; obbligo di Revenue Share permanente per i clienti acquisiti durante la vigenza.</p>
                    </div>
                  </div>
                </section>

                {/* LIVELLO 2 */}
                <div data-section="livello2" className="py-6">
                  <div className="text-center py-6 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-200">
                    <h2 className="text-2xl font-bold tracking-wide">LIVELLO 2</h2>
                    <p className="text-violet-100 mt-1 font-medium">PROTEZIONE LEGALE</p>
                  </div>
                </div>

                {/* Art 10 */}
                <section data-section="art10" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 10 — PROPRIETÀ INTELLETTUALE</h2>
                  <p className="text-slate-700 leading-relaxed"><strong>10.1.</strong> La Piattaforma, in ogni componente, è di proprietà esclusiva del Fornitore: codice sorgente e compilato, architettura, design, prompt AI, istruzioni di addestramento, quiz, template, materiali formativi, nomi, marchi, loghi, documentazione tecnica, algoritmi, logiche, know-how.</p>
                  <p className="text-slate-700 leading-relaxed"><strong>10.2.</strong> Qualsiasi sviluppo custom realizzato dal Fornitore su richiesta del Partner, anche se pagato, è di proprietà esclusiva del Fornitore, che può riutilizzarlo liberamente.</p>
                  <p className="text-slate-700 leading-relaxed"><strong>10.3.</strong> Il Partner si impegna a non decompilare, disassemblare, effettuare reverse engineering, copiare, riprodurre, modificare, adattare, tradurre, creare opere derivate o tentare di risalire al codice sorgente, ai prompt, all'architettura o alla logica della Piattaforma.</p>
                </section>

                {/* Art 11 */}
                <section data-section="art11" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 11 — TITOLARITÀ E TRATTAMENTO DEI DATI</h2>
                  <p className="text-slate-700 leading-relaxed"><strong>11.1.</strong> Il Partner è titolare dei dati anagrafici e di contatto dei propri clienti. In caso di cessazione, tali dati saranno disponibili per l'esportazione.</p>
                  <p className="text-slate-700 leading-relaxed"><strong>11.2.</strong> Il Fornitore è titolare dei dati generati dall'utilizzo della Piattaforma: log conversazioni AI, dati di utilizzo e analytics, contenuti generati dall'AI, metriche, dati di addestramento.</p>
                  
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700 mb-3">11.3. Segregazione e Riservatezza dei Dati tra Clienti Finali</h3>
                    <ul className="space-y-2 text-sm text-slate-700 ml-4">
                      {[
                        "Ciascun cliente del Partner vede esclusivamente i propri dati all'interno della Piattaforma. Non ha accesso ai dati di altri clienti dello stesso Partner;",
                        "La Knowledge Base è segregata tra i diversi Partner: ciascun Partner ha una Knowledge Base indipendente e inaccessibile ai concorrenti;",
                        "Per i clienti con Licenza Gold, l'intelligenza artificiale utilizza esclusivamente i dati e i documenti specifici di quel cliente per formulare risposte personalizzate;",
                        "Il Fornitore implementa controlli di accesso granulare ai documenti della Knowledge Base: ogni documento può essere reso disponibile selettivamente all'AI del consulente, all'AI dei clienti, agli Agenti WhatsApp, o a specifiche combinazioni;",
                        "Gli Agenti AI WhatsApp del Partner operano in un contesto isolato, elaborando esclusivamente i dati dei clienti del Partner e utilizzando la Knowledge Base del Partner, senza accesso ai dati o alla Knowledge Base di altri Partner.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700 mb-3">11.4. Sicurezza dei Dati</h3>
                    <ul className="space-y-2 text-sm text-slate-700 ml-4">
                      {[
                        "Il Fornitore implementa misure tecniche e organizzative adeguate a garantire la riservatezza, l'integrità e la disponibilità dei dati, conformemente alle migliori pratiche del settore;",
                        "Backup automatici e ridondanza dell'infrastruttura per assicurare continuità operativa e recupero da malfunzionamenti;",
                        "Crittografia dei dati in transito (TLS/HTTPS) e a riposo nei database;",
                        "Monitoraggio continuo della sicurezza, audit regolari e aggiornamenti tempestivi delle misure di protezione.",
                      ].map((text, i) => (
                        <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{text}</span></li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700 mb-3">11.5. Trattamento dei Dati Personali</h3>
                    <p className="text-slate-700 text-sm">Ciascuna Parte tratta i dati personali nel rispetto del GDPR (Reg. UE 2016/679) e della normativa nazionale vigente. Le Parti si impegnano a sottoscrivere, ove necessario, un Data Processing Agreement.</p>
                  </div>
                </section>

                {/* Art 12 */}
                <section data-section="art12" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 12 — MANLEVA E LIMITAZIONE DI RESPONSABILITÀ</h2>
                  <div className="p-5 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 space-y-3">
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>12.1. Manleva Totale sull'AI.</strong> Il Partner riconosce che l'AI opera su modelli probabilistici e può generare risposte inesatte ("allucinazioni"). Il Partner manleva e tiene indenne il Fornitore da qualsiasi responsabilità, danno, costo, pretesa o azione legale derivante da: risposte errate dell'AI, decisioni prese sulla base di informazioni AI, danni di qualsiasi natura, violazioni normative da uso improprio.</p>
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>12.2.</strong> La responsabilità complessiva del Fornitore non potrà eccedere l'importo dei Canoni Mensili corrisposti nei 12 mesi precedenti.</p>
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>12.3.</strong> La Piattaforma è fornita "così com'è" e "come disponibile". Nessuna garanzia espressa o implicita circa idoneità, assenza di errori, disponibilità ininterrotta o accuratezza dell'AI.</p>
                  </div>
                </section>

                {/* Art 13 */}
                <section data-section="art13" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 13 — NON CONCORRENZA</h2>
                  <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-3">
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>13.1.</strong> Per tutta la durata del Contratto e per <strong>3 anni</strong> successivi alla cessazione, il Partner si impegna a non: sviluppare o partecipare a piattaforme concorrenti; collaborare con soggetti che sviluppano prodotti concorrenti; utilizzare il know-how acquisito per creare prodotti concorrenti; sollecitare o assumere dipendenti o collaboratori del Fornitore.</p>
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>13.2.</strong> Penale per violazione: <strong>Euro 50.000,00</strong> per ciascuna violazione accertata, fermo restando il diritto al risarcimento del maggior danno.</p>
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>13.3.</strong> Ambito territoriale: intero territorio nazionale italiano e mercati esteri in cui il Fornitore operi o abbia manifestato interesse durante la vigenza.</p>
                  </div>
                </section>

                {/* Art 14 */}
                <section data-section="art14" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 14 — SOSPENSIONE DEL SERVIZIO</h2>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>14.1.</strong> Sospensione con preavviso di <strong>24 ore</strong> nei casi di: mancato pagamento oltre 15 giorni, violazione contrattuale, uso illegale, rischio sicurezza, richiesta dell'autorità.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>14.2.</strong> Nessun indennizzo, riduzione o compensazione durante la sospensione. Il Canone Mensile resta dovuto.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>14.3.</strong> Riattivazione entro 24 ore dalla rimozione della causa.</p>
                </section>

                {/* Art 15 */}
                <section data-section="art15" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 15 — CESSIONE DEL CONTRATTO</h2>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>15.1.</strong> Il Fornitore può cedere il Contratto a terzi con 30 giorni di preavviso, senza consenso del Partner.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>15.2.</strong> Il Partner non può cedere il Contratto senza previo consenso scritto del Fornitore.</p>
                </section>

                {/* Art 16 */}
                <section data-section="art16" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 16 — BRANDING E ATTRIBUZIONE</h2>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>16.1.</strong> La Piattaforma riporta la dicitura <strong>"Powered by Alessio Chianetta"</strong> in ogni manifestazione visibile ai clienti finali. Il Partner si impegna a non rimuovere, oscurare o modificare tale attribuzione.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>16.2.</strong> Il Fornitore può utilizzare nome e logo del Partner come referenza commerciale, salvo diverso accordo scritto.</p>
                </section>

                {/* Art 17 */}
                <section data-section="art17" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 17 — RISERVATEZZA</h2>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>17.1.</strong> Ciascuna Parte mantiene riservate tutte le informazioni confidenziali ricevute dall'altra.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>17.2.</strong> L'obbligo permane per 5 anni dalla cessazione.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>17.3.</strong> Esclusioni: informazioni di dominio pubblico, già in possesso legittimo, da divulgare per obbligo di legge.</p>
                </section>

                {/* Art 18 */}
                <section data-section="art18" className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 18 — CLAUSOLA RISOLUTIVA ESPRESSA</h2>
                  <p className="text-slate-700 leading-relaxed text-sm">Ai sensi dell'art. 1456 c.c., il Fornitore può dichiarare risolto il Contratto via PEC nei seguenti casi: mancato pagamento di 2 o più canoni consecutivi; violazione non concorrenza; violazione proprietà intellettuale; cessione non autorizzata; violazione riservatezza; rimozione branding; uso illecito; fallimento o insolvenza del Partner.</p>
                  <p className="text-slate-700 leading-relaxed text-sm">In caso di risoluzione per inadempimento del Partner, il Fornitore ha diritto ai canoni residui fino alla scadenza del periodo in corso, oltre al risarcimento del maggior danno.</p>
                </section>

                {/* Art 19 */}
                <section data-section="art19" className="space-y-3">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 19 — FORZA MAGGIORE</h2>
                  <p className="text-slate-700 leading-relaxed text-sm">Nessuna Parte è responsabile per inadempimenti causati da eventi di forza maggiore: calamità naturali, guerre, atti di terrorismo, pandemie, provvedimenti dell'autorità, interruzioni prolungate di servizi essenziali terzi.</p>
                </section>

                {/* Art 20 */}
                <section data-section="art20" className="space-y-3">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 20 — NON ESCLUSIVITÀ</h2>
                  <p className="text-slate-700 leading-relaxed text-sm">Il Contratto non conferisce alcun diritto di esclusiva. Il Fornitore è libero di concedere licenze ad altri soggetti, anche nello stesso settore o area geografica del Partner.</p>
                </section>

                {/* Art 21 */}
                <section data-section="art21" className="space-y-3">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 21 — COMUNICAZIONI</h2>
                  <p className="text-slate-700 leading-relaxed text-sm">Tutte le comunicazioni in forma scritta via PEC o raccomandata A/R agli indirizzi in intestazione. Si intendono ricevute alla data di ricezione della PEC o della raccomandata.</p>
                </section>

                {/* Art 22 */}
                <section data-section="art22" className="space-y-3">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 22 — LEGGE APPLICABILE E FORO COMPETENTE</h2>
                  <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200">
                    <p className="text-slate-700 leading-relaxed text-sm"><strong>22.1.</strong> Il presente Contratto è regolato dalla legge italiana.</p>
                    <p className="text-slate-700 leading-relaxed text-sm mt-2"><strong>22.2.</strong> Per qualsiasi controversia, le Parti riconoscono la competenza esclusiva del <strong>Foro di Messina</strong>, con espressa rinuncia a qualsiasi altro foro concorrente.</p>
                  </div>
                </section>

                {/* Art 23 */}
                <section data-section="art23" className="space-y-3">
                  <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">ARTICOLO 23 — DISPOSIZIONI FINALI</h2>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>23.1. Intero Accordo.</strong> Il presente Contratto costituisce l'intero accordo tra le Parti e sostituisce qualsiasi precedente accordo, intesa o comunicazione.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>23.2. Modifiche.</strong> Qualsiasi modifica deve essere concordata per iscritto e sottoscritta da entrambe le Parti.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>23.3. Nullità Parziale.</strong> Se una clausola è dichiarata nulla, le restanti rimangono valide. Le Parti la sostituiranno con una clausola valida di effetto simile.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>23.4. Tolleranza.</strong> La mancata applicazione di una clausola non costituisce rinuncia al diritto di applicarla successivamente.</p>
                  <p className="text-slate-700 leading-relaxed text-sm"><strong>23.5. Copie.</strong> Redatto in due copie originali, una per ciascuna Parte.</p>
                </section>

                {/* Approvazione specifica */}
                <section data-section="approvazione" className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-800 text-center">APPROVAZIONE SPECIFICA</h2>
                  <p className="text-center text-sm italic text-slate-500">ai sensi degli articoli 1341 e 1342 del Codice Civile</p>
                  
                  <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-4">
                    <p className="text-sm text-slate-700">Il Partner, con la sottoscrizione digitale del presente Contratto, dichiara di aver letto, compreso e di approvare specificamente le seguenti clausole:</p>
                    
                    <ul className="space-y-1">
                      {[
                        "Art. 7 — Revenue Share permanente e irrevocabile",
                        "Art. 8 — Durata minima e rinnovo automatico",
                        "Art. 9 — Recesso e obbligo pagamento canoni residui",
                        "Art. 10 — Proprietà intellettuale esclusiva",
                        "Art. 12 — Manleva AI e limitazione responsabilità",
                        "Art. 13 — Non concorrenza 3 anni con penale",
                        "Art. 14 — Sospensione senza indennizzo",
                        "Art. 15 — Cessione del contratto",
                        "Art. 18 — Clausola risolutiva espressa",
                        "Art. 20 — Non esclusività",
                        "Art. 22 — Foro esclusivo di Messina",
                      ].map((text, i) => (
                        <li key={i} className="text-sm text-slate-600 py-1.5 border-b border-slate-100 last:border-0">{text}</li>
                      ))}
                    </ul>
                    
                    <p className="text-xs text-slate-500 italic pt-2">La firma digitale apposta tramite OTP al presente Contratto costituisce accettazione espressa di tutte le clausole sopra elencate ai sensi e per gli effetti degli artt. 1341 e 1342 del Codice Civile.</p>
                  </div>
                </section>

                {/* Footer */}
                <div className="pt-8 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-400">Powered by Alessio Chianetta</p>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 flex items-center justify-center hover:bg-indigo-700 transition-colors print:hidden"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
