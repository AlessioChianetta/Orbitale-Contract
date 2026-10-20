import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { AuditLog } from '@shared/schema';
import { renderContractDocument, CONTRACT_DOCUMENT_CSS, contractDisplayNumber } from '@shared/contract-document';
import { renderAuditTrailHtml, escapeHtml } from './audit-trail';

// Singleton Puppeteer browser: launch once, reuse across PDF generations.
// Auto-resets if the underlying process dies or disconnects.
let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

function resolveChromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  try {
    const p = puppeteer.executablePath();
    if (p && existsSync(p)) return p;
  } catch {
    // ignore and fall back to system chromium
  }
  for (const cmd of ['chromium', 'chromium-browser', 'google-chrome', 'chrome']) {
    try {
      const resolved = execSync(`command -v ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      if (resolved && existsSync(resolved)) return resolved;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }
  const executablePath = resolveChromiumPath();
  if (!executablePath) {
    throw new Error(
      'Chromium executable not found. Set CHROMIUM_PATH env var or install Puppeteer with a bundled Chromium.'
    );
  }
  browserLaunchPromise = puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }).then(b => {
    b.on('disconnected', () => {
      if (browserInstance === b) browserInstance = null;
    });
    browserInstance = b;
    browserLaunchPromise = null;
    return b;
  }).catch(err => {
    browserLaunchPromise = null;
    throw err;
  });
  return browserLaunchPromise;
}

// Font Inter incorporato nel PDF (base64): niente download da Google Fonts a
// runtime, quindi lo stesso carattere su ogni server e anche offline.
let embeddedFontCss: string | null = null;
function getEmbeddedFontCss(): string {
  if (embeddedFontCss !== null) return embeddedFontCss;
  const dir = path.join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files');
  const faces: string[] = [];
  for (const weight of [400, 500, 600, 700]) {
    const file = path.join(dir, `inter-latin-${weight}-normal.woff2`);
    if (!existsSync(file)) continue;
    const b64 = readFileSync(file).toString('base64');
    faces.push(`@font-face { font-family: 'Inter'; font-style: normal; font-weight: ${weight}; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`);
  }
  if (faces.length === 0) {
    console.warn('[PDF] Font Inter non trovato in node_modules/@fontsource/inter: uso il font di sistema.');
  }
  embeddedFontCss = faces.join('\n');
  return embeddedFontCss;
}

// Piè di pagina su ogni pagina: azienda e numero contratto a sinistra,
// "Pagina X di Y" a destra. Il piè di pagina di Chromium è un documento a
// parte: il font va incorporato di nuovo (solo il peso regolare).
let footerFontCss: string | null = null;
function buildFooterTemplate(left: string): string {
  if (footerFontCss === null) {
    const file = path.join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files', 'inter-latin-400-normal.woff2');
    footerFontCss = existsSync(file)
      ? `@font-face { font-family: 'Inter'; font-weight: 400; src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2'); }`
      : '';
  }
  return `<style>${footerFontCss}</style>
    <div style="width: 100%; margin: 0 18mm; padding-top: 6px; border-top: 0.5pt solid #d2d2d7;
                display: flex; justify-content: space-between; font-family: 'Inter', Arial, sans-serif;
                font-size: 7pt; color: #86868b; -webkit-print-color-adjust: exact;">
      <span>${escapeHtml(left)}</span>
      <span>Pagina <span class="pageNumber"></span> di <span class="totalPages"></span></span>
    </div>`;
}

export async function closePdfBrowser(): Promise<void> {
  if (browserInstance) {
    const b = browserInstance;
    browserInstance = null;
    try { await b.close(); } catch { /* noop */ }
  }
}

export async function generatePDF(
  contractId: number, 
  htmlContent: string, 
  auditLogs?: AuditLog[],
  contractData?: any,
  companySettings?: any
): Promise<string> {
  const pdf = await renderPdf(contractId, htmlContent, auditLogs, contractData, companySettings);

  const outputDir = path.join(process.cwd(), 'generated-pdfs');
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `contract-${contractId}-${Date.now()}.pdf`);
  await fs.writeFile(filePath, pdf);
  return filePath;
}

/**
 * PDF di ANTEPRIMA (contratto non ancora creato): stesso documento del PDF
 * firmato, restituito in memoria e mai scritto su disco. Il piè di pagina
 * dichiara che non è un contratto firmato.
 */
export async function generatePreviewPDF(contractData: any, companySettings: any): Promise<Buffer> {
  return renderPdf(0, contractData.generatedContent || '', undefined, contractData, companySettings, true);
}

// Con `--single-process` Chromium a volte perde la pagina ("Navigating frame
// was detached"): succede, per esempio, generando un PDF con immagini (firma
// disegnata) dopo uno senza immagini, come per un'azienda senza logo
// (anteprima → firma). In quel caso si riavvia il browser e si riprova una volta.
const BROWSER_LOST_RE = /detached|Target closed|Session closed|Connection closed|Protocol error/i;

async function renderPdf(...args: Parameters<typeof renderPdfOnce>): Promise<Buffer> {
  try {
    return await renderPdfOnce(...args);
  } catch (err: any) {
    if (!BROWSER_LOST_RE.test(String(err?.message || err))) throw err;
    console.warn(`[PDF] Browser perso (${err?.message || err}): riavvio e nuovo tentativo.`);
    await closePdfBrowser();
    return renderPdfOnce(...args);
  }
}

async function renderPdfOnce(
  contractId: number,
  htmlContent: string,
  auditLogs: AuditLog[] | undefined,
  contractData: any,
  companySettings: any,
  isPreview = false,
): Promise<Buffer> {
  if (contractData && !companySettings) {
    // Mai stampare dati aziendali di riserva su un documento legale.
    throw new Error(`Impostazioni azienda mancanti: impossibile generare il PDF del contratto ${contractId}.`);
  }
  const browser = await getBrowser();
  let page: Awaited<ReturnType<Browser['newPage']>> | undefined;

  try {
    page = await browser.newPage();

    const operatorNames = auditLogs && auditLogs.length ? await resolveOperatorNames(auditLogs) : {};
    // Un unico documento HTML valido: il registro va dentro il <body>.
    const fullHtml = contractData ?
      generateClientViewIdenticalHtml(
        contractData,
        companySettings,
        auditLogs && auditLogs.length ? generateAuditTrailHtml(auditLogs, contractData, operatorNames) : ''
      ) :
      `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Contratto ${contractId}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              margin: 40px;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
          ${auditLogs && auditLogs.length ? generateAuditTrailHtml(auditLogs, { id: contractId }, operatorNames) : ''}
        </body>
        </html>
      `;

    await page.setViewport({ width: 1200, height: 1600 });
    await page.setContent(fullHtml, { waitUntil: ['networkidle0', 'domcontentloaded'] });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    const contractLabel = isPreview
      ? 'Anteprima — documento non firmato'
      : `Contratto n. ${contractDisplayNumber({ contractNumber: contractData?.contractNumber, id: contractId })}`;
    const footerLeft = contractData
      ? [companySettings?.companyName, contractLabel].filter(Boolean).join('  ·  ')
      : contractLabel;
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: buildFooterTemplate(footerLeft),
      scale: 1
    });

    return Buffer.from(pdf);
  } finally {
    if (page) {
      try { await page.close(); } catch { /* noop */ }
    }
  }
}

