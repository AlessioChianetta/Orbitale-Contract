// Calcolo del piano rate automatico. Funzione pura, usata dal calcolatore
// pagamenti e dai controlli prima dell'anteprima/invio, così i due non
// possono dare risultati diversi.
//
// Regole:
//  - si lavora in centesimi: la somma delle rate è SEMPRE uguale al totale
//    (l'eventuale resto dell'arrotondamento va sull'ultima rata, es.
//    1000 € in 12 rate = 11 × 83,33 + 83,37);
//  - costo di attivazione "incluso nel prezzo totale": è il primo pagamento,
//    alla firma; il resto (totale − attivazione) si divide nelle rate, la
//    prima un mese dopo la firma e le successive alla frequenza scelta;
//  - sconto prima rata (solo abbonamento): si applica alla prima rata
//    ordinaria, mai al costo di attivazione; riduce il totale da pagare;
//  - numero di rate: per contratti di 12 mesi o più resta quello storico
//    (12 mensili, 4 trimestrali, 2 semestrali, 1 annuale); per contratti
//    più brevi segue la durata (es. 3 mesi → 3 rate mensili, 1 trimestrale).
import { addMonths, format } from "date-fns";

export type PlanFrequency = "monthly" | "quarterly" | "semiannual" | "annual";

export interface PlanDiscount {
  enabled: boolean;
  type: "percentage" | "fixed";
  value: number;
}

export interface PlanInstallment {
  rata_importo: string;
  rata_scadenza: string;
  /** Etichetta della riga nel documento al posto del numero (es. "Attivazione"). */
  rata_descrizione?: string;
}

export interface BuildPlanInput {
  total: number;
  frequency: PlanFrequency;
  startDate?: Date;
  isSubscription?: boolean;
  discount?: PlanDiscount | null;
  activationFee?: number | null;
  includeActivation?: boolean;
  /** Durata del contratto in mesi (vedi `contractDurationMonths`). */
  durationMonths?: number | null;
}

export interface BuildPlanResult {
  plan: PlanInstallment[];
  /** Somma delle rate in euro: è il totale che il contratto riporta. */
  totalToPay: number;
  installmentsCount: number;
  /** Importo della rata ordinaria (senza resto né sconto), per le etichette. */
  regularInstallment: number;
  activationIncluded: number;
  discountAmount: number;
  error?: string;
}

export const ACTIVATION_LABEL = "Attivazione";

const PERIOD_MONTHS: Record<PlanFrequency, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

/** Numero di rate per frequenza e durata (≥ 12 mesi: valori storici). */
export function installmentCount(frequency: PlanFrequency, durationMonths?: number | null): number {
  const d = Number(durationMonths);
  const months = Number.isFinite(d) && d >= 1 && d < 12 ? Math.round(d) : 12;
  if (frequency === "annual") return 1;
  return Math.max(1, Math.ceil(months / PERIOD_MONTHS[frequency]));
}

/**
 * Durata in mesi tra due date (YYYY-MM-DD), arrotondata al mese più vicino
 * (20/10 → 19/01 vale 3 mesi). undefined se le date mancano o non sono valide.
 */
export function contractDurationMonths(start?: string | null, end?: string | null): number | undefined {
  const re = /^(\d{4})-(\d{2})-(\d{2})/;
  const a = re.exec(String(start ?? ""));
  const b = re.exec(String(end ?? ""));
  if (!a || !b) return undefined;
  const months = (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2])) + (Number(b[3]) - Number(a[3])) / 30;
  const rounded = Math.round(months);
  return rounded >= 1 ? rounded : undefined;
}

/** Frequenza più probabile di un piano salvato con `n` rate ordinarie. */
export function inferPlanFrequency(n: number, durationMonths?: number | null): PlanFrequency {
  if (n > 1) {
    for (const f of ["monthly", "quarterly", "semiannual"] as PlanFrequency[]) {
      if (installmentCount(f, durationMonths) === n) return f;
    }
  }
  if (n >= 12) return "monthly";
  if (n >= 4) return "quarterly";
  if (n >= 2) return "semiannual";
  return "annual";
}

export const toCents = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const euros = (cents: number) => (cents / 100).toFixed(2);

export function buildAutomaticPlan(input: BuildPlanInput): BuildPlanResult {
  const start = input.startDate ?? new Date();
  const count = installmentCount(input.frequency, input.durationMonths);
  const totalCents = toCents(input.total);
  const empty: BuildPlanResult = {
    plan: [], totalToPay: 0, installmentsCount: count, regularInstallment: 0, activationIncluded: 0, discountAmount: 0,
  };
  if (totalCents <= 0) return empty;

  const activationCents = input.includeActivation ? Math.max(0, toCents(input.activationFee)) : 0;
  if (input.includeActivation && activationCents <= 0) {
    return { ...empty, error: "Inserisci il costo di attivazione per includerlo nel prezzo totale." };
  }
  if (activationCents >= totalCents) {
    return { ...empty, error: "Il costo di attivazione deve essere minore del prezzo totale." };
  }

  const restCents = totalCents - activationCents;
  const base = Math.floor(restCents / count);
  const remainder = restCents - base * count;
  const amounts = Array.from({ length: count }, (_, i) => base + (i === count - 1 ? remainder : 0));

  let discountCents = 0;
  const d = input.discount;
  if (input.isSubscription && d?.enabled && d.value > 0) {
    const first = amounts[0];
    discountCents = d.type === "percentage"
      ? Math.round(first * Math.min(100, d.value) / 100)
      : Math.min(first, toCents(d.value));
    amounts[0] = first - discountCents;
  }

  const firstInstallmentDate = activationCents > 0 ? addMonths(start, 1) : start;
  const plan: PlanInstallment[] = [];
  if (activationCents > 0) {
    plan.push({ rata_importo: euros(activationCents), rata_scadenza: format(start, "dd/MM/yyyy"), rata_descrizione: ACTIVATION_LABEL });
  }
  amounts.forEach((cents, i) => {
    plan.push({
      rata_importo: euros(cents),
      rata_scadenza: format(addMonths(firstInstallmentDate, i * PERIOD_MONTHS[input.frequency]), "dd/MM/yyyy"),
    });
  });

  return {
    plan,
    totalToPay: (totalCents - discountCents) / 100,
    installmentsCount: count,
    regularInstallment: base / 100,
    activationIncluded: activationCents / 100,
    discountAmount: discountCents / 100,
  };
}

/** Somma delle rate in centesimi (accetta "1234.56" e "1.234,56"). */
export function sumPlanCents(plan: Array<{ rata_importo?: unknown }> | null | undefined): number {
  return (plan || []).reduce((s, p) => {
    const raw = String(p?.rata_importo ?? "").trim();
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    return s + toCents(normalized);
  }, 0);
}
