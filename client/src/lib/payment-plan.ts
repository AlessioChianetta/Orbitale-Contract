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
//    ordinaria, mai al costo di attivazione; riduce il totale da pagare.
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
const COUNT: Record<PlanFrequency, number> = { monthly: 12, quarterly: 4, semiannual: 2, annual: 1 };

export const toCents = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const euros = (cents: number) => (cents / 100).toFixed(2);

export function buildAutomaticPlan(input: BuildPlanInput): BuildPlanResult {
  const start = input.startDate ?? new Date();
  const count = COUNT[input.frequency];
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
