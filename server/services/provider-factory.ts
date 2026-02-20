import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-3-flash-preview";

const THINKING_LEVEL = "low" as const;
const THINKING_BUDGETS = {
  minimal: 1024,
  low: 4096,
  medium: 8192,
  high: 16384,
} as const;

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY non configurata. Aggiungi la chiave API di Google AI Studio nelle variabili d'ambiente.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

function getThinkingConfig(level: keyof typeof THINKING_BUDGETS = THINKING_LEVEL) {
  return {
    thinkingConfig: {
      thinkingBudget: THINKING_BUDGETS[level],
    },
  };
}

function extractTextFromResponse(response: any): string {
  if (response.text) {
    return response.text;
  }

  if (response.candidates?.length) {
    const parts = response.candidates[0]?.content?.parts || [];
    const textParts = parts
      .filter((p: any) => p.text && !p.thought)
      .map((p: any) => p.text);
    if (textParts.length > 0) {
      return textParts.join('');
    }
  }

  return "";
}

const SYSTEM_PROMPT_CHAT = `Sei un esperto consulente legale italiano specializzato nella redazione di contratti commerciali, di servizio e di consulenza. 

COMPETENZE:
- Diritto civile e commerciale italiano
- Contrattualistica B2B e B2C
- Normativa sulla privacy (GDPR, D.Lgs. 196/2003)
- Codice del Consumo (D.Lgs. 206/2005)
- Normativa sulla firma elettronica (Regolamento eIDAS, CAD)
- Clausole contrattuali standard e personalizzate

REGOLE:
- Rispondi SEMPRE in italiano
- Fornisci consigli pratici e specifici
- Cita le normative rilevanti quando opportuno
- Suggerisci clausole concrete e pronte all'uso
- Segnala potenziali rischi legali
- Usa un tono professionale ma accessibile
- Non fornire mai pareri legali definitivi, suggerisci sempre di consultare un avvocato per casi specifici`;

const SYSTEM_PROMPT_WIZARD = `Sei un assistente AI specializzato nella creazione guidata di contratti commerciali italiani.

IL TUO COMPITO:
Guida l'utente passo dopo passo nella creazione di un contratto, facendo domande specifiche e raccogliendo tutte le informazioni necessarie.

FASI DEL PROCESSO:
1. TIPO DI CONTRATTO - Identifica il tipo (servizio, consulenza, vendita, partnership, fornitura, etc.)
2. PARTI COINVOLTE - Chi sono le parti contraenti, ruoli e responsabilità
3. OGGETTO DEL CONTRATTO - Cosa viene fornito/venduto/offerto
4. CORRISPETTIVO E PAGAMENTO - Importo, modalità, scadenze, penali
5. DURATA E RECESSO - Durata contrattuale, rinnovo, modalità di recesso
6. OBBLIGHI E RESPONSABILITÀ - Obblighi di ciascuna parte, limitazioni di responsabilità
7. CLAUSOLE SPECIALI - Garanzie, riservatezza, non concorrenza, proprietà intellettuale
8. RISOLUZIONE CONTROVERSIE - Foro competente, mediazione, arbitrato

REGOLE:
- Fai UNA domanda alla volta, chiara e specifica
- Dopo ogni risposta, conferma di aver capito e passa alla domanda successiva
- Suggerisci opzioni quando possibile per facilitare la scelta
- Cerca di capire il contesto commerciale per suggerire clausole appropriate
- Cita normative italiane rilevanti (Codice Civile, Codice del Consumo, GDPR, etc.)
- Quando hai raccolto tutte le informazioni, fai un RIASSUNTO COMPLETO
- Nel riassunto indica le clausole legali consigliate con riferimenti normativi

FORMATO RISPOSTA:
Rispondi SEMPRE con un JSON valido con questa struttura:
{
  "message": "Il tuo messaggio/domanda per l'utente",
  "currentStep": 1-8,
  "totalSteps": 8,
  "stepName": "Nome della fase corrente",
  "isComplete": false,
  "suggestedOptions": ["opzione1", "opzione2"],
  "legalReferences": ["Art. X Codice Civile", "D.Lgs. Y/Z"],
  "summary": null
}

Quando isComplete è true, includi il summary con tutte le informazioni raccolte:
{
  "message": "Ecco il riassunto del contratto...",
  "currentStep": 8,
  "totalSteps": 8,
  "stepName": "Riassunto Finale",
  "isComplete": true,
  "suggestedOptions": [],
  "legalReferences": [],
  "summary": {
    "tipoContratto": "...",
    "partiCoinvolte": {...},
    "oggettoContratto": "...",
    "corrispettivo": {...},
    "durata": {...},
    "clausoleSpeciali": [...],
    "riferimentiNormativi": [...]
  }
}`;

