// Helper condivisi per il contratto "Procacciatore d'Affari".
// Usati da server (validazione, generazione contenuto, co-fill) e dal
// client (wizard contratto, pagina pubblica di compilazione).
//
// Il template procacciatore usa 3 famiglie di placeholder:
//  - azienda_*           -> risolti automaticamente dalle Impostazioni Azienda
//  - procacciatore_*     -> anagrafica del procacciatore (venditore o co-fill)
//  - parametri economici -> decisi da chi emette il contratto (MAI dal firmatario)

export type TemplateRecipientType = "cliente" | "procacciatore";

/** Tipo di destinatario di un template (default: "cliente" per retrocompatibilità). */
export function getTemplateRecipientType(
  template: { recipientType?: string | null } | null | undefined,
): TemplateRecipientType {
  return template?.recipientType === "procacciatore" ? "procacciatore" : "cliente";
}

export type ProcacciatoreField = {
  key: string;
  label: string;
  sectionId: string;
  group: "anagrafica" | "economico";
  type?: "text" | "email" | "tel" | "date" | "select" | "number";
  options?: string[];
  hint?: string;
  /** true = campo facoltativo: non blocca invio/firma, appare solo nella tabella dati. */
  optional?: boolean;
};

// Anagrafica: compilabile dal venditore oppure dal procacciatore stesso
// tramite link di compilazione (client_fill / co-fill).
// I campi con `optional: true` (PEC, SDI, IBAN) non bloccano mai il flusso:
// compaiono nella tabella dati del contratto solo se valorizzati.
export const PROCACCIATORE_ANAGRAFICA_FIELDS: ProcacciatoreField[] = [
  { key: "procacciatore_nome", label: "Nome e cognome / Ragione sociale", sectionId: "section-client", group: "anagrafica" },
  { key: "procacciatore_piva", label: "Partita IVA", sectionId: "section-client", group: "anagrafica", hint: "P.IVA del procacciatore (11 cifre)" },
  { key: "procacciatore_codice_fiscale", label: "Codice Fiscale", sectionId: "section-client", group: "anagrafica", hint: "16 caratteri per le persone fisiche (o 11 cifre se coincide con la P.IVA)" },
  { key: "procacciatore_nato_a", label: "Luogo di nascita", sectionId: "section-client", group: "anagrafica", hint: "Es. Messina (ME)" },
  { key: "procacciatore_data_nascita", label: "Data di nascita", sectionId: "section-client", group: "anagrafica", type: "date" },
  { key: "procacciatore_residenza", label: "Residenza", sectionId: "section-client", group: "anagrafica", hint: "Via, CAP, città e provincia. Es. Via Garibaldi 10, 98100 Messina (ME)" },
  { key: "procacciatore_sede", label: "Sede / Domicilio fiscale", sectionId: "section-client", group: "anagrafica", hint: "Es. Via Roma 1, 98100 Messina (ME)" },
  { key: "email", label: "Email", sectionId: "section-client", group: "anagrafica", type: "email" },
  { key: "cellulare", label: "Cellulare", sectionId: "section-client", group: "anagrafica", type: "tel" },
  { key: "procacciatore_pec", label: "PEC", sectionId: "section-client", group: "anagrafica", type: "email", hint: "Indirizzo di posta certificata (facoltativo)", optional: true },
  { key: "procacciatore_sdi", label: "Codice SDI", sectionId: "section-client", group: "anagrafica", hint: "Codice destinatario per la fatturazione elettronica (facoltativo)", optional: true },
  { key: "procacciatore_iban", label: "IBAN", sectionId: "section-client", group: "anagrafica", hint: "IBAN per l'accredito delle provvigioni (facoltativo)", optional: true },
];

