/**
 * Pacchetti cumulativi del contratto cliente "Sistema Orbitale" v2.
 *
 * Il contratto v2 organizza l'offerta in 5 pacchetti CUMULATIVI (ogni
 * pacchetto include integralmente i precedenti) più una sezione FAQ
 * facoltativa aggiungibile a qualsiasi pacchetto:
 *
 *   PACCHETTO 1 — BASE   (Livello 3)   blocco 01
 *   PACCHETTO 2 — SOCIAL (Livello 4)   blocchi 01+02
 *   PACCHETTO 3 — SETTER (Livello 5)   blocchi 01–03
 *   PACCHETTO 4 — GROWTH (Livello 6)   blocchi 01–04
 *   PACCHETTO 5 — FULL   (Livello 7)   blocchi 01–05
 *   FAQ (facoltativa)                  blocco 06
 *
 * La cumulatività è codificata negli id sezione `pkg-<numero>-<nome>`:
 * il pacchetto più alto selezionato implica tutti quelli con numero
 * inferiore. Gli id dei vecchi moduli v1 (`pkg_setter_ai`, …, con
 * underscore) non matchano il pattern e restano quindi non-cumulativi.
 */
import type { ModularSection } from "./sections";

export interface OrbitalPackageInfo {
  /** Numero progressivo del pacchetto (1 = BASE … 5 = FULL). */
  num: 1 | 2 | 3 | 4 | 5;
  /** Nome commerciale del pacchetto. */
  key: "BASE" | "SOCIAL" | "SETTER" | "GROWTH" | "FULL";
  /** Livello di accesso della piattaforma (BASE=3 … FULL=7). */
  level: number;
  /** Id della sezione modulare corrispondente nel template. */
  sectionId: string;
  /** Etichetta per il campo "Livello di accesso" ({{livello_accesso}}). */
  accessLabel: string;
  /** Listino ufficiale (Articolo 4 del contratto v2). */
  listino: {
    monthlyFee: number;
    activationFee: number;
    monthlyCredits: number;
  };
}

export const ORBITAL_PACKAGES: OrbitalPackageInfo[] = [
  {
    num: 1,
    key: "BASE",
    level: 3,
    sectionId: "pkg-1-base",
    accessLabel: "BASE — Livello 3",
    listino: { monthlyFee: 200, activationFee: 500, monthlyCredits: 5000 },
  },
  {
    num: 2,
    key: "SOCIAL",
    level: 4,
    sectionId: "pkg-2-social",
    accessLabel: "SOCIAL — Livello 4",
    listino: { monthlyFee: 300, activationFee: 500, monthlyCredits: 10000 },
  },
  {
    num: 3,
    key: "SETTER",
    level: 5,
    sectionId: "pkg-3-setter",
    accessLabel: "SETTER — Livello 5",
    listino: { monthlyFee: 500, activationFee: 1000, monthlyCredits: 20000 },
  },
  {
    num: 4,
    key: "GROWTH",
    level: 6,
    sectionId: "pkg-4-growth",
    accessLabel: "GROWTH — Livello 6",
    listino: { monthlyFee: 800, activationFee: 1000, monthlyCredits: 20000 },
  },
  {
    num: 5,
    key: "FULL",
    level: 7,
    sectionId: "pkg-5-full",
    accessLabel: "FULL — Livello 7",
    listino: { monthlyFee: 1200, activationFee: 2000, monthlyCredits: 50000 },
  },
];

/** Id della sezione FAQ facoltativa (non cumulativa, aggiungibile sempre). */
export const ORBITAL_FAQ_SECTION_ID = "pkg-faq";

const PACKAGE_SECTION_ID_RE = /^pkg-(\d+)-/;

/** Numero di pacchetto codificato in un id sezione, o null se non è un pacchetto. */
export function orbitalPackageNumFromSectionId(sectionId: string): number | null {
  const match = PACKAGE_SECTION_ID_RE.exec(sectionId);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isInteger(num) && num >= 1 ? num : null;
}

/**
 * True se le sezioni del template sono i pacchetti cumulativi orbitali
 * (almeno 2 sezioni con id `pkg-<numero>-…`). I template v1 (id con
 * underscore) e gli altri template restituiscono false.
 */
export function isOrbitalPackagesTemplate(sections: ModularSection[]): boolean {
  let packages = 0;
  for (const section of sections) {
    if (orbitalPackageNumFromSectionId(section.id) !== null) packages++;
    if (packages >= 2) return true;
  }
  return false;
}

/** Numero del pacchetto più alto tra gli id selezionati (null se nessuno). */
export function orbitalPackageNumFromSelection(selectedIds: string[]): number | null {
  let max: number | null = null;
  for (const id of selectedIds) {
    const num = orbitalPackageNumFromSectionId(id);
    if (num !== null && (max === null || num > max)) max = num;
  }
  return max;
}

/** Metadati del pacchetto per numero (null se non esiste). */
export function orbitalPackageByNum(num: number | null | undefined): OrbitalPackageInfo | null {
  if (num == null) return null;
  return ORBITAL_PACKAGES.find((pkg) => pkg.num === num) ?? null;
}

/**
 * Espansione cumulativa della selezione: se tra gli id c'è almeno un
 * pacchetto numerato, include automaticamente tutti i pacchetti del
 * template con numero inferiore o uguale al più alto selezionato.
 * Gli id non-pacchetto (es. FAQ) passano invariati; per template
 * non-orbitali la selezione resta com'è.
 */
export function expandOrbitalCumulativeSelection(
  sections: ModularSection[],
  selectedIds: string[],
): string[] {
  if (!isOrbitalPackagesTemplate(sections)) return selectedIds;
  const maxNum = orbitalPackageNumFromSelection(selectedIds);
  if (maxNum === null) return selectedIds;
  const result = new Set<string>();
  for (const section of sections) {
    const num = orbitalPackageNumFromSectionId(section.id);
    if (num !== null && num <= maxNum) result.add(section.id);
  }
  for (const id of selectedIds) {
    if (orbitalPackageNumFromSectionId(id) === null) result.add(id);
  }
  return Array.from(result);
}

/**
 * Id sezione da selezionare per un dato pacchetto (già espansi in forma
 * cumulativa), con FAQ opzionale in coda. Rispetta l'ordine delle sezioni
 * del template.
 */
export function orbitalSectionIdsForPackage(
  sections: ModularSection[],
  packageNum: number,
  includeFaq: boolean,
): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    const num = orbitalPackageNumFromSectionId(section.id);
    if (num !== null && num <= packageNum) {
      ids.push(section.id);
    } else if (includeFaq && section.id === ORBITAL_FAQ_SECTION_ID) {
      ids.push(section.id);
    }
  }
  return ids;
}
