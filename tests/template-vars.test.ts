// Variabili libere dei template ({{var_*}}): elenco campi ed escaping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listTemplateVars, templateVarReplacements } from "../shared/template-vars";

test("elenco: prima le dichiarate (con etichetta e tipo), poi le altre; ignorate le dichiarate non usate", () => {
  const html = [
    "<!-- VAR var_mercati | Mercati e attività | testo lungo | Uno per riga -->",
    "<!-- VAR var_non_usata | Mai usata -->",
    "<p>{{ var_settore_azienda }} {{var_mercati}} {{societa}} {{var_mercati}}</p>",
  ].join("\n");
  assert.deepEqual(listTemplateVars(html), [
    { key: "var_mercati", label: "Mercati e attività", multiline: true, hint: "Uno per riga" },
    { key: "var_settore_azienda", label: "Settore azienda", multiline: false },
  ]);
  assert.deepEqual(listTemplateVars(null, undefined, ""), []);
});

test("sostituzioni: HTML neutralizzato, a capo in <br>, vuoti e chiavi estranee scartati", () => {
  assert.deepEqual(
    templateVarReplacements({
      var_mercati: "UAE\r\nUK <b>",
      var_vuota: "   ",
      societa: "non è una var_",
      "var_x}}": "chiave non valida",
      var_numero: 3,
      var_oggetto: { a: 1 },
    }),
    { var_mercati: "UAE<br>UK &lt;b&gt;", var_numero: "3" },
  );
  assert.deepEqual(templateVarReplacements(null), {});
  assert.deepEqual(templateVarReplacements(["var_a"]), {});
});
