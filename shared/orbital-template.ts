/**
 * Template contratto cliente "Sistema Orbitale" — v2 (5 pacchetti cumulativi).
 *
 * Il corpo del contratto e i blocchi pacchetto vivono in
 * shared/orbital-contract-content.ts (generato da
 * scripts/generate-orbital-content.ts a partire dai file HTML sorgente).
 * Qui si assemblano template e sezioni modulari usati da:
 *   - server/storage.ts  → seed + sincronizzazione idempotente nel DB;
 *   - template-editor    → pulsanti "ripristina versione completa/vuota".
 */
import { SECTIONS_MARKER, type ModularSection } from "./sections";
import {
  ORBITAL_CONTRACT_BODY_V2,
  ORBITAL_PACKAGE_BLOCKS_V2,
} from "./orbital-contract-content";
import { ORBITAL_PACKAGES, ORBITAL_FAQ_SECTION_ID } from "./orbital-packages";

export const ORBITAL_TEMPLATE_NAME = "Sistema Orbitale — Modulare";

export const ORBITAL_TEMPLATE_DESCRIPTION =
  "Contratto cliente Sistema Orbitale: 5 pacchetti cumulativi (BASE, SOCIAL, SETTER, GROWTH, FULL) più FAQ facoltative. Listino e crediti nell'Articolo 4.";

/**
 * Marker di identità nel contenuto del template (commento HTML: sopravvive
 * all'editor). Il prefisso identifica il template orbitale anche se l'admin
 * lo rinomina; la variante "v2" fa da guardia one-shot della sincronizzazione:
 * una volta portato a v2, il template non viene mai più sovrascritto.
 */
export const ORBITAL_TEMPLATE_MARKER_PREFIX = "<!-- ORBITAL-TEMPLATE";
export const ORBITAL_TEMPLATE_V2_MARKER = "<!-- ORBITAL-TEMPLATE v2 -->";

/**
 * Nomi con cui il template orbitale esiste nei DB già installati (seed
 * storico + rinomina fatta dall'admin sull'installazione in uso). Servono a
 * riconoscere i template v1, che non hanno ancora il marker nel contenuto.
 */
export const ORBITAL_LEGACY_TEMPLATE_NAMES = [
  ORBITAL_TEMPLATE_NAME,
  "Orbitale Modulo Standard",
];

/**
 * Le 6 sezioni modulari del contratto v2: 5 pacchetti cumulativi + FAQ.
 * I blocchi generati seguono l'ordine dei file sorgente 01..06:
 * indici 0..4 = pacchetti 1..5, indice 5 = FAQ.
 */
export function getOrbitalServicePackages(): ModularSection[] {
  return ORBITAL_PACKAGE_BLOCKS_V2.map((block, index) => {
    const pkg = index < ORBITAL_PACKAGES.length ? ORBITAL_PACKAGES[index] : null;
    return {
      id: pkg ? pkg.sectionId : ORBITAL_FAQ_SECTION_ID,
      title: block.title,
      description: block.description,
      content: block.content,
      // Solo il BASE è attivo di default ed è sempre incluso: ogni contratto
      // orbitale parte almeno dal pacchetto BASE. FAQ e pacchetti superiori
      // si aggiungono dalla selezione (cumulativa) nel form contratto.
      defaultEnabled: pkg?.num === 1,
      required: pkg?.num === 1,
      order: index + 1,
    };
  });
}

/** Corpo del contratto v2 con lo slot <!-- BLOCK:SECTIONS --> vuoto (contenuto del template nel DB). */
export function getOrbitalContractEmptyHtml(): string {
  return `${ORBITAL_TEMPLATE_V2_MARKER}\n${ORBITAL_CONTRACT_BODY_V2}`;
}

/** Corpo del contratto v2 con tutti i blocchi pacchetto già inseriti (anteprima "versione completa" nell'editor). */
export function getOrbitalContractFullHtml(): string {
  const inline = getOrbitalServicePackages()
    .map(
      (section) =>
        `<h3 style="font-size: 16px; font-weight: bold; color: #1e293b; margin: 20px 0 4px 0;">${section.title}</h3>\n${section.content}`,
    )
    .join("\n\n");
  return getOrbitalContractEmptyHtml().replace(SECTIONS_MARKER, inline);
}
