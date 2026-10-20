/**
 * DOCUMENTO DEL CONTRATTO — sorgente unica.
 *
 * Questo modulo produce l'HTML e il CSS del contratto. Lo usano SIA la pagina
 * di firma del cliente (React, `professional-contract-document.tsx`) SIA il
 * PDF (Puppeteer, `server/services/pdf-generator-new.ts`) e le anteprime del
 * gestionale. Regola del proprietario: pagina e PDF devono essere sempre
 * identici. Qualsiasi modifica al testo o alla grafica del documento si fa
 * SOLO qui, mai in uno dei due punti di utilizzo.
 *
 * Modulo puro: niente React, niente Node, niente accesso al DB.
 */
import { SECTIONS_MARKER, renderSectionsHtml, type ModularSection } from "./sections";
import { formatDateItalian } from "./procacciatore-fields";
import { getClientType } from "./client-fields";

// ------------------------------------------------------------------ tipi

export interface DocCompany {
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  taxId?: string | null;
  uniqueCode?: string | null;
  pec?: string | null;
  contractTitle?: string | null;
  logoUrl?: string | null;
  /** azienda proprietaria della piattaforma (testi storici del proprietario) */
  isOwner?: boolean | null;
  /** dicitura IVA accanto ai prezzi: "+ IVA" (default), "IVA inclusa" o nessuna */
  priceVatMode?: PriceVatMode | string | null;
}

export type PriceVatMode = "plus_vat" | "vat_included" | "none";

/** Dicitura IVA da stampare accanto agli importi. */
export function priceVatSuffix(mode?: string | null): string {
  if (mode === "vat_included") return "IVA inclusa";
  if (mode === "none") return "";
  return "+ IVA";
}

export interface DocTemplate {
  name?: string | null;
  recipientType?: string | null;
  /** HTML finale del contratto (generatedContent già risolto dal server) */
  content?: string | null;
  customContent?: string | null;
  paymentText?: string | null;
  predefinedBonuses?: any[] | null;
}

export interface DocContract {
  id?: number | string | null;
  /** numero per azienda (es. 2026-0001); i contratti storici non lo hanno */
  contractNumber?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
  signedAt?: string | Date | null;
  contractStartDate?: string | Date | null;
  contractEndDate?: string | Date | null;
  isPercentagePartnership?: boolean | null;
  partnershipPercentage?: number | string | null;
  /** la clausola di autorinnovo si stampa solo se true (impaginazione attuale) */
  autoRenewal?: boolean | null;
  /**
   * Versione dell'impaginazione con cui il contratto è stato creato.
   * 1 = contratti creati prima del 20/10/2026: si rendono sempre come allora
   * (un contratto firmato non cambia). Assente o 2 = impaginazione attuale.
   */
  documentLayout?: number | null;
  renewalDuration?: number | null;
  regenerationNotice?: {
    regeneratedAt?: string | Date | null;
    originalSignedAt?: string | Date | null;
    reason?: string | null;
  } | null;
}

export interface DocPayment { rata_numero?: number; rata_importo?: string | number; rata_scadenza?: string; rata_descrizione?: string }

export interface ContractDocumentInput {
  company?: DocCompany | null;
  client?: Record<string, any> | null;
  template?: DocTemplate | null;
  contract?: DocContract | null;
  /** se omessi vengono ricavati da client/template con le stesse regole per tutti */
  paymentPlan?: DocPayment[];
  usingCustomInstallments?: boolean;
  bonusList?: Array<{ bonus_descrizione: string }>;
  /** sezioni modulari ancora da iniettare (solo anteprime del gestionale) */
  modularSections?: Array<{ id: string; title: string; content: string }>;
}

export interface ContractDocumentOptions {
  /**
   * pdf: PDF firmato · sign: pagina del cliente (area firma interattiva)
   * preview: anteprima nel gestionale
   */
  mode: "pdf" | "sign" | "preview";
  /** solo anteprime: testo d'esempio al posto dei campi vuoti */
  placeholders?: boolean;
  /** firma da stampare (data:image… oppure testo). In "sign" senza firma → area interattiva */
  signature?: string | null;
}

export interface ContractDocumentResult {
  html: string;
  /** indice delle sezioni (id = attributo data-section) */
  sections: Array<{ id: string; title: string }>;
}

/**
 * Numero del contratto da mostrare a clienti e operatori: quello per azienda
 * se presente, altrimenti l'id interno (contratti creati prima della
 * numerazione per azienda, che lo hanno già stampato così).
 */
export function contractDisplayNumber(c?: { contractNumber?: string | null; id?: number | string | null } | null): string {
  if (!c) return "";
  if (c.contractNumber) return String(c.contractNumber);
  return c.id === undefined || c.id === null ? "" : String(c.id);
}

