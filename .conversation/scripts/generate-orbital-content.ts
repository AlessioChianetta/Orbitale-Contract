/**
 * Genera shared/orbital-contract-content.ts a partire dai file HTML del
 * contratto cliente "Sistema Orbitale" v2 presenti in attached_assets/:
 *   - corpo completo del contratto (PREMESSE → Articolo 22, con slot
 *     <!-- BLOCK:SECTIONS --> per i pacchetti e blocco BONUS_LIST);
 *   - 6 blocchi modulari: 5 pacchetti cumulativi (01-BASE … 05-FULL) + 06-FAQ.
 *
 * Da ogni blocco estrae:
 *   - title: testo dell'<h3> iniziale (es. "PACCHETTO 1 — BASE (Livello 3)");
 *   - description: testo del sottotitolo in corsivo;
 *   - content: tutto il resto (sottotitolo + card), senza l'<h3> perché
 *     renderSectionsHtml() emette già il titolo della sezione.
 *
 * Uso: npx tsx scripts/generate-orbital-content.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ASSETS = path.join(ROOT, "attached_assets");
const OUT = path.join(ROOT, "shared", "orbital-contract-content.ts");

const BODY_FILE = "CONTRATTO-CLIENTE-SISTEMA-ORBITALE_(1)_1785080987979.html";
const BLOCK_FILES = [
  "01-BASE_1785080987980.html",
  "02-SOCIAL_1785080987980.html",
  "03-SETTER_1785080987980.html",
  "04-GROWTH_1785080987981.html",
  "05-FULL_1785080987978.html",
  "06-FAQ_1785080987979.html",
];

function read(file: string): string {
  return readFileSync(path.join(ASSETS, file), "utf8").replace(/\r\n/g, "\n").trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

const body = read(BODY_FILE);
if (!body.includes("<!-- BLOCK:SECTIONS -->")) {
  throw new Error(`${BODY_FILE}: marker <!-- BLOCK:SECTIONS --> mancante`);
}
if (!body.includes("<!-- BLOCK:BONUS_LIST -->")) {
  throw new Error(`${BODY_FILE}: marker <!-- BLOCK:BONUS_LIST --> mancante`);
}

const blocks = BLOCK_FILES.map((file) => {
  const raw = read(file);
  const h3 = raw.match(/^<h3[^>]*>([\s\S]*?)<\/h3>\s*/);
  if (!h3) throw new Error(`${file}: <h3> iniziale non trovato`);
  const title = stripTags(h3[1]);
  const content = raw.slice(h3[0].length).trim();
  const subtitle = content.match(/^<p[^>]*font-style:\s*italic[^>]*>([\s\S]*?)<\/p>/);
  const description = subtitle ? stripTags(subtitle[1]) : "";
  if (!title || !content) throw new Error(`${file}: blocco vuoto dopo il parsing`);
  return { file, title, description, content };
});

if (blocks.length !== 6) {
  throw new Error(`attesi 6 blocchi (5 pacchetti + FAQ), trovati ${blocks.length}`);
}

let out = "";
out += "// AUTO-GENERATO da scripts/generate-orbital-content.ts — NON modificare a mano.\n";
out += `// Fonte: attached_assets/${BODY_FILE} + blocchi 01-06 (contratto cliente v2, luglio 2026).\n`;
out += "// Per rigenerare: npx tsx scripts/generate-orbital-content.ts\n\n";
out += "/** Corpo completo del contratto v2 (PREMESSE → Art. 22), con slot <!-- BLOCK:SECTIONS --> vuoto. */\n";
out += `export const ORBITAL_CONTRACT_BODY_V2 = ${JSON.stringify(body)};\n\n`;
out += "export interface OrbitalPackageBlock {\n";
out += "  /** File sorgente in attached_assets (documentazione provenienza). */\n";
out += "  sourceFile: string;\n";
out += "  /** Titolo della sezione, es. \"PACCHETTO 1 — BASE (Livello 3)\". */\n";
out += "  title: string;\n";
out += "  /** Sottotitolo in corsivo del blocco (testo semplice). */\n";
out += "  description: string;\n";
out += "  /** HTML del blocco senza l'<h3> iniziale (il titolo lo emette renderSectionsHtml). */\n";
out += "  content: string;\n";
out += "}\n\n";
out += "/** Blocchi nell'ordine dei file 01..06: indici 0-4 = pacchetti 1-5, indice 5 = FAQ. */\n";
out += "export const ORBITAL_PACKAGE_BLOCKS_V2: OrbitalPackageBlock[] = [\n";
for (const b of blocks) {
  out += "  {\n";
  out += `    sourceFile: ${JSON.stringify(b.file)},\n`;
  out += `    title: ${JSON.stringify(b.title)},\n`;
  out += `    description: ${JSON.stringify(b.description)},\n`;
  out += `    content: ${JSON.stringify(b.content)},\n`;
  out += "  },\n";
}
out += "];\n";

writeFileSync(OUT, out);
console.log(`OK: ${path.relative(ROOT, OUT)}`);
console.log(`  body: ${body.length} caratteri`);
for (const b of blocks) console.log(`  ${b.file} → "${b.title}" (${b.content.length} car.)`);
