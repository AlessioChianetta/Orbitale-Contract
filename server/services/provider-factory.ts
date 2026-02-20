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
- Numera ogni articolo e comma
- Includi tutte le clausole standard necessarie
- Aggiungi clausole specifiche basate sul tipo di contratto
- Cita i riferimenti normativi appropriati
- Includi clausola sulla privacy (GDPR)
- Includi clausola sul foro competente
- Usa il formato HTML per la formattazione

STRUTTURA DEL CONTRATTO:
1. Premesse e definizioni
2. Oggetto del contratto
3. Obblighi delle parti
4. Corrispettivo e modalità di pagamento
5. Durata e recesso
6. Riservatezza
7. Proprietà intellettuale (se applicabile)
8. Garanzie e responsabilità
9. Clausola risolutiva espressa
10. Privacy e trattamento dati
11. Comunicazioni
12. Foro competente
13. Disposizioni finali

FORMATO OUTPUT:
Genera il contratto in HTML pulito con tag semantici (<h2>, <p>, <ol>, <li>, <strong>, <em>).
Usa i placeholder per i dati variabili:
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
      maxOutputTokens: 8192,
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
