// Metadati del template "Contratto Procacciatore d'Affari".
// Speculare a orbital-template.ts: nome canonico, marker di riconoscimento
// nel contenuto e getter dell'HTML completo per il seed idempotente.

import { PROCACCIATORE_CONTRACT_BODY } from "./procacciatore-contract-content";

export const PROCACCIATORE_TEMPLATE_NAME = "Contratto Procacciatore d'Affari";

export const PROCACCIATORE_TEMPLATE_DESCRIPTION =
  "Contratto di procacciamento d'affari per l'ingresso nel team commerciale: " +
  "oggetto, provvigioni, coda provvigionale, obblighi di condotta e protezione legale (20 articoli).";

// Marker nel contenuto: permette di riconoscere il template anche se
// l'admin lo rinomina. Prefisso stabile + versione per eventuali sync futuri.
export const PROCACCIATORE_TEMPLATE_MARKER_PREFIX = "<!-- PROCACCIATORE-TEMPLATE";
export const PROCACCIATORE_TEMPLATE_V1_MARKER = "<!-- PROCACCIATORE-TEMPLATE v1 -->";
// v2: premessa con anagrafica estesa del procacciatore (luogo/data di nascita,
// codice fiscale, residenza). Il marker fa da guardia one-shot per il sync.
export const PROCACCIATORE_TEMPLATE_V2_MARKER = "<!-- PROCACCIATORE-TEMPLATE v2 -->";

export function getProcacciatoreContractHtml(): string {
  return `${PROCACCIATORE_TEMPLATE_V2_MARKER}\n${PROCACCIATORE_CONTRACT_BODY}`;
}
