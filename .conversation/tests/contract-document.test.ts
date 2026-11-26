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
  contract: { id: 7, status: "signed", signedAt: "2026-10-16T10:00:00Z", contractStartDate: "2026-10-16", renewalDuration: 12, autoRenewal: true },
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

// ---------------------------------------------------------------- Fase B

const privato = {
  tipo_cliente: "privato", societa: "Giulia Bianchi", p_iva: "BNCGLI85M41H501Z", nato_a: "Roma",
  data_nascita: "1985-08-01", indirizzo_residenza: "Via Verdi 3", residente_a: "Torino", provincia_residenza: "TO",
  email: "g@b.it", cellulare: "+39 333 0000000",
  rata_list: [{ rata_importo: "80", rata_scadenza: "2026-11-01" }],
};

test("cliente privato: dati della persona, niente società/REA/legale rappresentante", () => {
  const { html } = renderContractDocument({ ...input, client: privato, contract: { id: 9, contractStartDate: "2026-10-20" } }, { mode: "pdf" });
  assert.ok(html.includes("Dati del cliente</h2>"));
  assert.ok(html.includes("Nome e cognome") && html.includes("Giulia Bianchi"));
  assert.ok(html.includes("BNCGLI85M41H501Z") && html.includes("01/08/1985"));
  assert.ok(html.includes("Via Verdi 3, Torino (TO)"));
  assert.ok(!html.includes("legale rappresentante") && !html.includes("REA") && !html.includes("Codice univoco</div>"));
  assert.ok(html.includes("Firma del Cliente<") && !html.includes("Committente"));
});

test("impaginazione storica (1): invariata per i contratti già esistenti", () => {
  const legacyContract = { id: 9, documentLayout: 1, autoRenewal: false, contractStartDate: "2026-10-20" };
  const { html, sections } = renderContractDocument(
    { ...input, company: { ...input.company, priceVatMode: "none" }, client: privato, contract: legacyContract }, { mode: "pdf" });
  assert.ok(html.includes("Dati del cliente / committente"), "privato reso come allora");
  assert.ok(sections.some((s) => s.id === "autorinnovo"), "autorinnovo sempre stampato come allora");
  assert.ok(html.includes("80.00 EUR + IVA"), "+ IVA fisso come allora");
});

test("autorinnovo stampato solo se attivo sul contratto", () => {
  const off = renderContractDocument({ ...input, contract: { ...input.contract, autoRenewal: false } }, { mode: "pdf" });
  assert.ok(!off.sections.some((s) => s.id === "autorinnovo"));
  assert.ok(!off.html.includes("tacitamente rinnovato"));
  const on = renderContractDocument(input, { mode: "pdf" });
  assert.ok(on.html.includes("tacitamente rinnovato"));
});

test("dicitura IVA dalle impostazioni azienda", () => {
  const r = (priceVatMode?: string) =>
    renderContractDocument({ ...input, company: { ...input.company, priceVatMode } }, { mode: "pdf" }).html;
  assert.ok(r(undefined).includes("1500.50 EUR + IVA"));
  assert.ok(r("vat_included").includes("1500.50 EUR IVA inclusa"));
  const none = r("none");
  assert.ok(none.includes("1500.50 EUR</strong>") && none.includes("Importo (EUR)") && !none.includes("+ IVA"));
});

test("numero contratto per azienda, id per i contratti storici", () => {
  const withNumber = renderContractDocument({ ...input, contract: { ...input.contract, contractNumber: "2026-0003" } }, { mode: "pdf" }).html;
  assert.ok(withNumber.includes("Contratto n. 2026-0003"));
  assert.ok(renderContractDocument(input, { mode: "pdf" }).html.includes("Contratto n. 7"));
});

test("partnership: testo ristorazione solo per l'azienda proprietaria", () => {
  const contract = { ...input.contract, isPercentagePartnership: true, partnershipPercentage: 10 };
  const other = renderContractDocument({ ...input, contract }, { mode: "pdf" }).html;
  assert.ok(!other.includes("cibo e bevande") && other.includes("10% del fatturato"));
  const owner = renderContractDocument({ ...input, company: { ...input.company, isOwner: true }, contract }, { mode: "pdf" }).html;
  assert.ok(owner.includes("cibo e bevande"));
});

