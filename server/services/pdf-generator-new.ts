import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { AuditLog } from '@shared/schema';
import { formatDateItalian } from '@shared/procacciatore-fields';
import { renderAuditTrailHtml } from './audit-trail';

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

    await page.pdf({
      path: filePath,
      format: 'A4',
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm'
      },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Contratto ${contractData.id}</title>
      <style>
        ${getEmbeddedFontCss()}

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.6; 
          margin: 0;
          padding: 0;
          background: white;
          font-size: 11pt;
          color: #111827;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @page {
          size: A4;
          margin: 15mm;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }

        .logo { 
          background: #000;
          color: white; 
          padding: 20px; 
          font-weight: 700; 
          text-align: center;
          width: 120px;
          height: 80px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-radius: 4px;
        }
        .logo .logo-text { 
          font-size: 14px; 
          line-height: 1;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .company-info {
          text-align: right;
          font-size: 10pt;
          line-height: 1.4;
          color: #374151;
        }
        .company-info .company-name {
          font-weight: 600;
          font-size: 12pt;
          color: #111827;
          margin-bottom: 4px;
        }

        .contract-title {
          font-weight: 700;
          font-size: 24px;
          margin: 24px 0 32px 0;
          color: #111827;
          text-align: center;
          letter-spacing: -0.02em;
        }

        .section-header {
          font-size: 14pt;
          font-weight: 700;
          color: #1e293b;
          border-left: 4px solid #6366f1;
          padding-left: 12px;
          margin: 32px 0 16px 0;
        }

        .section-header.commercial { border-left-color: #6366f1; }
        .section-header.legal { border-left-color: #8b5cf6; }
        .section-header.payment { border-left-color: #3b82f6; }
        .section-header.bonus { border-left-color: #10b981; }
        .section-header.validity { border-left-color: #6366f1; }

        .section-card {
          padding: 20px;
          border-radius: 12px;
          margin: 16px 0 32px 0;
          page-break-inside: avoid;
        }

        .section-card.blue { background-color: #eff6ff; border: 1px solid #bfdbfe; }
        .section-card.amber { background-color: #fffbeb; border: 1px solid #fde68a; }
        .section-card.indigo { background-color: #eff6ff; border: 1px solid #c7d2fe; }
        .section-card.violet { background-color: #f5f3ff; border: 1px solid #ddd6fe; }
        .section-card.slate { background-color: #f8fafc; border: 1px solid #e2e8f0; }

        .client-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 32px; 
          border: 1px solid #d1d5db;
          font-size: 10pt;
          background: white;
          border-radius: 12px;
          overflow: hidden;
        }

        .client-table-header { 
          background-color: #3b82f6; 
          color: white;
          border-bottom: 2px solid #2563eb; 
          padding: 12px; 
          font-weight: 600;
          font-size: 11pt;
          letter-spacing: 0.025em;
          text-transform: uppercase;
        }

        .client-table tr { 
          border-bottom: 1px solid #e5e7eb;
        }

        .client-table td { 
          border-right: 1px solid #e5e7eb; 
          padding: 10px 12px; 
          font-weight: 400;
          width: 50%;
          color: #374151;
        }

        .client-table td strong {
          font-weight: 600;
          color: #111827;
        }

        .client-table td:last-child {
          border-right: none;
        }

        .client-table tr:last-child td {
          border-bottom: none;
        }

        .client-table .full-width {
          width: 100%;
          border-right: none;
        }

        .template-content {
          font-size: 10pt;
          color: #374151;
          line-height: 1.7;
        }
        .template-content p { margin-bottom: 12px; line-height: 1.7; }
        .template-content ul, .template-content ol { margin: 12px 0; padding-left: 24px; }
        .template-content li { margin-bottom: 6px; }
        .template-content strong { font-weight: 600; color: #111827; }
        .template-content em { font-style: italic; }
        .template-content h1 { font-size: 20px; font-weight: 700; margin: 24px 0 12px 0; color: #111827; }
        .template-content h2 { font-size: 18px; font-weight: 700; margin: 20px 0 10px 0; color: #111827; }
        .template-content h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px 0; color: #111827; }
        .template-content div { page-break-inside: avoid; }

        .bonus-item {
          margin-bottom: 12px;
          padding: 16px;
          border-left: 4px solid #10b981;
          background: linear-gradient(to bottom right, rgba(236, 253, 245, 0.8), rgba(240, 253, 244, 0.4));
          border-radius: 0 12px 12px 0;
          page-break-inside: avoid;
        }

        .bonus-title {
          font-weight: 600;
          color: #065f46;
          margin-bottom: 4px;
          font-size: 10pt;
        }

        .bonus-description {
          font-size: 10pt;
          line-height: 1.6;
          margin: 0;
          color: #374151;
        }

        .signature-area {
          border: 2px solid #d1d5db;
          background-color: #fafbfc;
          padding: 24px;
          border-radius: 8px;
          text-align: center;
          min-height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px 0;
          page-break-inside: avoid;
        }

        .signature-placeholder {
          color: #6b7280;
          font-size: 10pt;
        }

        .signature-image {
          max-height: 80px;
          max-width: 300px;
          border: 1px solid #d1d5db;
        }

        .signature-text {
          font-family: 'Brush Script MT', cursive;
          font-size: 28px;
          font-weight: 500;
          color: #1e3a8a;
          padding: 10px;
        }

        .dot-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 10pt;
          color: #374151;
          margin-bottom: 8px;
        }

        .dot-item .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }

        * {
          orphans: 3;
          widows: 3;
        }

        .bonus-item,
        .section-card,
        .client-table,
        .signature-area {
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>

      <!-- 1. INTESTAZIONE -->
      <div class="header">
        ${company.logoUrl ? 
          `<img src="${company.logoUrl}" alt="Logo" style="max-width: 120px; max-height: 80px; object-fit: contain;" />` :
          `<div class="logo">
            <div class="logo-text">${(company.companyName || 'AZIENDA').substring(0, 8).toUpperCase()}</div>
          </div>`
        }
        <div class="company-info">
          <div class="company-name">${company.companyName || ''}</div>
          ${companyAddressLine ? `<div>${companyAddressLine}</div>` : ''}
          ${company.taxId ? `<div>C.F. e P.I. ${company.taxId}</div>` : ''}
          ${company.uniqueCode ? `<div>Codice univoco: ${company.uniqueCode}</div>` : ''}
          ${company.pec ? `<div>Pec: ${company.pec}</div>` : ''}
        </div>
      </div>

      <div class="contract-title">
        ${contractData.template?.name || contractData.templateName || company.contractTitle || 'Contratto'}
      </div>

      <!-- 2. DATI CONTROPARTE (cliente/committente oppure procacciatore) -->
      ${isProcacciatore ? `
      <h2 class="section-header commercial">DATI DEL PROCACCIATORE D'AFFARI</h2>
      <table class="client-table">
        <tr>
          <td colspan="2" class="client-table-header full-width">
            Dati del procacciatore d'affari
          </td>
        </tr>
        <tr>
          <td><strong>Nome / Ragione sociale</strong> ${client.procacciatore_nome || ''}</td>
          <td><strong>P.IVA</strong> ${client.procacciatore_piva || ''}</td>
        </tr>
        <tr>
          <td><strong>Codice Fiscale</strong> ${client.procacciatore_codice_fiscale || ''}</td>
          <td><strong>Nato/a a</strong> ${[client.procacciatore_nato_a, client.procacciatore_data_nascita ? `il ${formatDateItalian(client.procacciatore_data_nascita)}` : ''].filter(Boolean).join(' ')}</td>
        </tr>
        <tr>
          <td colspan="2" class="full-width"><strong>Residenza</strong> ${client.procacciatore_residenza || ''}</td>
        </tr>
        <tr>
          <td colspan="2" class="full-width"><strong>Sede / Domicilio fiscale</strong> ${client.procacciatore_sede || ''}</td>
        </tr>
        <tr>
          <td>Email ${client.email || ''}</td>
          <td>Cellulare ${client.cellulare || ''}</td>
        </tr>
        ${(client.procacciatore_pec || client.procacciatore_sdi) ? `
        <tr>
          <td><strong>PEC</strong> ${client.procacciatore_pec || '—'}</td>
          <td><strong>Codice SDI</strong> ${client.procacciatore_sdi || '—'}</td>
        </tr>
        ` : ''}
        ${client.procacciatore_iban ? `
        <tr>
          <td colspan="2" class="full-width"><strong>IBAN</strong> ${client.procacciatore_iban}</td>
        </tr>
        ` : ''}
      </table>
      ` : `
      <h2 class="section-header commercial">DATI DEL CLIENTE / COMMITTENTE</h2>
      <table class="client-table">
        <tr>
          <td colspan="2" class="client-table-header full-width">
            Dati del cliente/committente
          </td>
        </tr>
        <tr>
          <td>Società ${client.societa || ''}</td>
          <td>Con sede in ${client.sede || ''}</td>
        </tr>
        <tr>
          <td>Indirizzo ${client.indirizzo || ''}</td>
          <td>Codice fiscale/PIVA ${client.p_iva || ''}</td>
        </tr>
        <tr>
          <td>PEC ${client.pec || ''}</td>
          <td>Email ${client.email || ''}</td>
        </tr>
        <tr>
          <td>Cellulare ${client.cellulare || ''}</td>
          <td>Codice univoco ${client.codice_univoco || ''}</td>
        </tr>
        <tr>
          <td colspan="2" class="full-width">Numero iscrizione al REA o al registro delle imprese ${client.rea || ''}</td>
        </tr>
        <tr>
          <td colspan="2" class="full-width" style="font-style: italic; color: #475569;">In persona del suo legale rappresentante p.t.</td>
        </tr>
        <tr>
          <td><strong>Signor./a.</strong> ${client.cliente_nome || ''}</td>
          <td><strong>Nato a</strong> ${client.nato_a || ''}</td>
        </tr>
        <tr>
          <td><strong>Data di nascita</strong> ${formatBirthDate(client.data_nascita)}</td>
          <td><strong>Residente a</strong> ${client.residente_a || ''}</td>
        </tr>
        <tr>
          <td colspan="2" class="full-width"><strong>Indirizzo di residenza:</strong> ${client.indirizzo_residenza || ''}</td>
        </tr>
      </table>
      `}

      <!-- 3. CONTENUTO PERSONALIZZATO -->
      ${hasCustomContent ? `
      <h2 class="section-header commercial">CONTENUTO PERSONALIZZATO</h2>
      <div class="template-content">
        ${sanitizeHtml(contractData.template.customContent)}
      </div>
      ` : ''}

      <!-- 4. PIANO PAGAMENTI -->
      ${isPartnership ? `
      <h2 class="section-header" style="border-left-color: #f59e0b;">MODELLO DI PARTNERSHIP</h2>
      <div class="section-card amber" style="page-break-inside: avoid;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; padding: 8px 16px; background-color: #fbbf24; border-radius: 8px; font-size: 16px; font-weight: 700; color: #78350f;">
            Percentuale: ${contractData.partnershipPercentage}% sul fatturato TOTALE
          </span>
        </div>
        <div style="font-size: 10pt; color: #374151;">
          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 12pt; font-weight: 600; color: #92400e; margin-bottom: 8px;">DEFINIZIONE DI FATTURATO TOTALE</h4>
            <p style="line-height: 1.6; margin-bottom: 8px;">Per "fatturato TOTALE" si intende la somma di tutti i ricavi lordi generati dall'attività, comprensivi di:</p>
            <ul style="margin: 8px 0; padding-left: 20px; line-height: 1.6;">
              <li>Vendite di cibo e bevande</li>
              <li>Servizi di catering e delivery</li>
              <li>Eventi privati e prenotazioni speciali</li>
              <li>Qualsiasi altro ricavo direttamente collegato all'attività</li>
            </ul>
          </div>
          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 12pt; font-weight: 600; color: #92400e; margin-bottom: 8px;">MODALITÀ DI CALCOLO E PAGAMENTO</h4>
            <p style="line-height: 1.6;">Il pagamento della percentuale sarà calcolato mensilmente sul fatturato TOTALE del mese precedente e dovrà essere corrisposto entro il 15 del mese successivo tramite bonifico bancario.</p>
          </div>
          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 12pt; font-weight: 600; color: #92400e; margin-bottom: 8px;">TRASPARENZA E RENDICONTAZIONE</h4>
            <p style="line-height: 1.6; margin-bottom: 8px;">Il Cliente si impegna a fornire mensilmente la documentazione contabile necessaria per il calcolo della percentuale dovuta, inclusi:</p>
            <ul style="margin: 8px 0; padding-left: 20px; line-height: 1.6;">
              <li>Estratti conto del registratore di cassa o POS</li>
              <li>Fatture emesse nel periodo di riferimento</li>
              <li>Dichiarazioni IVA periodiche</li>
              <li>Report di fatturato certificati dal commercialista</li>
            </ul>
          </div>
          <div style="padding: 12px; background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px; text-align: center;">
            <p style="font-size: 10pt; color: #991b1b; margin: 0; font-weight: 600;">
              IMPORTANTE: Questo modello di partnership sostituisce qualsiasi piano di pagamento fisso. Il compenso sarà calcolato esclusivamente come percentuale del fatturato totale.
            </p>
          </div>
        </div>
      </div>
      ` : hasPaymentPlan ? `
      <h2 class="section-header payment">PIANO PAGAMENTI</h2>
      <div class="section-card blue" style="page-break-inside: avoid;">
        <p style="font-size: 10pt; color: #1e40af; font-weight: 600; margin-bottom: 12px;">
          Il prezzo totale di ${totalAmount} EUR + IVA sarà corrisposto con le seguenti modalità:
        </p>
        <div>
          ${paymentPlan.map((payment: any, index: number) => `
            <div class="dot-item">
              <span class="dot" style="background-color: #3b82f6;"></span>
              <span>Pagamento ${payment.rata_numero || index + 1} di EUR <strong>${payment.rata_importo}</strong> + IVA entro il <strong>${payment.rata_scadenza}</strong></span>
            </div>
          `).join('')}
        </div>
        ${usingCustomInstallments ? `<p style="font-size: 9pt; color: #2563eb; margin-top: 12px; font-style: italic;">Piano di pagamento personalizzato</p>` : ''}
      </div>
      ` : ''}

      <!-- 5. CONDIZIONI DI PAGAMENTO -->
      ${hasPaymentText ? `
      <h2 class="section-header payment">CONDIZIONI DI PAGAMENTO</h2>
      <div class="template-content">
        ${sanitizeHtml(contractData.template.paymentText)}
      </div>
      ` : ''}

      <!-- 6. CORPO DEL CONTRATTO -->
      ${/* Sorgente unica: contractData.template.content contiene il
          generatedContent già risolto dal server (placeholder sostituiti
          + sezioni modulari iniettate in posizione deterministica prima
          dei termini di pagamento, oppure al posto del marker
          BLOCK:SECTIONS). Così PDF, preview e client-view rendono
          identicamente lo stesso HTML finale. */''}
      ${hasContent ? `
      <h2 class="section-header legal" style="page-break-before: auto;">CORPO DEL CONTRATTO</h2>
      <div class="template-content">
        ${sanitizeHtml(contractData.template.content)}
      </div>
      ` : ''}

      <!-- 7. BONUS INCLUSI -->
      ${hasBonuses ? `
      <h2 class="section-header bonus">BONUS INCLUSI</h2>
      <div>
        ${bonusList.map((bonus: any, index: number) => `
          <div class="bonus-item">
            <p class="bonus-title">Bonus ${index + 1}</p>
            <p class="bonus-description">${bonus.bonus_descrizione}</p>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- 8. VALIDITÀ DEL CONTRATTO -->
      <h2 class="section-header validity">VALIDITÀ DEL CONTRATTO</h2>
      <div class="section-card indigo">
        <div style="font-size: 10pt; color: #374151;">
          ${contractStartDate ? `<p style="margin-bottom: 8px;"><strong style="color: #111827;">Data di inizio:</strong> ${formatDateSafe(contractStartDate)}</p>` : ''}
          ${contractEndDate ? `<p style="margin-bottom: 8px;"><strong style="color: #111827;">Data di scadenza:</strong> ${formatDateSafe(contractEndDate)}</p>` : ''}
          ${contractData.signedAt ? `<p style="margin-bottom: 8px;"><strong style="color: #111827;">Firmato il:</strong> ${formatDateSafe(contractData.signedAt)}</p>` : ''}
        </div>
      </div>

      <!-- 9. CLAUSOLA DI AUTORINNOVO (solo contratti cliente: il contratto
           procacciatore disciplina durata e recesso nei propri articoli) -->
      ${isProcacciatore ? '' : `
      <h2 class="section-header legal">CLAUSOLA DI AUTORINNOVO</h2>
      <div class="section-card violet">
        <div style="font-size: 10pt; color: #374151;">
          <p style="line-height: 1.7; margin-bottom: 12px;">
            Il presente contratto si intende tacitamente rinnovato per un periodo di <strong style="color: #111827;">${renewalDuration} mesi</strong> salvo disdetta da comunicarsi con un preavviso di almeno 30 giorni prima della scadenza mediante raccomandata A/R o PEC.
          </p>
          <p style="line-height: 1.7;">
            In assenza di comunicazione di disdetta nei termini previsti, il contratto si rinnoverà automaticamente alle medesime condizioni economiche e contrattuali per ulteriori <strong style="color: #111827;">${renewalDuration} mesi</strong>.
          </p>
        </div>
      </div>
      `}

      <!-- 10. DICHIARAZIONI E FIRMA -->
      <h2 class="section-header commercial">DICHIARAZIONI E FIRMA</h2>
      <div class="section-card slate" style="page-break-inside: avoid;">
        <div style="font-size: 10pt; color: #374151;">
          <p style="line-height: 1.7; margin-bottom: 12px;">
            Con la sottoscrizione del presente contratto, ${isProcacciatore ? 'il Procacciatore' : 'il Cliente'} dichiara:
          </p>
          <div style="margin-left: 8px;">
            <div class="dot-item">
              <span class="dot" style="background-color: #6366f1;"></span>
              <span>di aver letto e compreso integralmente il contenuto del presente contratto;</span>
            </div>
            <div class="dot-item">
              <span class="dot" style="background-color: #6366f1;"></span>
              <span>di accettare espressamente tutte le clausole e condizioni in esso contenute;</span>
            </div>
            <div class="dot-item">
              <span class="dot" style="background-color: #6366f1;"></span>
              <span>di aver ricevuto tutte le informazioni necessarie prima della sottoscrizione;</span>
            </div>
            <div class="dot-item">
              <span class="dot" style="background-color: #6366f1;"></span>
              <span>che i dati forniti sono veritieri e aggiornati.</span>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 32px; page-break-inside: avoid;">
        <p style="margin-bottom: 16px; font-size: 10pt; color: #374151;">Data ${formatShortDateItalian(contractData.signedAt || new Date())} &nbsp;&nbsp; <strong>${isProcacciatore ? 'Firma Procacciatore' : 'Firma Cliente/Committente'}</strong></p>
        <div class="signature-area">
          ${(contractData.status === 'signed' || contractData.status === 'completed') && contractData.signatures?.marketing ? 
            (contractData.signatures.marketing.startsWith('data:image') ? 
              `<img src="${contractData.signatures.marketing}" alt="Firma" class="signature-image" />` :
              `<div class="signature-text">${contractData.signatures.marketing}</div>`
            ) :
            `<div class="signature-placeholder">
              <div>${isProcacciatore ? 'Firma del procacciatore' : 'Firma del cliente'}</div>
              <div style="font-size: 12px; margin-top: 4px;">Area firma digitale</div>
            </div>`
          }
        </div>
      </div>

      ${contractData.regenerationNotice ? `
      <div style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin: 32px 0 0 0; page-break-inside: avoid;">
        <p style="margin: 0 0 4px 0; font-size: 11pt; font-weight: 700; color: #92400e;">DOCUMENTO RIGENERATO</p>
        <p style="margin: 0; font-size: 9.5pt; color: #78350f; line-height: 1.5;">
          Documento rigenerato il <strong>${formatDateSafe(contractData.regenerationNotice.regeneratedAt)}</strong>${contractData.regenerationNotice.originalSignedAt ? ` — firme originali apposte il <strong>${formatDateSafe(contractData.regenerationNotice.originalSignedAt)}</strong>` : ''}.${contractData.regenerationNotice.reason ? ` Motivo: ${contractData.regenerationNotice.reason}.` : ''}
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
