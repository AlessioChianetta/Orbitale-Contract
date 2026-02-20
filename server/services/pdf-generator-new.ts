import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { AuditLog } from '@shared/schema';

// Safe date formatting function to avoid "Invalid Date" issues
function formatDateSafe(dateString?: string | Date): string {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  } catch {
    return '';
  }
}

export async function generatePDF(
  contractId: number, 
  htmlContent: string, 
  auditLogs?: AuditLog[],
  contractData?: any,
  companySettings?: any
): Promise<string> {
  const browser = await puppeteer.launch({ 
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
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
  });

  try {
    const page = await browser.newPage();

    // Use the new client-view identical layout
    const fullHtml = contractData ? 
      generateClientViewIdenticalHtml(contractData, companySettings) + (auditLogs ? generateAuditTrailHtml(auditLogs, contractData) : '') :
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
          ${auditLogs ? generateAuditTrailHtml(auditLogs) : ''}
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
    await browser.close();
  }
}

function generateClientViewIdenticalHtml(contractData: any, companySettings?: any): string {
  const client = contractData.clientData || {};

  const company = companySettings || {
    companyName: 'ALE srl',
    address: 'ale, 11',
    city: 'Capo D orlando',
    postalCode: '98071',
    taxId: '00000000000',
    vatId: '00000000000',
    uniqueCode: 'xxxxxxx',
    pec: 'Ale@casellapec.com',
    contractTitle: 'Contratto '
  };

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
  const totalAmount = paymentPlan.reduce((sum: number, payment: any) => sum + parseFloat(payment.rata_importo || '0'), 0).toFixed(2);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Contratto ${contractData.id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

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
          <div class="company-name">${company.companyName || 'ALE srl'}</div>
          <div>${company.address || ', 39'} Cap ${company.postalCode || '20143'} ${company.city || 'Capo dorlando'}</div>
          <div>C.F. e P.I. ${company.taxId || '0000000000'}</div>
          <div>Codice univoco: ${company.uniqueCode || 'M5UXCR1'}</div>
          <div>Pec: ${company.pec || 'ALE@casellapec.com'}</div>
        </div>
      </div>

      <div class="contract-title">
        ${contractData.template?.name || contractData.templateName || company.contractTitle || 'Contratto'}
      </div>

      <!-- 2. DATI CLIENTE -->
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
          <td><strong>Data di nascita</strong> ${client.data_nascita ? new Date(client.data_nascita).toLocaleDateString('it-IT') : ''}</td>
          <td><strong>Residente a</strong> ${client.residente_a || ''}</td>
        </tr>
        <tr>
          <td colspan="2" class="full-width"><strong>Indirizzo di residenza:</strong> ${client.indirizzo_residenza || ''}</td>
        </tr>
      </table>

      <!-- 3. CONTENUTO PERSONALIZZATO -->
      ${hasCustomContent ? `
      <h2 class="section-header commercial">CONTENUTO PERSONALIZZATO</h2>
      <div class="template-content">
        ${contractData.template.customContent}
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
        ${contractData.template.paymentText}
      </div>
      ` : ''}

      <!-- 6. CORPO DEL CONTRATTO -->
      ${hasContent ? `
      <h2 class="section-header legal" style="page-break-before: always;">CORPO DEL CONTRATTO</h2>
      <div class="template-content">
        ${contractData.template.content}
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

      <!-- 9. CLAUSOLA DI AUTORINNOVO -->
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

      <!-- 10. DICHIARAZIONI E FIRMA -->
      <h2 class="section-header commercial">DICHIARAZIONI E FIRMA</h2>
      <div class="section-card slate" style="page-break-inside: avoid;">
        <div style="font-size: 10pt; color: #374151;">
          <p style="line-height: 1.7; margin-bottom: 12px;">
            Con la sottoscrizione del presente contratto, il Cliente dichiara:
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
        <p style="margin-bottom: 16px; font-size: 10pt; color: #374151;">Data ${new Date().toLocaleDateString('it-IT')} &nbsp;&nbsp; <strong>Firma Cliente/Committente</strong></p>
        <div class="signature-area">
          ${contractData.status === 'signed' && contractData.signatures?.marketing ? 
            (contractData.signatures.marketing.startsWith('data:image') ? 
              `<img src="${contractData.signatures.marketing}" alt="Firma" class="signature-image" />` :
              `<div class="signature-text">${contractData.signatures.marketing}</div>`
            ) :
            `<div class="signature-placeholder">
              <div>✒️ Firma del cliente</div>
              <div style="font-size: 12px; margin-top: 4px;">Area firma digitale</div>
            </div>`
          }
        </div>
      </div>

    </body>
    </html>
  `;
}

function generateAuditTrailHtml(auditLogs: AuditLog[], contractData?: any): string {
  if (!auditLogs || auditLogs.length === 0) {
    return '';
  }

  const contractId = auditLogs[0]?.contractId || 'unknown';
  const currentDate = new Date().toLocaleDateString('it-IT');
  const currentTime = new Date().toLocaleTimeString('it-IT', { hour12: false });

  return `
    <div style="page-break-before: always; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff;">

      <!-- Professional Header -->
      <div style="background: #3b82f6; color: white; padding: 30px 40px; margin: 0 0 30px 0; position: relative;">
        <div style="max-width: 100%; margin: 0 auto;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">REGISTRO AUDIT DIGITALE</h1>
          <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.95;">Tracciabilità completa delle operazioni di firma digitale</p>
          <div style="position: absolute; top: 30px; right: 40px; background: rgba(255,255,255,0.2); padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">ID DOCUMENTO</div>
            <div style="font-size: 20px; font-weight: 700;">#${contractId}</div>
          </div>
        </div>
      </div>

      <!-- Document Info Section -->
      <div style="background: #f8fafb; border: 1px solid #e5e7eb; padding: 24px; margin: 0 0 30px 0; border-radius: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.05em;">TIPOLOGIA DOCUMENTO</div>
            <div style="font-size: 14px; font-weight: 600; color: #111827;">${contractData.template?.name || contractData.templateName || 'Contratto'}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.05em;">STATO FINALE</div>
            <div style="display: inline-block; background: #10b981; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              ✓ FIRMATO E COMPLETATO
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.05em;">NOME FILE FINALE</div>
            <div style="font-size: 14px; font-weight: 600; color: #111827; font-family: 'Courier New', monospace;">contract_${contractId}_signed.pdf</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.05em;">GENERATO IL</div>
            <div style="font-size: 14px; font-weight: 600; color: #111827;">${currentDate} alle ${currentTime}</div>
          </div>
        </div>
      </div>

      <!-- Timeline Table -->
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background: #f8fafb; padding: 20px 24px; border-bottom: 2px solid #e5e7eb;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">Cronologia delle Operazioni</h3>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #6b7280;">Registro completo di tutte le azioni eseguite sul documento</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 16px 24px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">OPERAZIONE</th>
              <th style="padding: 16px 24px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">DATA E ORA</th>
              <th style="padding: 16px 24px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">DETTAGLI OPERAZIONE</th>
            </tr>
          </thead>
          <tbody>
            ${auditLogs.map((log, index) => `
              <tr style="border-bottom: ${index < auditLogs.length - 1 ? '1px solid #f3f4f6' : 'none'};">
                <td style="padding: 20px 24px; vertical-align: top;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${getActionColor(log.action)}; flex-shrink: 0;"></div>
                    <span style="font-weight: 600; color: #111827; font-size: 13px;">${getActionLabel(log.action)}</span>
                  </div>
                </td>
                <td style="padding: 20px 24px; vertical-align: top; color: #6b7280; font-family: 'Courier New', monospace; font-size: 11px; white-space: nowrap;">
                  ${formatTimestamp(log.timestamp)}
                </td>
                <td style="padding: 20px 24px; vertical-align: top; line-height: 1.6; color: #374151;">
                  ${generateAuditDetails(log)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer Security Notice -->
      <div style="margin-top: 40px; padding: 24px; background: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="width: 24px; height: 24px; background: #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; flex-shrink: 0; margin-top: 2px;">!</div>
          <div style="flex: 1;">
            <h4 style="margin: 0 0 8px 0; color: #92400e; font-size: 16px; font-weight: 600;">AVVISO DI SICUREZZA E VALIDITÀ LEGALE</h4>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">
              Questo registro audit è stato generato automaticamente dal sistema Turbo Contract e costituisce prova legale dell'integrità del processo di firma digitale. 
              Ogni operazione è stata registrata con timestamp UTC, indirizzo IP del cliente e metadati di sicurezza. 
              La manomissione di questo documento è tecnicamente rilevabile e legalmente perseguibile.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getActionLabel(action: string): string {
  switch(action) {
    case 'sent': return 'Invitato';
    case 'viewed': return 'Visualizzato';
    case 'otp_sent': return 'Inviato OTP';
    case 'signed': return 'Firmato';
    case 'completed': return 'Completato';
    default: return action;
  }
}

function getActionColor(action: string): string {
  switch(action) {
    case 'sent': return '#3b82f6'; // Blue
    case 'viewed': return '#8b5cf6'; // Purple
    case 'otp_sent': return '#f59e0b'; // Orange
    case 'signed': return '#10b981'; // Green
    case 'completed': return '#059669'; // Emerald
    default: return '#64748b'; // Gray
  }
}

function formatTimestamp(timestamp: Date): string {
  const date = new Date(timestamp);
  // Converti da UTC a fuso orario italiano
  const italianTime = new Date(date.getTime() + (2 * 60 * 60 * 1000)); // +2 ore per ora legale
  return `${italianTime.toLocaleDateString('it-IT')} ${italianTime.toLocaleTimeString('it-IT', { hour12: false })} CET`;
}

function generateAuditDetails(log: AuditLog): string {
  const metadata = log.metadata as Record<string, any> || {};
  const ipAddress = log.ipAddress || 'IP non disponibile';

  // Parse user agent to get browser name
  let browserName = 'Browser non rilevato';
  if (log.userAgent) {
    if (log.userAgent.includes('Chrome') && !log.userAgent.includes('Edg')) {
      browserName = 'Chrome';
    } else if (log.userAgent.includes('Firefox')) {
      browserName = 'Firefox';
    } else if (log.userAgent.includes('Safari') && !log.userAgent.includes('Chrome')) {
      browserName = 'Safari';
    } else if (log.userAgent.includes('Edg')) {
      browserName = 'Edge';
    } else if (log.userAgent.includes('Opera')) {
      browserName = 'Opera';
    }
  }

  switch(log.action) {
    case 'sent':
      const sentToEmail = metadata.sentToEmail || 'Email non specificata';
      const sentBy = metadata.sentBy ? `Utente ID: ${metadata.sentBy}` : 'Sistema';
      return `
        <div style="font-weight: 500;">📧 Contratto inviato via email</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          <strong>Destinatario:</strong> ${sentToEmail}<br>
          <strong>Mittente:</strong> ${sentBy}<br>
          <strong>Indirizzo IP:</strong> ${ipAddress}<br>
          <strong>Browser:</strong> ${browserName}
        </div>
      `;
    case 'viewed':
      const accessMethod = metadata.accessMethod === 'email_link' ? 'Accesso via link email' : 'Accesso diretto via codice contratto';
      return `
        <div style="font-weight: 500;">👁️ Documento visualizzato dal cliente</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          <strong>Indirizzo IP:</strong> ${ipAddress}<br>
          <strong>Metodo:</strong> ${accessMethod}<br>
          <strong>Browser:</strong> ${browserName}
        </div>
      `;
    case 'otp_sent':
      const phoneNumber = metadata.actualPhoneNumber || metadata.phoneNumber || 'Numero non disponibile';
      const otpMethod = metadata.method === 'sms' ? 'SMS' : 'Email';
      const twilioUsed = metadata.twilioVerify ? 'Twilio Verify' : 'Sistema personalizzato';
      return `
        <div style="font-weight: 500;">📱 Codice OTP inviato via ${otpMethod}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          <strong>Numero telefono:</strong> ${phoneNumber}<br>
          <strong>Sistema:</strong> ${twilioUsed}
        </div>
      `;
    case 'signed':
      const signerEmail = metadata.emailUsedForSigning || metadata.emailFromContract || 'Email non disponibile';
      const phoneUsed = metadata.phoneNumber || 'Telefono non disponibile';
      const signatureMethod = metadata.signatureMethod || 'Metodo non specificato';
      const signaturesCount = metadata.signatures ? Object.keys(metadata.signatures).length : 0;

      return `
        <div style="font-weight: 500;">✅ Contratto firmato digitalmente</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          <strong>Email firmatario:</strong> ${signerEmail}<br>
          <strong>Telefono verificato:</strong> ${phoneUsed}<br>
          <strong>Metodo autenticazione:</strong> ${signatureMethod === 'otp_verification' ? 'Verifica OTP via SMS' : signatureMethod}<br>
          <strong>Numero firme:</strong> ${signaturesCount} firma/e elettronica/e<br>
          <strong>Indirizzo IP:</strong> ${ipAddress}<br>
          <strong>Browser:</strong> ${browserName}
        </div>
      `;
    case 'completed':
      return `
        <div style="font-weight: 500;">🎯 Processo di firma completato</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          <strong>Stato finale:</strong> Documento completamente firmato e sigillato<br>
          <strong>Sistema:</strong> PDF finale generato con audit trail integrato
        </div>
      `;
    default:
      return `
        <div style="font-weight: 500;">⚙️ ${log.action}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          ${metadata && Object.keys(metadata).length > 0 ? 
            `<strong>Dettagli:</strong> ${JSON.stringify(metadata)}` : 
            'Nessun dettaglio aggiuntivo'}<br>
          <strong>IP:</strong> ${ipAddress}
        </div>
      `;
  }
}