test("approvazione specifica (artt. 1341-1342): sezione e seconda firma solo se il testo la prevede", async () => {
  const { APPROVAL_SIGNATURE_SLOT_ATTR, requiresSpecificApproval } = await import("../shared/contract-document");
  // Testo senza blocco: nessuna sezione in più (i contratti esistenti restano identici).
  const plain = renderContractDocument(input, { mode: "pdf", signature });
  assert.ok(!plain.html.includes("approvazione-clausole"));
  assert.equal(requiresSpecificApproval(input.template.content), false);

  const content = "<p>Articolo 1</p><!-- APPROVAZIONE_SPECIFICA --><p>Approvo 4.7 e 9.3</p><!-- /APPROVAZIONE_SPECIFICA --><p>Allegato</p>";
  const withApproval: ContractDocumentInput = { ...input, contract: { ...input.contract, status: "sent", signedAt: null }, template: { ...input.template, content } };
  assert.equal(requiresSpecificApproval(content), true);

  const page = renderContractDocument(withApproval, { mode: "sign", signature: null });
  assert.ok(page.html.includes('data-section="approvazione-clausole"'));
  assert.ok(page.html.includes(APPROVAL_SIGNATURE_SLOT_ATTR), "area per la seconda firma");
  const body = page.html.split('data-section="approvazione-clausole"')[0];
  assert.ok(!body.includes("Approvo 4.7"), "il blocco non resta nel corpo del contratto");
  assert.ok(body.includes("Allegato"));

  const signedInput: ContractDocumentInput = { ...withApproval, contract: { ...withApproval.contract, status: "signed", signedAt: "2026-10-16T10:00:00Z" } };
  const second = "data:image/png;base64,BBBB";
  const pdf = renderContractDocument(signedInput, { mode: "pdf", signature, approvalSignature: second });
  const signedPage = renderContractDocument(signedInput, { mode: "sign", signature, approvalSignature: second });
  assert.equal(signedPage.html, pdf.html, "dopo la firma pagina e PDF coincidono");
  assert.ok(pdf.html.includes(second));
  assert.ok(!pdf.html.includes(APPROVAL_SIGNATURE_SLOT_ATTR));
});

test("date delle rate già in formato italiano (gg/mm/aaaa): stampate così come sono", async () => {
  const { formatShortDate } = await import("../shared/contract-document");
  assert.equal(formatShortDate("07/04/2026"), "07/04/2026", "non va letta come 4 luglio");
  assert.equal(formatShortDate("2026-04-07"), "07/04/2026");
  const doc = renderContractDocument({ ...input, client: { ...input.client, rata_list: [], payment_plan: [{ rata_importo: "500.00", rata_scadenza: "01/11/2026" }] } }, { mode: "pdf", signature });
  assert.ok(doc.html.includes("<td>01/11/2026</td>"));
});

test("C.F. e P.I.: separati dall'impaginazione 3, invariati per i contratti 1 e 2", () => {
  const company = { ...input.company, taxId: "VGLLVR92L45I234X", vatId: "04549600619" };
  const r = (documentLayout: number | null) =>
    renderContractDocument({ ...input, company, contract: { ...input.contract, documentLayout } }, { mode: "pdf" }).html;
  for (const html of [r(3), r(null)]) {
    assert.ok(html.includes("<div>C.F. VGLLVR92L45I234X</div><div>P.I. 04549600619</div>"));
    assert.ok(!html.includes("C.F. e P.I."));
  }
  for (const html of [r(1), r(2)]) {
    assert.ok(html.includes("<div>C.F. e P.I. VGLLVR92L45I234X</div>"), "come già mostrato/firmato");
    assert.ok(!html.includes("04549600619"));
  }
  // Stesso numero (società): una riga sola, come prima.
  const same = renderContractDocument({ ...input, company: { ...company, taxId: "04549600619" } }, { mode: "pdf" }).html;
  assert.ok(same.includes("<div>C.F. e P.I. 04549600619</div>"));
});
