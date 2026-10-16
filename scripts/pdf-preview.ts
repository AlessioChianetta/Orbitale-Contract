/**
 * Anteprima del PDF di un contratto esistente, per controllare la grafica.
 * Sola lettura: non modifica il contratto né il suo PDF.
 * Uso: `npx tsx scripts/pdf-preview.ts <id-contratto> [id-azienda, default 1]`
 * Il file va in generated-artifacts/anteprima-contratto-<id>.pdf
 */
import fs from "fs";
import path from "path";
import { storage } from "../server/storage";
import { generatePDF, closePdfBrowser } from "../server/services/pdf-generator-new";

async function main() {
  const id = parseInt(process.argv[2] || "", 10);
  if (!Number.isFinite(id)) throw new Error("Indica l'id del contratto: npx tsx scripts/pdf-preview.ts 103");
  const companyId = parseInt(process.argv[3] || "1", 10);
  const contract = await storage.getContract(id, companyId);
  if (!contract) throw new Error(`Contratto ${id} non trovato nell'azienda ${companyId}`);
  const seller = { companyId };
  const template = await storage.getTemplate(contract.templateId, seller.companyId);
  const settings = await storage.getCompanySettings(seller.companyId);
  const logs = await storage.getContractAuditLogs(id);
  const data = {
    ...contract,
    templateName: template?.name || "Contratto",
    template: template ? { ...template, content: contract.generatedContent } : template,
    signatures: contract.signatures || {},
  };
  const out = path.join(process.cwd(), "generated-artifacts", `anteprima-contratto-${id}.pdf`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const p = await generatePDF(id, contract.generatedContent, logs, data, settings);
  fs.copyFileSync(p, out);
  fs.unlinkSync(p);
  console.log(`Anteprima: ${path.relative(process.cwd(), out)}`);
}

main()
  .then(async () => { await closePdfBrowser(); process.exit(0); })
  .catch(async (e) => { console.error(e?.message || e); await closePdfBrowser(); process.exit(1); });