/** Elemento in cui la pagina cliente monta l'area firma interattiva. */
export const SIGNATURE_SLOT_ATTR = "data-signature-slot";

// --------------------------------------------------------------- utilità

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Neutralizza i vettori XSS banali nell'HTML scritto nei template. */
export function sanitizeHtml(input?: string | null): string {
  if (!input) return "";
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "16 ottobre 2026" (fuso Europe/Rome; le date YYYY-MM-DD non slittano). */
export function formatLongDate(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return `${m[3]} ${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(d);
}

/** "16/10/2026" (fuso Europe/Rome; le date YYYY-MM-DD non slittano). */
export function formatShortDate(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" }).format(d);
}

/** Importi in formato europeo ("1.234,56") o JS ("1234.56"). */
export function parseAmount(val: unknown): number {
  const s = String(val ?? "0").trim();
  if (!s) return 0;
  const n = parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return isNaN(n) ? 0 : n;
}

/** Piano pagamenti e bonus: stesse regole per pagina, anteprime e PDF. */
export function derivePaymentsAndBonuses(client: Record<string, any> | null | undefined, template: DocTemplate | null | undefined) {
  const c = client || {};
  const usingCustomInstallments = Array.isArray(c.rata_list) && c.rata_list.length > 0;
  const raw: any[] = usingCustomInstallments ? c.rata_list : (Array.isArray(c.payment_plan) ? c.payment_plan : []);
  // Righe con descrizione (es. "Attivazione") non consumano un numero di
  // rata: senza descrizioni la numerazione resta 1, 2, 3… come sempre.
  let n = 0;
  const paymentPlan: DocPayment[] = raw.map((p: any) => {
    const descr = typeof p?.rata_descrizione === "string" && p.rata_descrizione.trim() ? p.rata_descrizione.trim() : undefined;
    return {
      rata_numero: descr ? undefined : ++n,
      rata_importo: p?.rata_importo ?? p?.amount ?? "0.00",
      rata_scadenza: p?.rata_scadenza ?? p?.date ?? "",
      ...(descr ? { rata_descrizione: descr } : {}),
    };
  });
  let bonusList: Array<{ bonus_descrizione: string }> = [];
  if (Array.isArray(template?.predefinedBonuses)) {
    bonusList = template!.predefinedBonuses!.map((b: any) => ({
      bonus_descrizione: b.description + (b.value ? ` (${b.value}${b.type === "percentage" ? "%" : "€"})` : ""),
    }));
  }
  if (Array.isArray(c.bonus_list)) bonusList = [...bonusList, ...c.bonus_list];
  return { paymentPlan, usingCustomInstallments, bonusList };
}

// ------------------------------------------------------------------ CSS

/**
 * Tutte le regole sono sotto `.tc-doc`, così nella pagina web non toccano il
 * resto dell'interfaccia. Le misure sono in `em`: stampa/PDF 9.6pt, schermo 15px.
 */
export const CONTRACT_DOCUMENT_CSS = `
.tc-doc {
  --ink: #1d1d1f; --ink-2: #424245; --muted: #6e6e73; --faint: #86868b;
  --line: #d2d2d7; --hair: #e8e8ed; --fill: #f5f5f7;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  font-size: 15px; line-height: 1.55; color: var(--ink-2); background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  counter-reset: tcsec; text-align: left;
}
@media print { .tc-doc { font-size: 9.6pt; } }
.tc-doc * { box-sizing: border-box; orphans: 3; widows: 3; }
.tc-doc p, .tc-doc h1, .tc-doc h2, .tc-doc h3, .tc-doc h4, .tc-doc ul, .tc-doc ol, .tc-doc li, .tc-doc table { margin: 0; padding: 0; }
.tc-doc strong, .tc-doc b { font-weight: 600; color: var(--ink); }

/* Intestazione */
.tc-doc .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  padding-bottom: 1.9em; border-bottom: 0.75pt solid var(--line); }
.tc-doc .doc-logo img { max-width: 140px; max-height: 56px; object-fit: contain; display: block; }
.tc-doc .doc-wordmark { font-size: 1.56em; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; line-height: 1.1; }
.tc-doc .doc-company { text-align: right; font-size: 0.83em; line-height: 1.55; color: var(--muted); }
.tc-doc .doc-company .name { font-size: 1.12em; font-weight: 600; color: var(--ink); margin-bottom: 2px; }

/* Titolo */
.tc-doc .doc-title { margin: 3.5em 0 3.1em 0; }
.tc-doc .doc-eyebrow { font-size: 0.78em; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); margin-bottom: 0.5em; }
.tc-doc .doc-title h1 { font-size: 2.5em; font-weight: 700; color: var(--ink); letter-spacing: -0.025em; line-height: 1.15; }

