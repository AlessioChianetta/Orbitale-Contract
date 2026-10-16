/**
 * Regola del proprietario: pagina di firma del cliente e PDF devono essere
 * sempre identici. Questi test controllano che entrambi usino lo stesso
 * documento e che nessuno dei due ricostruisca il contratto per conto suo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderContractDocument, SIGNATURE_SLOT_ATTR, type ContractDocumentInput } from "../shared/contract-document";

const input: ContractDocumentInput = {
  company: { companyName: "Azienda Srl", address: "Via Roma 1", postalCode: "00100", city: "Roma", taxId: "12345678901", uniqueCode: "ABC1234", pec: "a@pec.it" },
  client: {
    societa: "Cliente <b>Spa</b>", cliente_nome: "Mario Rossi", data_nascita: "1980-05-02", email: "m@r.it",
    rata_list: [{ rata_importo: "1.000,50", rata_scadenza: "2026-11-01" }, { rata_importo: "500", rata_scadenza: "2026-12-01" }],
    bonus_list: [{ bonus_descrizione: "Consulenza extra" }],
  },
  template: { name: "Contratto servizi", content: "<p>Articolo 1</p><script>alert(1)</script>", customContent: "<p>Nota</p>", paymentText: "<p>Bonifico</p>", predefinedBonuses: [{ description: "Sconto", value: 10, type: "percentage" }] },
  contract: { id: 7, status: "signed", signedAt: "2026-10-16T10:00:00Z", contractStartDate: "2026-10-16", renewalDuration: 12 },
};
const signature = "data:image/png;base64,AAAA";

test("pagina cliente (firmata) e PDF producono lo stesso HTML", () => {
  const pdf = renderContractDocument(input, { mode: "pdf", signature });
  const page = renderContractDocument(input, { mode: "sign", signature });
  assert.equal(page.html, pdf.html);
  assert.deepEqual(page.sections, pdf.sections);
});

test("prima della firma la pagina cliente differisce dal PDF solo per l'area firma", () => {
  const pdf = renderContractDocument(input, { mode: "pdf", signature: null });
  const page = renderContractDocument(input, { mode: "sign", signature: null });
  assert.ok(page.html.includes(SIGNATURE_SLOT_ATTR));
  assert.equal(page.html.replace(` ${SIGNATURE_SLOT_ATTR}`, ""), pdf.html);
});

test("contenuti: valori neutralizzati, script rimossi, importi europei, bonus del template", () => {
  const { html, sections } = renderContractDocument(input, { mode: "pdf", signature });
  assert.ok(html.includes("Cliente &lt;b&gt;Spa&lt;/b&gt;"));
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("1500.50"));
  assert.ok(html.includes("01/11/2026"));
  assert.ok(html.includes("02/05/1980"));
  assert.ok(html.includes("Sconto (10%)") && html.includes("Consulenza extra"));
  assert.deepEqual(sections.map((s) => s.id), [
    "intestazione", "dati-cliente", "contenuto-personalizzato", "piano-pagamenti",
    "condizioni-pagamento", "corpo-contratto", "bonus", "validita", "autorinnovo", "firma",
  ]);
});

test("nessuna copia del documento fuori dal modulo condiviso", () => {
  const pdfSrc = readFileSync("server/services/pdf-generator-new.ts", "utf8");
  const pageSrc = readFileSync("client/src/components/professional-contract-document.tsx", "utf8");
  for (const src of [pdfSrc, pageSrc]) {
    assert.ok(src.includes("renderContractDocument("), "deve usare shared/contract-document");
    assert.ok(!src.includes("Clausola di autorinnovo") && !src.includes("CLAUSOLA DI AUTORINNOVO"), "testo del documento duplicato");
    assert.ok(!src.includes("tacitamente rinnovato"), "testo del documento duplicato");
  }
});