// Parametri economici del contratto: SOLO chi emette il contratto li imposta.
// Non vengono mai chiesti al firmatario e non sono accettati dal co-fill.
export const PROCACCIATORE_ECONOMIC_FIELDS: ProcacciatoreField[] = [
  { key: "data_decorrenza", label: "Data di decorrenza", sectionId: "section-modular-sections", group: "economico", type: "date" },
  { key: "ciclo_liquidazione", label: "Ciclo di liquidazione", sectionId: "section-modular-sections", group: "economico", type: "select", options: ["mensile", "bimestrale", "trimestrale"] },
  { key: "giorno_cutoff", label: "Giorno di cut-off", sectionId: "section-modular-sections", group: "economico", type: "number", hint: "Giorno del mese entro cui gli incassi entrano nel ciclo (es. 5)" },
  { key: "giorni_pagamento", label: "Giorni per il pagamento", sectionId: "section-modular-sections", group: "economico", type: "number", hint: "Giorni dalla ricezione della fattura del procacciatore (es. 15)" },
  { key: "mesi_coda_provvigionale", label: "Mesi di coda provvigionale", sectionId: "section-modular-sections", group: "economico", type: "number", hint: "Per quanti mesi dopo la cessazione maturano le provvigioni (es. 6)" },
  { key: "giorni_preavviso", label: "Giorni di preavviso per il recesso", sectionId: "section-modular-sections", group: "economico", type: "number", hint: "Es. 30" },
];

export const PROCACCIATORE_ALL_FIELDS: ProcacciatoreField[] = [
  ...PROCACCIATORE_ANAGRAFICA_FIELDS,
  ...PROCACCIATORE_ECONOMIC_FIELDS,
];

// Chiavi che il firmatario può inviare dal link pubblico (co-fill).
// I parametri economici sono volutamente ESCLUSI: restano sotto il
// controllo esclusivo di chi emette il contratto.
export const PROCACCIATORE_SYNCED_FIELD_KEYS: string[] = PROCACCIATORE_ANAGRAFICA_FIELDS.map((f) => f.key);

/** Campi anagrafici mancanti (per il flusso "compila il procacciatore").
 *  I campi `optional` non vengono mai considerati mancanti. */
export function getMissingProcacciatoreFields(
  clientData: Record<string, any> | undefined | null,
): ProcacciatoreField[] {
  const cd = clientData || {};
  return PROCACCIATORE_ANAGRAFICA_FIELDS.filter((f) => {
    if (f.optional) return false;
    const v = cd[f.key];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  });
}

/** Parametri economici mancanti (devono essere compilati PRIMA dell'invio). */
export function getMissingProcacciatoreEconomicFields(
  clientData: Record<string, any> | undefined | null,
): ProcacciatoreField[] {
  const cd = clientData || {};
  return PROCACCIATORE_ECONOMIC_FIELDS.filter((f) => {
    const v = cd[f.key];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  });
}

// Etichette leggibili per i placeholder del template procacciatore
// (mostrate nella checklist "variabili non compilate" del gate di invio).
export const PROCACCIATORE_PLACEHOLDER_LABELS: Record<string, string> = {
  azienda_ragione_sociale: "Ragione sociale azienda (da Impostazioni Azienda)",
  azienda_piva: "P.IVA azienda (da Impostazioni Azienda)",
  azienda_sede: "Sede azienda (da Impostazioni Azienda)",
  procacciatore_nome: "Nome e cognome / ragione sociale del procacciatore",
  procacciatore_piva: "Partita IVA del procacciatore",
  procacciatore_codice_fiscale: "Codice Fiscale del procacciatore",
  procacciatore_nato_a: "Luogo di nascita del procacciatore",
  procacciatore_data_nascita: "Data di nascita del procacciatore",
  procacciatore_residenza: "Residenza del procacciatore",
  procacciatore_sede: "Sede / domicilio fiscale del procacciatore",
  data_decorrenza: "Data di decorrenza del contratto",
  ciclo_liquidazione: "Ciclo di liquidazione (mensile/bimestrale/trimestrale)",
  giorno_cutoff: "Giorno di cut-off",
  giorni_pagamento: "Giorni per il pagamento",
  mesi_coda_provvigionale: "Mesi di coda provvigionale",
  giorni_preavviso: "Giorni di preavviso per il recesso",
};

/** Formatta una data ISO (yyyy-mm-dd) in formato italiano gg/mm/aaaa. */
export function formatDateItalian(value: string | undefined | null): string {
  if (!value || typeof value !== "string") return "";
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value.trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}