/**
 * HTML del PDF. Il documento è generato da `shared/contract-document.ts`, lo
 * stesso modulo usato dalla pagina di firma del cliente: pagina e PDF sono
 * sempre identici. Qui si aggiungono solo il font incorporato e l'allegato
 * "Registro delle operazioni".
 */
function generateClientViewIdenticalHtml(contractData: any, companySettings: any, appendixHtml = ''): string {
  const isSigned = contractData.status === 'signed' || contractData.status === 'completed';
  const { html } = renderContractDocument(
    {
      company: companySettings || {},
      client: contractData.clientData || {},
      template: contractData.template || {},
      contract: {
        id: contractData.id,
        contractNumber: contractData.contractNumber ?? null,
        documentLayout: contractData.documentLayout ?? null,
        autoRenewal: contractData.autoRenewal ?? null,
        status: contractData.status,
        createdAt: contractData.createdAt,
        signedAt: contractData.signedAt,
        contractStartDate: contractData.contractStartDate,
        contractEndDate: contractData.contractEndDate,
        isPercentagePartnership: contractData.isPercentagePartnership,
        partnershipPercentage: contractData.partnershipPercentage,
        renewalDuration: contractData.renewalDuration,
        regenerationNotice: contractData.regenerationNotice || null,
      },
    },
    {
      mode: 'pdf',
      signature: isSigned ? (contractData.signatures?.marketing || null) : null,
      approvalSignature: isSigned ? (contractData.signatures?.clausole || null) : null,
    },
  );

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>${contractData.id ? `Contratto ${escapeHtml(contractDisplayNumber(contractData))}` : 'Anteprima contratto'}</title>
  <style>
    ${getEmbeddedFontCss()}
    @page { size: A4; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 9.6pt; line-height: 1.55; color: #424245;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ${CONTRACT_DOCUMENT_CSS}
  </style>
</head>
<body>
  ${html}
  ${appendixHtml}
</body>
</html>`;
}


/** Nomi degli operatori citati nei log (es. chi ha inviato il contratto). */
async function resolveOperatorNames(auditLogs: AuditLog[]): Promise<Record<number, string>> {
  const ids = new Set<number>();
  for (const l of auditLogs) {
    const m = (l.metadata as Record<string, any>) || {};
    for (const k of ['sentBy', 'regeneratedBy', 'editedBy']) {
      const n = typeof m[k] === 'number' ? m[k] : parseInt(String(m[k] ?? ''), 10);
      if (Number.isFinite(n)) ids.add(n);
    }
  }
  if (ids.size === 0) return {};
  const names: Record<number, string> = {};
  try {
    const { storage } = await import('../storage');
    for (const id of Array.from(ids)) {
      const u: any = await storage.getUser(id).catch(() => undefined);
      if (u) names[id] = u.fullName ? `${u.fullName}${u.email ? ` (${u.email})` : ''}` : (u.email || u.username || '');
    }
  } catch (err) {
    console.warn('[PDF] Impossibile risolvere i nomi degli operatori per il registro:', (err as any)?.message || err);
  }
  return names;
}

function generateAuditTrailHtml(auditLogs: AuditLog[], contractData?: any, userNames: Record<number, string> = {}): string {
  return renderAuditTrailHtml(auditLogs as any, {
    contractId: contractData?.id != null
      ? contractDisplayNumber(contractData)
      : (auditLogs[0]?.contractId ?? ''),
    docType: contractData?.template?.name || contractData?.templateName,
    status: contractData?.status,
    signedAt: contractData?.signedAt,
    regenerationNotice: contractData?.regenerationNotice || null,
    userNames,
  });
}
