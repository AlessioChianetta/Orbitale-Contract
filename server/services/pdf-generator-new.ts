import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { AuditLog } from '@shared/schema';
import { formatDateItalian } from '@shared/procacciatore-fields';
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

// Safe date formatting function to avoid "Invalid Date" issues.
// Uses Europe/Rome timezone so CET/CEST is applied correctly in every season.
function formatDateSafe(dateString?: string | Date): string {
  if (!dateString) return '';
  try {
    // Stringhe YYYY-MM-DD (date-only) trattate come data locale italiana:
    // altrimenti `new Date("2026-04-16")` diventa mezzanotte UTC e in alcuni
    // contesti può slittare di un giorno. Usiamo un parser esplicito.
    if (typeof dateString === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
      if (m) {
        const [, y, mo, d] = m;
        const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                        'luglio','agosto','settembre','ottobre','novembre','dicembre'];
        return `${d} ${months[parseInt(mo, 10) - 1]} ${y}`;
      }
    }
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Rome'
    }).format(date);
  } catch {
    return '';
  }
}

// Format a short date (dd/mm/yyyy) in Europe/Rome timezone.
function formatShortDateItalian(dateInput?: string | Date): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Rome'
    }).format(date);
  } catch {
    return '';
  }
}

// Parse a date-only string (YYYY-MM-DD) as a *local* date to avoid the UTC-midnight
// bug that pushes the day back by one in positive UTC offsets.
function formatBirthDate(dateString?: string | Date): string {
  if (!dateString) return '';
  if (typeof dateString === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return formatShortDateItalian(dateString);
}

// Lightweight HTML sanitizer to neutralize trivial XSS vectors that might leak from
// user-authored template fields into the PDF renderer.
function sanitizeHtml(input?: string): string {
  if (!input) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export async function generatePDF(
  contractId: number, 
  htmlContent: string, 
  auditLogs?: AuditLog[],
  contractData?: any,
  companySettings?: any
): Promise<string> {
  const browser = await getBrowser();
  let page: Awaited<ReturnType<Browser['newPage']>> | undefined;

  try {
    page = await browser.newPage();

    if (contractData && !companySettings) {
      // Mai stampare dati aziendali di riserva su un documento legale.
      throw new Error(`Impostazioni azienda mancanti: impossibile generare il PDF del contratto ${contractId}.`);
    }
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

    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), 'generated-pdfs');
    await fs.mkdir(outputDir, { recursive: true });

    const fileName = `contract-${contractId}-${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);

    const footerLeft = contractData
      ? [companySettings?.companyName, `Contratto n. ${contractId}`].filter(Boolean).join('  ·  ')
      : `Contratto n. ${contractId}`;
    await page.pdf({
      path: filePath,
      format: 'A4',
      margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: buildFooterTemplate(footerLeft),
      scale: 1
    });

    return filePath;
  } finally {
    if (page) {
      try { await page.close(); } catch { /* noop */ }
    }
  }
}

function generateClientViewIdenticalHtml(contractData: any, companySettings: any, appendixHtml = ''): string {
  const client = contractData.clientData || {};

  // Contratto "procacciatore d'affari": la tabella anagrafica mostra i dati
  // del procacciatore invece di quelli del cliente/committente.
  const isProcacciatore =
    contractData.template?.recipientType === "procacciatore" ||
    (!!client.procacciatore_nome && !client.societa && !client.cliente_nome);

  const company = companySettings || {};
  const companyAddressLine = [
    company.address,
    company.postalCode ? `Cap ${company.postalCode}` : '',
    company.city,
  ].filter(Boolean).join(' ');

  let combinedBonusList = [];

  if (contractData.template?.predefinedBonuses && Array.isArray(contractData.template.predefinedBonuses)) {
    combinedBonusList = contractData.template.predefinedBonuses.map((bonus: any) => ({
      bonus_descrizione: bonus.description + (bonus.value ? ` (${bonus.value}${bonus.type === 'percentage' ? '%' : '€'})` : '')
    }));
  }

  if (client.bonus_list && Array.isArray(client.bonus_list)) {
    combinedBonusList = [...combinedBonusList, ...client.bonus_list];
  }

  const bonusList = combinedBonusList;
  // Priorità: usa rata_list se presente (rate personalizzate), altrimenti payment_plan (calcolo automatico)
  const usingCustomInstallments = client.rata_list && Array.isArray(client.rata_list) && client.rata_list.length > 0;
  const rawPaymentData = usingCustomInstallments ? client.rata_list : (client.payment_plan || []);

  // Normalizza il formato delle rate per la visualizzazione
  const paymentPlan = rawPaymentData.map((payment: any, index: number) => {
    // Format date if it's in YYYY-MM-DD format to DD/MM/YYYY
    let formattedDate = payment.rata_scadenza || payment.date || '';
    if (formattedDate && formattedDate.includes('-')) {
      const dateParts = formattedDate.split('-');
      if (dateParts.length === 3) {
        formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    }

    return {
      rata_numero: index + 1,
      rata_importo: payment.rata_importo || payment.amount || '0.00',
      rata_scadenza: formattedDate
    };
  });

  const isPartnership = contractData.isPercentagePartnership && contractData.partnershipPercentage;
  const hasPaymentPlan = paymentPlan.length > 0;
  const hasCustomContent = !!contractData.template?.customContent;
  const hasPaymentText = !!contractData.template?.paymentText;
  const hasContent = !!contractData.template?.content;
  const hasBonuses = bonusList.length > 0;
  const renewalDuration = contractData.renewalDuration || 12;
  const contractStartDate = contractData.contractStartDate || contractData.createdAt;
  const contractEndDate = contractData.contractEndDate;
  // Parse amounts that may come in European format ("1.234,56") or JS format ("1234.56").
  const parseAmount = (val: any): number => {
    const s = String(val ?? '0').trim();
    if (!s) return 0;
    const normalized = s.includes(',')
      ? s.replace(/\./g, '').replace(',', '.')
      : s;
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  };
  const totalAmount = paymentPlan
    .reduce((sum: number, payment: any) => sum + parseAmount(payment.rata_importo), 0)
    .toFixed(2);

  // Valori inseriti dal cliente/venditore: sempre neutralizzati.
  const e = (v: unknown) => escapeHtml(v ?? '');
  const field = (label: string, value: unknown, full = false) => {
    const v = value === undefined || value === null ? '' : String(value).trim();
    return `<td class="f${full ? ' f-full' : ''}"${full ? ' colspan="2"' : ''}>
      <div class="f-label">${e(label)}</div>
      <div class="f-value${v ? '' : ' f-empty'}">${v ? e(v) : '—'}</div>
    </td>`;
  };
  const signerName = isProcacciatore
    ? (client.procacciatore_nome || '')
    : (client.cliente_nome || client.societa || '');
  const isSigned = contractData.status === 'signed' || contractData.status === 'completed';
  const signatureValue: string | undefined = contractData.signatures?.marketing;

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="utf-8">
      <title>Contratto ${e(contractData.id)}</title>
      <style>
        ${getEmbeddedFontCss()}

        /* Stile del documento stampato: sobrio, neutro, molto spazio bianco.
           Il contenuto è lo stesso della pagina cliente; cambia solo la grafica. */
        :root {
          --ink: #1d1d1f;
          --ink-2: #424245;
          --muted: #6e6e73;
          --faint: #86868b;
          --line: #d2d2d7;
          --hair: #e8e8ed;
          --fill: #f5f5f7;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; }
        html, body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
          font-size: 9.6pt;
          line-height: 1.55;
          color: var(--ink-2);
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-feature-settings: "cv11", "ss01";
          counter-reset: sec;
        }
        * { orphans: 3; widows: 3; }
        strong, b { font-weight: 600; color: var(--ink); }

        /* Intestazione */
        .doc-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding-bottom: 18px; border-bottom: 0.75pt solid var(--line);
        }
        .doc-logo img { max-width: 140px; max-height: 56px; object-fit: contain; display: block; }
        .doc-wordmark { font-size: 15pt; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; line-height: 1.1; }
        .doc-company { text-align: right; font-size: 8pt; line-height: 1.55; color: var(--muted); }
        .doc-company .name { font-size: 9pt; font-weight: 600; color: var(--ink); margin-bottom: 2px; }

        /* Titolo */
        .doc-title { margin: 34px 0 30px 0; }
        .doc-eyebrow {
          font-size: 7.5pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--faint); margin-bottom: 6px;
        }
        .doc-title h1 { font-size: 24pt; font-weight: 700; color: var(--ink); letter-spacing: -0.025em; line-height: 1.15; }

        /* Sezioni numerate */
        .section-header {
          display: flex; align-items: baseline; gap: 10px;
          font-size: 12pt; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;
          margin: 30px 0 12px 0; padding-top: 14px; border-top: 0.75pt solid var(--hair);
          page-break-after: avoid; break-after: avoid;
        }
        .section-header::before {
          counter-increment: sec; content: counter(sec, decimal-leading-zero);
          font-size: 8pt; font-weight: 600; color: var(--faint); letter-spacing: 0.04em;
          font-variant-numeric: tabular-nums; min-width: 16px;
        }

        /* Dati anagrafici */
        .fields { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; }
        .fields td.f { width: 50%; vertical-align: top; padding: 8px 14px 8px 0; border-bottom: 0.75pt solid var(--hair); }
        .fields td.f + td.f { padding-left: 14px; }
        .fields tr:last-child td.f { border-bottom: none; }
        .f-label { font-size: 7pt; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); margin-bottom: 2px; }
        .f-value { font-size: 9.6pt; color: var(--ink); overflow-wrap: anywhere; }
        .f-value.f-empty { color: #c7c7cc; }
        .fields-note { font-size: 8.5pt; font-style: italic; color: var(--muted); padding: 10px 0 2px 0; }

        /* Testo libero del template */
        .template-content { font-size: 9.6pt; color: var(--ink-2); line-height: 1.6; }
        .template-content p { margin-bottom: 9px; }
        .template-content ul, .template-content ol { margin: 8px 0 10px 0; padding-left: 18px; }
        .template-content li { margin-bottom: 4px; }
        .template-content li::marker { color: var(--faint); }
        .template-content em { font-style: italic; }
        .template-content h1, .template-content h2, .template-content h3, .template-content h4 {
          color: var(--ink) !important; border: none !important; padding: 0 !important; background: none !important;
          letter-spacing: -0.01em; page-break-after: avoid; break-after: avoid;
        }
        .template-content h1 { font-size: 13pt !important; font-weight: 700 !important; margin: 22px 0 8px 0 !important; }
        .template-content h2 { font-size: 11pt !important; font-weight: 600 !important; margin: 20px 0 6px 0 !important; }
        .template-content h3, .template-content h4 { font-size: 10pt !important; font-weight: 600 !important; margin: 14px 0 4px 0 !important; }
        .template-content table { width: 100%; border-collapse: collapse; margin: 10px 0 14px 0 !important; font-size: 8.8pt !important; page-break-inside: avoid; }
        .template-content th, .template-content td {
          border-bottom: 0.75pt solid var(--hair) !important; padding: 6px 8px !important; text-align: left; vertical-align: top;
        }
        .template-content th { font-weight: 600; color: var(--ink); }
        .template-content tr { background: none !important; }
        .template-content tr:first-child > th, .template-content thead tr { background: var(--fill) !important; }
        /* I template hanno colori in linea (barre, sfumature, riquadri colorati):
           nel PDF diventano neutri, il testo resta invariato. */
        .template-content [style*="border-left"] { border-left: none !important; padding-left: 0 !important; }
        .template-content [style*="background"] {
          background: var(--fill) !important; border: none !important; border-radius: 8px !important;
        }
        .template-content tr[style*="background"], .template-content td[style*="background"] { border-radius: 0 !important; }
        .template-content [style*="gradient"] {
          font-size: 11pt !important; font-weight: 600 !important; text-align: left !important;
          padding: 12px 14px !important; margin: 18px 0 !important;
        }
        .template-content [style*="color"] { color: var(--ink) !important; }
        .template-content [style*="#64748b"], .template-content [style*="opacity"] { color: var(--muted) !important; opacity: 1 !important; }
        .template-content [style*="#64748b"] strong { color: var(--muted); }

        /* Riquadri del documento */
        .panel { background: var(--fill); border-radius: 10px; padding: 14px 16px; page-break-inside: avoid; }
        .panel p + p { margin-top: 8px; }
        .kv { width: 100%; border-collapse: collapse; }
        .kv td { padding: 6px 0; border-bottom: 0.75pt solid var(--hair); vertical-align: top; }
        .kv tr:last-child td { border-bottom: none; }
        .kv td.k { width: 38%; color: var(--muted); }
        .kv td.v { color: var(--ink); }

        /* Piano pagamenti */
        .lead { margin-bottom: 10px; color: var(--ink-2); }
        .pay { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; page-break-inside: avoid; }
        .pay th { font-size: 7pt; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint);
                  text-align: left; padding: 0 0 6px 0; border-bottom: 0.75pt solid var(--line); }
        .pay td { padding: 7px 0; border-bottom: 0.75pt solid var(--hair); color: var(--ink); }
        .pay .num { text-align: right; }
        .pay tfoot td { border-bottom: none; border-top: 0.75pt solid var(--line); font-weight: 600; padding-top: 8px; }
        .pay-note { font-size: 8pt; color: var(--muted); margin-top: 6px; }

        /* Bonus e dichiarazioni */
        .list { list-style: none; }
        .list li { position: relative; padding-left: 14px; margin-bottom: 6px; }
        .list li::before { content: ""; position: absolute; left: 2px; top: 0.62em; width: 4px; height: 4px; border-radius: 50%; background: var(--faint); }
        .bonus-label { font-weight: 600; color: var(--ink); margin-right: 4px; }

        /* Firma */
        .sign { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; margin-top: 34px; page-break-inside: avoid; }
        .sign-date .f-value { font-size: 10pt; }
        .sign-box { width: 58%; }
        .sign-area { height: 84px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 0.75pt solid var(--ink); padding-bottom: 6px; }
        .sign-area img { max-height: 76px; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; }
        .sign-area .sign-text { font-family: 'Brush Script MT', cursive; font-size: 26px; color: var(--ink); }
        .sign-caption { display: flex; justify-content: space-between; margin-top: 6px; font-size: 8pt; color: var(--muted); }
        .sign-caption .who { color: var(--ink); font-weight: 500; }

        .notice { margin-top: 28px; border: 0.75pt solid var(--line); border-radius: 10px; padding: 12px 14px; font-size: 8.5pt; color: var(--ink-2); page-break-inside: avoid; }
        .notice .notice-title { font-size: 7.5pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); margin-bottom: 4px; }
      </style>
    </head>
    <body>

      <!-- 1. INTESTAZIONE -->
      <header class="doc-header">
        <div class="doc-logo">
          ${company.logoUrl
            ? `<img src="${e(company.logoUrl)}" alt="${e(company.companyName || 'Logo')}" />`
            : `<div class="doc-wordmark">${e(company.companyName || '')}</div>`}
        </div>
        <div class="doc-company">
          ${company.logoUrl ? `<div class="name">${e(company.companyName || '')}</div>` : ''}
          ${companyAddressLine ? `<div>${e(companyAddressLine)}</div>` : ''}
          ${company.taxId ? `<div>C.F. e P.I. ${e(company.taxId)}</div>` : ''}
          ${company.uniqueCode ? `<div>Codice univoco ${e(company.uniqueCode)}</div>` : ''}
          ${company.pec ? `<div>PEC ${e(company.pec)}</div>` : ''}
        </div>
      </header>

      <div class="doc-title">
        <div class="doc-eyebrow">Contratto n. ${e(contractData.id)}</div>
        <h1>${e(contractData.template?.name || contractData.templateName || company.contractTitle || 'Contratto')}</h1>
      </div>

      <!-- 2. DATI CONTROPARTE (cliente/committente oppure procacciatore) -->
      ${isProcacciatore ? `
      <h2 class="section-header">Dati del procacciatore d'affari</h2>
      <table class="fields">
        <tr>${field('Nome / Ragione sociale', client.procacciatore_nome)}${field('P.IVA', client.procacciatore_piva)}</tr>
        <tr>${field('Codice fiscale', client.procacciatore_codice_fiscale)}${field('Nato/a a', [client.procacciatore_nato_a, client.procacciatore_data_nascita ? `il ${formatDateItalian(client.procacciatore_data_nascita)}` : ''].filter(Boolean).join(' '))}</tr>
        <tr>${field('Residenza', client.procacciatore_residenza, true)}</tr>
        <tr>${field('Sede / Domicilio fiscale', client.procacciatore_sede, true)}</tr>
        <tr>${field('Email', client.email)}${field('Cellulare', client.cellulare)}</tr>
        ${(client.procacciatore_pec || client.procacciatore_sdi) ? `<tr>${field('PEC', client.procacciatore_pec)}${field('Codice SDI', client.procacciatore_sdi)}</tr>` : ''}
        ${client.procacciatore_iban ? `<tr>${field('IBAN', client.procacciatore_iban, true)}</tr>` : ''}
      </table>
      ` : `
      <h2 class="section-header">Dati del cliente / committente</h2>
      <table class="fields">
        <tr>${field('Società', client.societa)}${field('Con sede in', client.sede)}</tr>
        <tr>${field('Indirizzo', client.indirizzo)}${field('Codice fiscale / P.IVA', client.p_iva)}</tr>
        <tr>${field('PEC', client.pec)}${field('Email', client.email)}</tr>
        <tr>${field('Cellulare', client.cellulare)}${field('Codice univoco', client.codice_univoco)}</tr>
        <tr>${field('Numero iscrizione al REA o al registro delle imprese', client.rea, true)}</tr>
      </table>
      <div class="fields-note">In persona del suo legale rappresentante p.t.</div>
      <table class="fields">
        <tr>${field('Signor/a', client.cliente_nome)}${field('Nato a', client.nato_a)}</tr>
        <tr>${field('Data di nascita', formatBirthDate(client.data_nascita))}${field('Residente a', client.residente_a)}</tr>
        <tr>${field('Indirizzo di residenza', client.indirizzo_residenza, true)}</tr>
      </table>
      `}

      <!-- 3. CONTENUTO PERSONALIZZATO -->
      ${hasCustomContent ? `
      <h2 class="section-header">Contenuto personalizzato</h2>
      <div class="template-content">
        ${sanitizeHtml(contractData.template.customContent)}
      </div>
      ` : ''}

      <!-- 4. PIANO PAGAMENTI -->
      ${isPartnership ? `
      <h2 class="section-header">Modello di partnership</h2>
      <div class="panel">
        <p class="lead"><strong>Percentuale: ${e(contractData.partnershipPercentage)}% sul fatturato TOTALE</strong></p>
        <p><strong>Definizione di fatturato totale.</strong> Per "fatturato TOTALE" si intende la somma di tutti i ricavi lordi generati dall'attività, comprensivi di:</p>
        <ul class="list" style="margin: 6px 0 10px 0;">
          <li>Vendite di cibo e bevande</li>
          <li>Servizi di catering e delivery</li>
          <li>Eventi privati e prenotazioni speciali</li>
          <li>Qualsiasi altro ricavo direttamente collegato all'attività</li>
        </ul>
        <p><strong>Modalità di calcolo e pagamento.</strong> Il pagamento della percentuale sarà calcolato mensilmente sul fatturato TOTALE del mese precedente e dovrà essere corrisposto entro il 15 del mese successivo tramite bonifico bancario.</p>
        <p><strong>Trasparenza e rendicontazione.</strong> Il Cliente si impegna a fornire mensilmente la documentazione contabile necessaria per il calcolo della percentuale dovuta, inclusi:</p>
        <ul class="list" style="margin: 6px 0 10px 0;">
          <li>Estratti conto del registratore di cassa o POS</li>
          <li>Fatture emesse nel periodo di riferimento</li>
          <li>Dichiarazioni IVA periodiche</li>
          <li>Report di fatturato certificati dal commercialista</li>
        </ul>
        <p><strong>Importante:</strong> questo modello di partnership sostituisce qualsiasi piano di pagamento fisso. Il compenso sarà calcolato esclusivamente come percentuale del fatturato totale.</p>
      </div>
      ` : hasPaymentPlan ? `
      <h2 class="section-header">Piano pagamenti</h2>
      <p class="lead">Il prezzo totale di <strong>${e(totalAmount)} EUR + IVA</strong> sarà corrisposto con le seguenti modalità:</p>
      <table class="pay">
        <thead><tr><th>Pagamento</th><th>Entro il</th><th class="num">Importo (EUR + IVA)</th></tr></thead>
        <tbody>
          ${paymentPlan.map((payment: any, index: number) => `
            <tr><td>${e(payment.rata_numero || index + 1)}</td><td>${e(payment.rata_scadenza)}</td><td class="num">${e(payment.rata_importo)}</td></tr>
          `).join('')}
        </tbody>
        <tfoot><tr><td colspan="2">Totale</td><td class="num">${e(totalAmount)}</td></tr></tfoot>
      </table>
      ${usingCustomInstallments ? `<p class="pay-note">Piano di pagamento personalizzato</p>` : ''}
      ` : ''}

      <!-- 5. CONDIZIONI DI PAGAMENTO -->
      ${hasPaymentText ? `
      <h2 class="section-header">Condizioni di pagamento</h2>
      <div class="template-content">
        ${sanitizeHtml(contractData.template.paymentText)}
      </div>
      ` : ''}

      <!-- 6. CORPO DEL CONTRATTO -->
      ${/* Sorgente unica: contractData.template.content contiene il
          generatedContent già risolto dal server (placeholder sostituiti
          + sezioni modulari iniettate in posizione deterministica prima
          dei termini di pagamento, oppure al posto del marker
          BLOCK:SECTIONS). Così PDF, preview e client-view mostrano lo
          stesso testo finale. */''}
      ${hasContent ? `
      <h2 class="section-header">Corpo del contratto</h2>
      <div class="template-content">
        ${sanitizeHtml(contractData.template.content)}
      </div>
      ` : ''}

      <!-- 7. BONUS INCLUSI -->
      ${hasBonuses ? `
      <h2 class="section-header">Bonus inclusi</h2>
      <ul class="list">
        ${bonusList.map((bonus: any, index: number) => `
          <li><span class="bonus-label">Bonus ${index + 1}</span>${e(bonus.bonus_descrizione)}</li>
        `).join('')}
      </ul>
      ` : ''}

      <!-- 8. VALIDITÀ DEL CONTRATTO -->
      <h2 class="section-header">Validità del contratto</h2>
      <table class="kv">
        ${contractStartDate ? `<tr><td class="k">Data di inizio</td><td class="v">${e(formatDateSafe(contractStartDate))}</td></tr>` : ''}
        ${contractEndDate ? `<tr><td class="k">Data di scadenza</td><td class="v">${e(formatDateSafe(contractEndDate))}</td></tr>` : ''}
        ${contractData.signedAt ? `<tr><td class="k">Firmato il</td><td class="v">${e(formatDateSafe(contractData.signedAt))}</td></tr>` : ''}
      </table>

      <!-- 9. CLAUSOLA DI AUTORINNOVO (solo contratti cliente: il contratto
           procacciatore disciplina durata e recesso nei propri articoli) -->
      ${isProcacciatore ? '' : `
      <h2 class="section-header">Clausola di autorinnovo</h2>
      <div class="template-content">
        <p>Il presente contratto si intende tacitamente rinnovato per un periodo di <strong>${e(renewalDuration)} mesi</strong> salvo disdetta da comunicarsi con un preavviso di almeno 30 giorni prima della scadenza mediante raccomandata A/R o PEC.</p>
        <p>In assenza di comunicazione di disdetta nei termini previsti, il contratto si rinnoverà automaticamente alle medesime condizioni economiche e contrattuali per ulteriori <strong>${e(renewalDuration)} mesi</strong>.</p>
      </div>
      `}

      <!-- 10. DICHIARAZIONI E FIRMA -->
      <div style="page-break-inside: avoid;">
        <h2 class="section-header">Dichiarazioni e firma</h2>
        <p style="margin-bottom: 8px;">Con la sottoscrizione del presente contratto, ${isProcacciatore ? 'il Procacciatore' : 'il Cliente'} dichiara:</p>
        <ul class="list">
          <li>di aver letto e compreso integralmente il contenuto del presente contratto;</li>
          <li>di accettare espressamente tutte le clausole e condizioni in esso contenute;</li>
          <li>di aver ricevuto tutte le informazioni necessarie prima della sottoscrizione;</li>
          <li>che i dati forniti sono veritieri e aggiornati.</li>
        </ul>

        <div class="sign">
          <div class="sign-date">
            <div class="f-label">Data</div>
            <div class="f-value">${e(formatShortDateItalian(contractData.signedAt || new Date()))}</div>
          </div>
          <div class="sign-box">
            <div class="sign-area">
              ${isSigned && signatureValue
                ? (signatureValue.startsWith('data:image')
                    ? `<img src="${e(signatureValue)}" alt="Firma" />`
                    : `<div class="sign-text">${e(signatureValue)}</div>`)
                : ''}
            </div>
            <div class="sign-caption">
              <span>${isProcacciatore ? 'Firma del Procacciatore' : 'Firma del Cliente / Committente'}</span>
              ${signerName ? `<span class="who">${e(signerName)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      ${contractData.regenerationNotice ? `
      <div class="notice">
        <div class="notice-title">Documento rigenerato</div>
        <p>
          Documento rigenerato il <strong>${e(formatDateSafe(contractData.regenerationNotice.regeneratedAt))}</strong>${contractData.regenerationNotice.originalSignedAt ? ` — firme originali apposte il <strong>${e(formatDateSafe(contractData.regenerationNotice.originalSignedAt))}</strong>` : ''}.${contractData.regenerationNotice.reason ? ` Motivo: ${e(contractData.regenerationNotice.reason)}.` : ''}
          Il presente PDF sostituisce la versione originale con contenuto aggiornato; le firme e il consenso OTP restano quelli apposti nella data di firma originale.
        </p>
      </div>
      ` : ''}

      ${appendixHtml}

    </body>
    </html>
  `;
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
    contractId: contractData?.id ?? auditLogs[0]?.contractId ?? '',
    docType: contractData?.template?.name || contractData?.templateName,
    status: contractData?.status,
    signedAt: contractData?.signedAt,
    regenerationNotice: contractData?.regenerationNotice || null,
    userNames,
  });
}