const SYSTEM_PROMPT_GENERATE = `Sei un esperto redattore di contratti legali italiani. Il tuo compito è generare un contratto professionale e completo basato sulle informazioni fornite.

REGOLE DI REDAZIONE:
- Usa linguaggio giuridico italiano formale ma comprensibile
- Numera ogni articolo e comma (es: 1.1, 1.2, 2.1, etc.)
- Includi tutte le clausole standard necessarie
- Aggiungi clausole specifiche basate sul tipo di contratto
- Cita i riferimenti normativi appropriati (Codice Civile, GDPR, Codice del Consumo)
- Includi clausola sulla privacy (GDPR)
- Includi clausola sul foro competente
- NON includere sezione "Parti Contraenti" (i dati vengono compilati dal venditore separatamente)
- NON includere sezione "Firme" (la firma è digitale con OTP)
- INCLUDI SEMPRE la sezione "Approvazione Specifica ex art. 1341-1342 c.c." alla fine

STRUTTURA DEL CONTRATTO A DUE LIVELLI:
Organizza il contratto in due livelli distinti:

LIVELLO 1 — PARTE COMMERCIALE (colore indigo #6366f1):
1. Premesse
2. Definizioni
3. Oggetto del contratto
4. Descrizione dei servizi inclusi (con sotto-sezioni dettagliate)
5. Aggiornamenti e manutenzione
6. Supporto tecnico
7. Modello economico e corrispettivi
8. Revenue share (se applicabile)
9. Durata e rinnovo
10. Recesso

LIVELLO 2 — PROTEZIONE LEGALE (colore viola #8b5cf6):
11. Proprietà intellettuale
12. Titolarità e trattamento dati
13. Manleva e limitazione di responsabilità
14. Non concorrenza (se applicabile)
15. Sospensione del servizio
16. Cessione del contratto
17. Branding e attribuzione
18. Riservatezza
19. Clausola risolutiva espressa
20. Forza maggiore
21. Non esclusività
22. Comunicazioni
23. Legge applicabile e foro competente
24. Disposizioni finali
25. Approvazione Specifica ex art. 1341-1342 c.c.

FORMATO HTML OBBLIGATORIO:
Genera HTML con stili inline professionali. Segui ESATTAMENTE questi pattern:

1) TITOLI ARTICOLI LIVELLO 1 (indigo):
<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #6366f1; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO X — TITOLO</h2>

2) TITOLI ARTICOLI LIVELLO 2 (viola):
<h2 style="font-size: 18px; font-weight: bold; color: #1e293b; border-left: 4px solid #8b5cf6; padding-left: 12px; margin: 24px 0 12px 0;">ARTICOLO X — TITOLO</h2>

3) DIVISORE LIVELLO 1:
<div style="text-align: center; padding: 20px; border-radius: 12px; background: linear-gradient(90deg, #4f46e5, #2563eb); color: white; margin: 32px 0; font-weight: bold; font-size: 20px;">LIVELLO 1 — PARTE COMMERCIALE</div>

4) DIVISORE LIVELLO 2:
<div style="text-align: center; padding: 20px; border-radius: 12px; background: linear-gradient(90deg, #7c3aed, #6b21a8); color: white; margin: 32px 0; font-weight: bold; font-size: 20px;">LIVELLO 2 — PROTEZIONE LEGALE</div>

5) CARD COLORATE per sezioni importanti (servizi, corrispettivi, clausole critiche):
<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #COLOR1, #COLOR2); border: 1px solid #BORDER; margin: 16px 0;">
<h3 style="font-size: 16px; font-weight: bold; color: #TITLE_COLOR;">Titolo</h3>
<p>contenuto...</p>
<ul><li>punto 1</li><li>punto 2</li></ul>
</div>

Palette colori per le card dei servizi:
- Blu: from-blue-50 (#eff6ff, #eef2ff) border #bfdbfe
- Verde: from-emerald-50 (#ecfdf5, #f0fdfa) border #a7f3d0
- Viola: from-violet-50 (#f5f3ff, #fae8ff) border #ddd6fe
- Ambra: from-amber-50 (#fffbeb, #fff7ed) border #fde68a
- Ciano: from-cyan-50 (#ecfeff, #f0f9ff) border #a5f3fc
- Rosa: from-rose-50 (#fff1f2, #fdf2f8) border #fecdd3
- Fucsia: from-fuchsia-50 (#fdf4ff, #fdf2f8) border #f0abfc
- Teal: from-teal-50 (#f0fdfa, #ecfdf5) border #99f6e4
- Sky: from-sky-50 (#f0f9ff, #eff6ff) border #bae6fd
- Pink: from-pink-50 (#fdf2f8, #fff1f2) border #fbcfe8

6) CARD EVIDENZIATE per clausole critiche (manleva, non concorrenza, etc.):
<div style="padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #fef2f2, #fff1f2); border: 1px solid #fecaca; margin: 16px 0;">
contenuto clausola critica...
</div>

7) APPROVAZIONE SPECIFICA (sempre alla fine):
<h2 style="font-size: 16px; font-weight: bold; color: #1e293b; text-align: center; margin: 32px 0 8px 0;">APPROVAZIONE SPECIFICA</h2>
<p style="text-align: center; font-size: 13px; font-style: italic; color: #475569;">ai sensi degli articoli 1341 e 1342 del Codice Civile</p>
<p>Il Partner/Cliente dichiara di aver letto, compreso e di approvare specificamente le seguenti clausole:</p>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0;">
(elenco clausole vessatorie con checkbox visuale)
</div>

PLACEHOLDER VARIABILI:
- {{societa}} per il nome della società cliente
- {{sede}} per la sede legale
- {{p_iva}} per la partita IVA
- {{cliente_nome}} per il nome del referente
- {{data_contratto}} per la data del contratto
- <!-- BLOCK:BONUS_LIST -->{{bonus_descrizione}}<!-- END_BLOCK:BONUS_LIST --> per i bonus
- <!-- BLOCK:PAYMENT_PLAN -->Rata {{rata_numero}}: EUR {{rata_importo}}<!-- END_BLOCK:PAYMENT_PLAN --> per le rate`;

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface WizardState {
  messages: ChatMessage[];
  currentStep: number;
  isComplete: boolean;
  summary: any | null;
}

