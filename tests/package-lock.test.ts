// Il package-lock deve funzionare anche fuori da Replit (VPS): nessun
// indirizzo del proxy interno di Replit, solo il registro pubblico npm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("package-lock: pacchetti scaricati solo dal registro pubblico npm", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const bad = Object.entries<any>(lock.packages || {})
    .filter(([, p]) => typeof p?.resolved === "string" && /^https?:/.test(p.resolved) && !p.resolved.startsWith("https://registry.npmjs.org/"))
    .map(([name, p]) => `${name}: ${p.resolved}`);
  assert.deepEqual(bad, [], "correggi con: sed -i 's#http://package-firewall.replit.internal/npm/#https://registry.npmjs.org/#g' package-lock.json");
});