/* Sezioni numerate */
.tc-doc .section-header { display: flex; align-items: baseline; gap: 10px;
  font-size: 1.25em; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; line-height: 1.3;
  margin: 2.4em 0 1em 0; padding-top: 1.1em; border-top: 0.75pt solid var(--hair);
  page-break-after: avoid; break-after: avoid; }
.tc-doc .section-header::before { counter-increment: tcsec; content: counter(tcsec, decimal-leading-zero);
  font-size: 0.66em; font-weight: 600; color: var(--faint); letter-spacing: 0.04em; font-variant-numeric: tabular-nums; min-width: 16px; }

/* Dati anagrafici */
.tc-doc .fields { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; }
.tc-doc .fields td.f { width: 50%; vertical-align: top; padding: 0.85em 14px 0.85em 0; border-bottom: 0.75pt solid var(--hair); }
.tc-doc .fields td.f + td.f { padding-left: 14px; }
.tc-doc .fields tr:last-child td.f { border-bottom: none; }
.tc-doc .f-label { font-size: 0.73em; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); margin-bottom: 2px; }
.tc-doc .f-value { color: var(--ink); overflow-wrap: anywhere; }
.tc-doc .f-value.f-empty { color: #c7c7cc; }
.tc-doc .f-value.f-sample { color: var(--faint); font-style: italic; }
.tc-doc .fields-note { font-size: 0.885em; font-style: italic; color: var(--muted); padding: 1em 0 0.2em 0; }

/* Testo del template */
.tc-doc .template-content { color: var(--ink-2); line-height: 1.6; }
.tc-doc .template-content p { margin-bottom: 0.95em; }
.tc-doc .template-content ul, .tc-doc .template-content ol { margin: 0.8em 0 1em 0; padding-left: 1.4em; }
.tc-doc .template-content ul { list-style: disc; }
.tc-doc .template-content ol { list-style: decimal; }
.tc-doc .template-content li { margin-bottom: 0.4em; }
.tc-doc .template-content li::marker { color: var(--faint); }
.tc-doc .template-content em, .tc-doc .template-content i { font-style: italic; }
.tc-doc .template-content h1, .tc-doc .template-content h2, .tc-doc .template-content h3, .tc-doc .template-content h4 {
  color: var(--ink) !important; border: none !important; padding: 0 !important; background: none !important;
  letter-spacing: -0.01em; line-height: 1.3; page-break-after: avoid; break-after: avoid; }
.tc-doc .template-content h1 { font-size: 1.35em !important; font-weight: 700 !important; margin: 1.7em 0 0.6em 0 !important; }
.tc-doc .template-content h2 { font-size: 1.15em !important; font-weight: 600 !important; margin: 1.8em 0 0.55em 0 !important; }
.tc-doc .template-content h3, .tc-doc .template-content h4 { font-size: 1.04em !important; font-weight: 600 !important; margin: 1.4em 0 0.4em 0 !important; }
.tc-doc .template-content table { width: 100%; border-collapse: collapse; margin: 1em 0 1.4em 0 !important; font-size: 0.92em !important; page-break-inside: avoid; }
.tc-doc .template-content th, .tc-doc .template-content td { border-bottom: 0.75pt solid var(--hair) !important; padding: 0.6em 0.8em !important; text-align: left; vertical-align: top; }
.tc-doc .template-content th { font-weight: 600; color: var(--ink); }
.tc-doc .template-content tr { background: none !important; }
.tc-doc .template-content tr:first-child > th, .tc-doc .template-content thead tr { background: var(--fill) !important; }
/* I template contengono colori scritti in linea (barre, sfumature, riquadri
   colorati): qui diventano neutri. Il testo resta invariato. */
.tc-doc .template-content [style*="border-left"] { border-left: none !important; padding-left: 0 !important; }
.tc-doc .template-content [style*="background"] { background: var(--fill) !important; border: none !important; border-radius: 8px !important; }
.tc-doc .template-content tr[style*="background"], .tc-doc .template-content td[style*="background"] { border-radius: 0 !important; }
.tc-doc .template-content [style*="gradient"] { font-size: 1.15em !important; font-weight: 600 !important; text-align: left !important; padding: 0.9em 1em !important; margin: 1.6em 0 !important; }
.tc-doc .template-content [style*="color"] { color: var(--ink) !important; }
.tc-doc .template-content [style*="#64748b"], .tc-doc .template-content [style*="opacity"] { color: var(--muted) !important; opacity: 1 !important; }
.tc-doc .template-content [style*="#64748b"] strong { color: var(--muted); }

/* Elementi del documento */
.tc-doc .panel { background: var(--fill); border-radius: 10px; padding: 1.2em 1.4em; page-break-inside: avoid; }
.tc-doc .panel p + p { margin-top: 0.7em; }
.tc-doc .kv { width: 100%; border-collapse: collapse; }
.tc-doc .kv td { padding: 0.6em 0; border-bottom: 0.75pt solid var(--hair); vertical-align: top; }
.tc-doc .kv tr:last-child td { border-bottom: none; }
.tc-doc .kv td.k { width: 38%; color: var(--muted); }
.tc-doc .kv td.v { color: var(--ink); }
.tc-doc .lead { margin-bottom: 0.9em; color: var(--ink-2); }
.tc-doc .muted-note { color: var(--faint); font-style: italic; }
.tc-doc .pay { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; page-break-inside: avoid; }
.tc-doc .pay th { font-size: 0.73em; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint);
  text-align: left; padding: 0 0 0.6em 0; border-bottom: 0.75pt solid var(--line); }
