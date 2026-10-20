// Variabili libere dei template ("dati specifici del contratto").
//
// Chi scrive un template può usare segnaposto che iniziano con `var_`, per
// esempio `{{var_mercati}}`: il form del contratto mostra un campo per
// ciascuno e il server li sostituisce nel testo. Se un campo resta vuoto il
// segnaposto rimane nel testo e l'invio al cliente viene bloccato, come per
// le altre variabili.
//
// Etichetta e tipo di campo si possono dichiarare nel template con un
// commento (facoltativo, invisibile nel documento):
//   <!-- VAR var_mercati | Mercati e attività per mercato | testo lungo -->
// Senza dichiarazione l'etichetta si ricava dal nome ("var_settore_azienda"
// → "Settore azienda").

export const TEMPLATE_VAR_PREFIX = "var_";

export interface TemplateVarDef {
  key: string;
  label: string;
  multiline: boolean;
  hint?: string;
}

export function isTemplateVarKey(key: string): boolean {
  return key.startsWith(TEMPLATE_VAR_PREFIX) && key.length > TEMPLATE_VAR_PREFIX.length;
}

export function humanizeTemplateVarKey(key: string): string {
  const words = key.slice(TEMPLATE_VAR_PREFIX.length).split("_").filter(Boolean).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

const DEF_RE = /<!--\s*VAR\s+(var_[a-zA-Z0-9_]+)\s*\|([^|]*?)(?:\|([^|]*?))?(?:\|([^|]*?))?\s*-->/g;
const USE_RE = /\{\{\s*(var_[a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Variabili `var_*` usate nei testi indicati, nell'ordine in cui compaiono
 * (prima le dichiarazioni, poi gli usi senza dichiarazione).
 */
export function listTemplateVars(...htmls: Array<string | null | undefined>): TemplateVarDef[] {
  const defs = new Map<string, TemplateVarDef>();
  const used: string[] = [];
  for (const html of htmls) {
    if (!html) continue;
    for (const m of Array.from(html.matchAll(DEF_RE))) {
      const key = m[1];
      if (defs.has(key)) continue;
      const label = (m[2] || "").trim() || humanizeTemplateVarKey(key);
      const kind = (m[3] || "").trim().toLowerCase();
      const hint = (m[4] || "").trim() || undefined;
      defs.set(key, { key, label, multiline: kind === "testo lungo" || kind === "multiline", hint });
    }
    for (const m of Array.from(html.matchAll(USE_RE))) {
      if (!used.includes(m[1])) used.push(m[1]);
    }
  }
  const out: TemplateVarDef[] = [];
  for (const d of Array.from(defs.values())) if (used.includes(d.key)) out.push(d);
  for (const key of used) {
    if (!defs.has(key)) out.push({ key, label: humanizeTemplateVarKey(key), multiline: false });
  }
  return out;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Valori pronti per la sostituzione nel testo: HTML neutralizzato e a capo
 * trasformati in `<br>`. I campi vuoti NON vengono restituiti, così il
 * segnaposto resta nel testo e l'invio viene bloccato.
 */
export function templateVarReplacements(vars: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!vars || typeof vars !== "object" || Array.isArray(vars)) return out;
  for (const [key, raw] of Object.entries(vars as Record<string, unknown>)) {
    if (!isTemplateVarKey(key) || !/^[a-zA-Z0-9_]+$/.test(key)) continue;
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    const text = String(raw).replace(/\r\n?/g, "\n").trim();
    if (!text) continue;
    out[key] = escapeHtml(text).replace(/\n/g, "<br>");
  }
  return out;
}