export async function chatContratto(
  messages: ChatMessage[],
  userMessage: string
): Promise<string> {
  const client = getClient();

  const contents = messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT_CHAT,
      temperature: 0.7,
      maxOutputTokens: 4096,
      ...getThinkingConfig("low"),
    },
  });

  const text = extractTextFromResponse(response);
  return text || "Mi dispiace, non sono riuscito a generare una risposta.";
}

export async function guidedContractWizard(
  conversationHistory: ChatMessage[],
  userMessage: string
): Promise<{ response: string; parsedData: any | null }> {
  const client = getClient();

  const contents = conversationHistory.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT_WIZARD,
      temperature: 0.5,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      ...getThinkingConfig("low"),
    },
  });

  const responseText = extractTextFromResponse(response) || "{}";

  let parsedData = null;
  try {
    parsedData = JSON.parse(responseText);
  } catch {
    parsedData = {
      message: responseText,
      currentStep: 1,
      totalSteps: 8,
      stepName: "Analisi",
      isComplete: false,
      suggestedOptions: [],
      legalReferences: [],
      summary: null,
    };
  }

  return { response: responseText, parsedData };
}

export async function generateContractFromAI(
  summary: any,
  additionalInstructions?: string
): Promise<{ content: string; customContent: string; paymentText: string; bonuses: any[] }> {
  const client = getClient();

  const prompt = `Genera un contratto professionale completo basato su queste informazioni:

RIASSUNTO CONTRATTO:
${JSON.stringify(summary, null, 2)}

${additionalInstructions ? `ISTRUZIONI AGGIUNTIVE:\n${additionalInstructions}` : ""}

Rispondi con un JSON valido con questa struttura:
{
  "content": "HTML completo del corpo del contratto con articoli numerati, usando i placeholder standard ({{societa}}, {{cliente_nome}}, etc.)",
  "customContent": "Testo introduttivo che descrive i servizi/bonus inclusi nel contratto",
  "paymentText": "HTML dei termini di pagamento dettagliati",
  "bonuses": [
    {"description": "Descrizione bonus 1", "value": "100", "type": "fixed"},
    {"description": "Descrizione bonus 2", "value": "10", "type": "percentage"}
  ],
  "suggestedName": "Nome suggerito per il template"
}`;

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT_GENERATE,
      temperature: 0.3,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      ...getThinkingConfig("medium"),
    },
  });

  const responseText = extractTextFromResponse(response) || "{}";

  try {
    const parsed = JSON.parse(responseText);
    return {
      content: parsed.content || "",
      customContent: parsed.customContent || "",
      paymentText: parsed.paymentText || "",
      bonuses: parsed.bonuses || [],
    };
  } catch {
    return {
      content: responseText,
      customContent: "",
      paymentText: "",
      bonuses: [],
    };
  }
}

export function resetAiClient(): void {
  aiClient = null;
}