.tc-doc .pay td { padding: 0.65em 0; border-bottom: 0.75pt solid var(--hair); color: var(--ink); }
.tc-doc .pay .num { text-align: right; }
.tc-doc .pay tfoot td { border-bottom: none; border-top: 0.75pt solid var(--line); font-weight: 600; padding-top: 0.75em; }
.tc-doc .pay-note { font-size: 0.83em; color: var(--muted); margin-top: 0.5em; }
.tc-doc .list { list-style: none; padding: 0; }
.tc-doc .list li { position: relative; padding-left: 14px; margin-bottom: 0.55em; }
.tc-doc .list li::before { content: ""; position: absolute; left: 2px; top: 0.62em; width: 4px; height: 4px; border-radius: 50%; background: var(--faint); }
.tc-doc .bonus-label { font-weight: 600; color: var(--ink); margin-right: 4px; }
.tc-doc .module { margin-bottom: 1.4em; }
.tc-doc .module h3 { font-size: 1.04em; font-weight: 600; color: var(--ink); margin-bottom: 0.4em; }

/* Firma */
.tc-doc .sign { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; margin-top: 3.2em; page-break-inside: avoid; }
.tc-doc .sign-box { width: 58%; }
.tc-doc .sign-area { min-height: 84px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 0.75pt solid var(--ink); padding-bottom: 6px; }
.tc-doc .sign-area img { max-height: 76px; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; }
.tc-doc .sign-area .sign-text { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 26px; color: var(--ink); }
.tc-doc .sign-area[${SIGNATURE_SLOT_ATTR}] { border-bottom: none; padding-bottom: 0; align-items: stretch; }
.tc-doc .sign-area[${SIGNATURE_SLOT_ATTR}] > * { flex: 1 1 auto; min-width: 0; }
.tc-doc .sign-caption { display: flex; justify-content: space-between; gap: 12px; margin-top: 0.5em; font-size: 0.83em; color: var(--muted); }
.tc-doc .sign-caption .who { color: var(--ink); font-weight: 500; }

.tc-doc .notice { margin-top: 2.6em; border: 0.75pt solid var(--line); border-radius: 10px; padding: 1.1em 1.3em; font-size: 0.885em; color: var(--ink-2); page-break-inside: avoid; }
.tc-doc .notice-title { font-size: 0.85em; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); margin-bottom: 0.3em; }

/* Telefono: una colonna */
@media screen and (max-width: 640px) {
  .tc-doc { font-size: 14px; }
  .tc-doc .doc-header { flex-direction: column; }
  .tc-doc .doc-company { text-align: left; }
  .tc-doc .doc-title h1 { font-size: 2em; }
  .tc-doc .fields td.f { display: block; width: 100%; padding-left: 0 !important; }
  .tc-doc .fields tr:last-child td.f { border-bottom: 0.75pt solid var(--hair); }
  .tc-doc .fields tr:last-child td.f:last-child { border-bottom: none; }
  .tc-doc .sign { flex-direction: column; align-items: stretch; gap: 20px; }
  .tc-doc .sign-box { width: 100%; }
}
`;

// ------------------------------------------------------------- rendering

const SAMPLE: Record<string, string> = {
  companyName: "Nome Azienda", address: "Via...", postalCode: "00000", city: "Città", taxId: "00000000000",
  uniqueCode: "XXXXXXX", pec: "pec@esempio.it",
};

export function renderContractDocument(input: ContractDocumentInput, opts: ContractDocumentOptions): ContractDocumentResult {
  const e = escapeHtml;
  const sample = opts.mode === "preview" && !!opts.placeholders;
  const company: DocCompany = input.company || {};
  const client: Record<string, any> = input.client || {};
  const template: DocTemplate = input.template || {};
  const contract: DocContract = input.contract || {};
  const derived = derivePaymentsAndBonuses(client, template);
  const paymentPlan = input.paymentPlan ?? derived.paymentPlan;
  const usingCustomInstallments = input.usingCustomInstallments ?? derived.usingCustomInstallments;
  const bonusList = input.bonusList ?? derived.bonusList;

  const isProcacciatore = template.recipientType === "procacciatore" ||
    (!!client.procacciatore_nome && !client.societa && !client.cliente_nome);
  // Impaginazione storica (v1): cliente privato stampato come azienda,
  // autorinnovo sempre presente, "+ IVA" fisso, validità sempre presente.
  const legacy = contract.documentLayout === 1;
  const isPrivato = !legacy && !isProcacciatore && getClientType(client) === "privato";
  const isPartnership = !!(contract.isPercentagePartnership && contract.partnershipPercentage);
  const vat = legacy ? "+ IVA" : priceVatSuffix(company.priceVatMode);
  const withVat = (label: string) => (vat ? `${label} ${vat}` : label);
  const renewalDuration = contract.renewalDuration || 12;
  const contractStartDate = contract.contractStartDate || contract.createdAt;
  const contractEndDate = contract.contractEndDate;

  // Sezioni modulari: nel marker del contenuto oppure in un blocco dedicato.
  const modular = input.modularSections || [];
  const modularHtml = modular.length
    ? renderSectionsHtml(modular.map((s) => ({ id: s.id, title: s.title, content: s.content, defaultEnabled: true, required: false, order: 0 })) as ModularSection[])
    : "";
  const rawContent = template.content || "";
  const contentHasMarker = rawContent.includes(SECTIONS_MARKER);
  const content = contentHasMarker ? rawContent.split(SECTIONS_MARKER).join(modularHtml) : rawContent;
  const showModularBlock = modular.length > 0 && !contentHasMarker;

  const sections: Array<{ id: string; title: string }> = [];
  const section = (id: string, title: string) => {
    sections.push({ id, title });
    return `<h2 class="section-header">${e(title)}</h2>`;
  };

  const co = (key: keyof DocCompany) => {
    const v = company[key];
    return v ? String(v) : (sample ? SAMPLE[key as string] || "" : "");
  };
  const field = (label: string, value: unknown, sampleValue = "", full = false) => {
    const v = value === undefined || value === null ? "" : String(value).trim();
    const shown = v || (sample ? sampleValue : "");
    const cls = v ? "" : (shown ? " f-sample" : " f-empty");
    return `<td class="f"${full ? ' colspan="2"' : ""}>
      <div class="f-label">${e(label)}</div>
      <div class="f-value${cls}">${shown ? e(shown) : "—"}</div>
    </td>`;
  };

  const addressLine = [co("address"), co("postalCode") ? `Cap ${co("postalCode")}` : "", co("city")].filter(Boolean).join(" ");
  const title = template.name || company.contractTitle || "Contratto";
  const totalAmount = paymentPlan.reduce((s, p) => s + parseAmount(p.rata_importo), 0).toFixed(2);

  const signerName = isProcacciatore
    ? (client.procacciatore_nome || "")
    : isPrivato ? (client.societa || client.cliente_nome || "") : (client.cliente_nome || client.societa || "");
  const docNumber = contractDisplayNumber(contract);
  const signatureInner = opts.signature
    ? (opts.signature.startsWith("data:image")
        ? `<img src="${e(opts.signature)}" alt="Firma" />`
        : `<div class="sign-text">${e(opts.signature)}</div>`)
    : "";
  const signatureArea = opts.mode === "sign" && !opts.signature
    ? `<div class="sign-area" ${SIGNATURE_SLOT_ATTR}></div>`
    : `<div class="sign-area">${signatureInner}</div>`;

  const parts: string[] = [];

  // 1. Intestazione
  parts.push(`
  <div data-section="intestazione">
    <header class="doc-header">
      <div class="doc-logo">
        ${company.logoUrl
          ? `<img src="${e(company.logoUrl)}" alt="${e(company.companyName || "Logo")}" />`
          : `<div class="doc-wordmark">${e(co("companyName"))}</div>`}
      </div>
      <div class="doc-company">
        ${company.logoUrl ? `<div class="name">${e(co("companyName"))}</div>` : ""}
        ${addressLine ? `<div>${e(addressLine)}</div>` : ""}
        ${co("taxId") ? `<div>C.F. e P.I. ${e(co("taxId"))}</div>` : ""}
        ${co("uniqueCode") ? `<div>Codice univoco ${e(co("uniqueCode"))}</div>` : ""}
        ${co("pec") ? `<div>PEC ${e(co("pec"))}</div>` : ""}
      </div>
    </header>
    <div class="doc-title">
      ${docNumber ? `<div class="doc-eyebrow">Contratto n. ${e(docNumber)}</div>` : ""}
      <h1>${e(title)}</h1>
    </div>
  </div>`);
  sections.push({ id: "intestazione", title: "Intestazione" });

  // 2. Controparte
  if (isProcacciatore) {
    const natoA = [client.procacciatore_nato_a, client.procacciatore_data_nascita ? `il ${formatDateItalian(client.procacciatore_data_nascita)}` : ""].filter(Boolean).join(" ");
    parts.push(`
  <section data-section="dati-cliente">
    ${section("dati-cliente", "Dati del procacciatore d'affari")}
    <table class="fields">
      <tr>${field("Nome / Ragione sociale", client.procacciatore_nome, "Nome Cognome")}${field("P.IVA", client.procacciatore_piva, "00000000000")}</tr>
      <tr>${field("Codice fiscale", client.procacciatore_codice_fiscale, "RSSMRA88C15F158X")}${field("Nato/a a", natoA, "Città (Prov.) il gg/mm/aaaa")}</tr>
      <tr>${field("Residenza", client.procacciatore_residenza, "Via..., CAP Città (Prov.)", true)}</tr>
      <tr>${field("Sede / Domicilio fiscale", client.procacciatore_sede, "Via..., Città", true)}</tr>
      <tr>${field("Email", client.email, "email@esempio.it")}${field("Cellulare", client.cellulare, "+39...")}</tr>
      ${(client.procacciatore_pec || client.procacciatore_sdi) ? `<tr>${field("PEC", client.procacciatore_pec)}${field("Codice SDI", client.procacciatore_sdi)}</tr>` : ""}
      ${client.procacciatore_iban ? `<tr>${field("IBAN", client.procacciatore_iban, "", true)}</tr>` : ""}
    </table>
  </section>`);
  } else if (isPrivato) {
    const cityProv = (city?: string, prov?: string) =>
      [city ? String(city).trim() : "", prov ? `(${String(prov).trim()})` : ""].filter(Boolean).join(" ");
    const join = (...xs: string[]) => xs.map((x) => (x || "").trim()).filter(Boolean).join(", ");
    const residenza = join(client.indirizzo_residenza, cityProv(client.residente_a, client.provincia_residenza))
      || join(client.indirizzo, cityProv(client.sede, client.provincia_sede));
    parts.push(`
  <section data-section="dati-cliente">
    ${section("dati-cliente", "Dati del cliente")}
    <table class="fields">
      <tr>${field("Nome e cognome", client.societa || client.cliente_nome, "Nome Cognome")}${field("Codice fiscale", client.p_iva, "RSSMRA80A01H501U")}</tr>
      <tr>${field("Nato/a a", client.nato_a, "Città")}${field("Data di nascita", formatShortDate(client.data_nascita), "01/01/1990")}</tr>
      <tr>${field("Residenza", residenza, "Via..., Città (Prov.)", true)}</tr>
      <tr>${field("Email", client.email, "email@esempio.it")}${field("Cellulare", client.cellulare, "+39...")}</tr>
    </table>
  </section>`);
  } else {
    parts.push(`
  <section data-section="dati-cliente">
    ${section("dati-cliente", "Dati del cliente / committente")}
    <table class="fields">
      <tr>${field("Società", client.societa, "Nome Società")}${field("Con sede in", client.sede, "Città")}</tr>
      <tr>${field("Indirizzo", client.indirizzo, "Via...")}${field("Codice fiscale / P.IVA", client.p_iva, "00000000000")}</tr>
      <tr>${field("PEC", client.pec, "pec@esempio.it")}${field("Email", client.email, "email@esempio.it")}</tr>
      <tr>${field("Cellulare", client.cellulare, "+39...")}${field("Codice univoco", client.codice_univoco, "XXXXXXX")}</tr>
      <tr>${field("Numero iscrizione al REA o al registro delle imprese", client.rea, "", true)}</tr>
    </table>
    <div class="fields-note">In persona del suo legale rappresentante p.t.</div>
    <table class="fields">
      <tr>${field("Signor/a", client.cliente_nome, "Nome Cognome")}${field("Nato a", client.nato_a, "Città")}</tr>
      <tr>${field("Data di nascita", formatShortDate(client.data_nascita), "01/01/1990")}${field("Residente a", client.residente_a, "Città")}</tr>
      <tr>${field("Indirizzo di residenza", client.indirizzo_residenza, "Via...", true)}</tr>
    </table>
  </section>`);
  }

  // 3. Contenuto personalizzato
  if (template.customContent) {
    parts.push(`
  <section data-section="contenuto-personalizzato">
    ${section("contenuto-personalizzato", "Contenuto personalizzato")}
    <div class="template-content">${sanitizeHtml(template.customContent)}</div>
  </section>`);
  }

  // 4. Partnership / piano pagamenti
  if (isPartnership) {
    parts.push(`
  <section data-section="piano-pagamenti">
    ${section("piano-pagamenti", "Modello di partnership")}
    <div class="panel">${legacy || company.isOwner ? `
      <p class="lead"><strong>Percentuale: ${e(contract.partnershipPercentage)}% sul fatturato TOTALE</strong></p>
      <p><strong>Definizione di fatturato totale.</strong> Per "fatturato TOTALE" si intende la somma di tutti i ricavi lordi generati dall'attività, comprensivi di:</p>
      <ul class="list" style="margin: 0.5em 0 0.9em 0;">
        <li>Vendite di cibo e bevande</li>
        <li>Servizi di catering e delivery</li>
        <li>Eventi privati e prenotazioni speciali</li>
        <li>Qualsiasi altro ricavo direttamente collegato all'attività</li>
      </ul>
      <p><strong>Modalità di calcolo e pagamento.</strong> Il pagamento della percentuale sarà calcolato mensilmente sul fatturato TOTALE del mese precedente e dovrà essere corrisposto entro il 15 del mese successivo tramite bonifico bancario.</p>
      <p><strong>Trasparenza e rendicontazione.</strong> Il Cliente si impegna a fornire mensilmente la documentazione contabile necessaria per il calcolo della percentuale dovuta, inclusi:</p>
      <ul class="list" style="margin: 0.5em 0 0.9em 0;">
        <li>Estratti conto del registratore di cassa o POS</li>
        <li>Fatture emesse nel periodo di riferimento</li>
        <li>Dichiarazioni IVA periodiche</li>
        <li>Report di fatturato certificati dal commercialista</li>
      </ul>
      <p><strong>Importante:</strong> questo modello di partnership sostituisce qualsiasi piano di pagamento fisso. Il compenso sarà calcolato esclusivamente come percentuale del fatturato totale.</p>` : `
      <p class="lead"><strong>Compenso: ${e(contract.partnershipPercentage)}% del fatturato</strong></p>
      <p>Il compenso è calcolato esclusivamente come percentuale del fatturato e sostituisce qualsiasi piano di pagamento fisso. Le modalità di calcolo, rendicontazione e pagamento sono quelle indicate nel presente contratto.</p>`}
    </div>
  </section>`);
  } else if (paymentPlan.length > 0) {
    parts.push(`
  <section data-section="piano-pagamenti">
    ${section("piano-pagamenti", "Piano pagamenti")}
    <p class="lead">Il prezzo totale di <strong>${e(withVat(`${totalAmount} EUR`))}</strong> sarà corrisposto con le seguenti modalità:</p>
    <table class="pay">
      <thead><tr><th>Pagamento</th><th>Entro il</th><th class="num">Importo (${e(withVat("EUR"))})</th></tr></thead>
      <tbody>
        ${paymentPlan.map((p, i) => `<tr><td>${e(p.rata_descrizione || p.rata_numero || i + 1)}</td><td>${e(formatShortDate(p.rata_scadenza) || p.rata_scadenza || "")}</td><td class="num">${e(p.rata_importo)}</td></tr>`).join("")}
      </tbody>
      <tfoot><tr><td colspan="2">Totale</td><td class="num">${e(totalAmount)}</td></tr></tfoot>
    </table>
    ${usingCustomInstallments ? `<p class="pay-note">Piano di pagamento personalizzato</p>` : ""}
  </section>`);
  }

  // 5. Condizioni di pagamento
  if (template.paymentText) {
    parts.push(`
  <section data-section="condizioni-pagamento">
    ${section("condizioni-pagamento", "Condizioni di pagamento")}
    <div class="template-content">${sanitizeHtml(template.paymentText)}</div>
  </section>`);
  }

  // 6. Servizi inclusi (solo se le sezioni modulari non hanno un marker nel testo)
  if (showModularBlock) {
    parts.push(`
  <section data-section="servizi-inclusi">
    ${section("servizi-inclusi", "Servizi inclusi")}
    ${modular.map((s) => `<div class="module"><h3>${e(s.title)}</h3><div class="template-content">${sanitizeHtml(s.content)}</div></div>`).join("")}
  </section>`);
  }

  // 7. Corpo del contratto (generatedContent già risolto dal server)
  if (content) {
    parts.push(`
  <section data-section="corpo-contratto">
    ${section("corpo-contratto", "Corpo del contratto")}
    <div class="template-content">${sanitizeHtml(content)}</div>
  </section>`);
  }

  // 8. Bonus
  if (bonusList.length > 0) {
    parts.push(`
  <section data-section="bonus">
    ${section("bonus", "Bonus inclusi")}
    <ul class="list">
      ${bonusList.map((b, i) => `<li><span class="bonus-label">Bonus ${i + 1}</span>${e(b.bonus_descrizione)}</li>`).join("")}
    </ul>
  </section>`);
  }

  // 9. Validità
  const validityRows = [
    contractStartDate ? `<tr><td class="k">Data di inizio</td><td class="v">${e(formatLongDate(contractStartDate))}</td></tr>` : "",
    contractEndDate ? `<tr><td class="k">Data di scadenza</td><td class="v">${e(formatLongDate(contractEndDate))}</td></tr>` : "",
    contract.signedAt ? `<tr><td class="k">Firmato il</td><td class="v">${e(formatLongDate(contract.signedAt))}</td></tr>` : "",
  ].join("");
  if (legacy || validityRows || opts.mode === "preview") {
    parts.push(`
  <section data-section="validita">
    ${section("validita", "Validità del contratto")}
    ${validityRows
      ? `<table class="kv">${validityRows}</table>`
      : (opts.mode === "preview" ? `<p class="muted-note">Le date di validità saranno compilate alla creazione del contratto.</p>` : "")}
  </section>`);
  }

  // 10. Autorinnovo: solo se attivo sul contratto (il contratto procacciatore
  // disciplina durata e recesso nei propri articoli)
  if (!isProcacciatore && (legacy || contract.autoRenewal === true)) {
    parts.push(`
  <section data-section="autorinnovo">
    ${section("autorinnovo", "Clausola di autorinnovo")}
    <div class="template-content">
      <p>Il presente contratto si intende tacitamente rinnovato per un periodo di <strong>${e(renewalDuration)} mesi</strong> salvo disdetta da comunicarsi con un preavviso di almeno 30 giorni prima della scadenza mediante raccomandata A/R o PEC.</p>
      <p>In assenza di comunicazione di disdetta nei termini previsti, il contratto si rinnoverà automaticamente alle medesime condizioni economiche e contrattuali per ulteriori <strong>${e(renewalDuration)} mesi</strong>.</p>
    </div>
  </section>`);
  }

  // 11. Dichiarazioni e firma
  parts.push(`
  <section data-section="firma" style="page-break-inside: avoid;">
    ${section("firma", "Dichiarazioni e firma")}
    <p style="margin-bottom: 0.7em;">Con la sottoscrizione del presente contratto, ${isProcacciatore ? "il Procacciatore" : "il Cliente"} dichiara:</p>
    <ul class="list">
      <li>di aver letto e compreso integralmente il contenuto del presente contratto;</li>
      <li>di accettare espressamente tutte le clausole e condizioni in esso contenute;</li>
      <li>di aver ricevuto tutte le informazioni necessarie prima della sottoscrizione;</li>
      <li>che i dati forniti sono veritieri e aggiornati.</li>
    </ul>
    <div class="sign">
      <div class="sign-date">
        <div class="f-label">Data</div>
        <div class="f-value">${e(formatShortDate(contract.signedAt || new Date()))}</div>
      </div>
      <div class="sign-box">
        ${signatureArea}
        <div class="sign-caption">
          <span>${isProcacciatore ? "Firma del Procacciatore" : isPrivato ? "Firma del Cliente" : "Firma del Cliente / Committente"}</span>
          ${signerName ? `<span class="who">${e(signerName)}</span>` : ""}
        </div>
      </div>
    </div>
  </section>`);

  // Avviso di rigenerazione (solo PDF rigenerati dopo la firma)
  const rn = contract.regenerationNotice;
  if (rn) {
    parts.push(`
  <div class="notice">
    <div class="notice-title">Documento rigenerato</div>
    <p>Documento rigenerato il <strong>${e(formatLongDate(rn.regeneratedAt))}</strong>${rn.originalSignedAt ? ` — firme originali apposte il <strong>${e(formatLongDate(rn.originalSignedAt))}</strong>` : ""}.${rn.reason ? ` Motivo: ${e(rn.reason)}.` : ""}
    Il presente PDF sostituisce la versione originale con contenuto aggiornato; le firme e il consenso OTP restano quelli apposti nella data di firma originale.</p>
  </div>`);
  }

  return { html: `<div class="tc-doc">${parts.join("\n")}</div>`, sections };
}
