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

  // Use company settings or fallback to defaults
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

  // Combine predefined bonuses from template with manual bonuses (exactly like client-view)
  let combinedBonusList = [];

  // Add predefined bonuses from template
  if (contractData.template?.predefinedBonuses && Array.isArray(contractData.template.predefinedBonuses)) {
    combinedBonusList = contractData.template.predefinedBonuses.map((bonus: any) => ({
      bonus_descrizione: bonus.description + (bonus.value ? ` (${bonus.value}${bonus.type === 'percentage' ? '%' : '€'})` : '')
    }));
  }

  // Add manual bonuses from client data
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

        /* Header with CODICE 1% Logo and Company Info - Professional Layout */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }

        .logo { 
          background: #000;
          color: white; 
          padding: 20px; 
          font-weight: 700; 
          text-align: center;
          width: 140px;
          height: 90px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-radius: 4px;
        }
        .logo div:first-child { 
          font-size: 18px; 
          line-height: 1;
          letter-spacing: 0.05em;
        }
        .logo div:last-child { 
          font-size: 36px; 
          line-height: 1;
          margin-top: 4px;
          font-weight: 800;
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

        /* Contract Title */
        .contract-title {
          font-weight: 700;
          font-size: 24px;
          margin-bottom: 32px;
          color: #111827;
          text-align: center;
          letter-spacing: -0.02em;
        }

        /* Client Data Table - Professional Design */
        .client-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 32px; 
          border: 1px solid #d1d5db;
          font-size: 10pt;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

        /* Payment Plan - Modern Professional Style */
        .payment-plan {
          border: 2px solid #3b82f6;
          border-radius: 8px;
          padding: 20px;
          margin: 32px 0;
          background-color: #f0f9ff;
        }

        .payment-plan .title {
          font-weight: 600;
          margin-bottom: 12px;
          color: #1e40af;
          font-size: 11pt;
        }

        .payment-plan ul {
          margin: 0;
          padding-left: 20px;
          list-style-type: none;
        }

        .payment-plan li {
          margin-bottom: 8px;
          position: relative;
          padding-left: 20px;
          color: #374151;
        }

        .payment-plan li:before {
          content: "▸";
          position: absolute;
          left: 0;
          color: #3b82f6;
          font-weight: 600;
        }

        /* Additional Payment Text */
        .payment-text {
          margin: 32px 0;
          text-align: justify;
          line-height: 1.7;
          color: #374151;
        }

        /* Bonuses - Professional Card Design */
        .bonus-section {
          margin: 32px 0;
        }

        .bonus-item {
          margin-bottom: 20px;
          padding: 20px;
          border-left: 4px solid #10b981;
          background-color: #f0fdf4;
          border-radius: 0 8px 8px 0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .bonus-title {
          font-weight: 600;
          color: #065f46;
          margin-bottom: 10px;
          font-size: 11pt;
        }

        .bonus-description {
          font-size: 10pt;
          line-height: 1.6;
          margin: 0;
          color: #374151;
        }

        /* Declaration and Signatures */
        .declaration {
          margin: 32px 0;
          page-break-inside: avoid;
        }

        .declaration .title {
          font-weight: 600;
          margin-bottom: 12px;
          font-size: 11pt;
          color: #111827;
        }

        .declaration ul {
          padding-left: 20px;
          margin-bottom: 20px;
          color: #374151;
        }

        .declaration li {
          margin-bottom: 6px;
        }

        .signature-section {
          margin: 40px 0;
          page-break-inside: avoid;
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
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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

        /* Privacy Consents */
        .privacy-section {
          margin: 40px 0;
          page-break-inside: avoid;
          background-color: #f9fafb;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .privacy-item {
          margin-bottom: 28px;
          page-break-inside: avoid;
        }

        .privacy-title {
          font-weight: 600;
          margin-bottom: 12px;
          font-size: 11pt;
          color: #111827;
        }

        .privacy-text {
          margin-bottom: 12px;
          line-height: 1.7;
          color: #374151;
          text-align: justify;
        }

        .consent-label {
          font-weight: 600;
          color: #111827;
          display: inline-block;
          margin-top: 8px;
        }

        /* Prevent orphans and widows */
        * {
          orphans: 3;
          widows: 3;
        }

        /* Ensure sections don't break across pages */
        .bonus-item,
        .payment-plan,
        .client-table,
        .privacy-section,
        .signature-section {
          page-break-inside: avoid;
        }

        /* Better spacing between major sections */
        .payment-text {
          page-break-inside: avoid;
          margin: 32px 0;
        }

        /* Custom content formatting */
        .custom-content-section {
          margin: 32px 0;
        }

        .custom-content-section p {
          margin-bottom: 16px;
          text-align: justify;
          line-height: 1.7;
          color: #374151;
        }

        .custom-content-section ul,
        .custom-content-section ol {
          margin: 16px 0;
          padding-left: 24px;
        }

        .custom-content-section li {
          margin-bottom: 8px;
          color: #374151;
        }

        .custom-content-section strong {
          font-weight: 600;
          color: #111827;
        }

        .custom-content-section em {
          font-style: italic;
        }

        .custom-content-section h1,
        .custom-content-section h2,
        .custom-content-section h3 {
          font-weight: 700;
          margin: 24px 0 12px 0;
          color: #111827;
        }

        .custom-content-section h1 { font-size: 20px; }
        .custom-content-section h2 { font-size: 18px; }
        .custom-content-section h3 { font-size: 16px; }

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
        .section-header.validity { border-left-color: #f59e0b; }

        .section-card {
          padding: 20px;
          border-radius: 12px;
          margin: 16px 0 32px 0;
          page-break-inside: avoid;
        }

        .section-card.blue { background-color: #eff6ff; border: 1px solid #bfdbfe; }
        .section-card.amber { background-color: #fffbeb; border: 1px solid #fde68a; }
        .section-card.green { background-color: #f0fdf4; border: 1px solid #bbf7d0; }
        .section-card.violet { background-color: #f5f3ff; border: 1px solid #ddd6fe; }
      </style>
    </head>
    <body>
      <!-- Header with Logo and Company Info -->
      <div class="header">
        ${company.logoUrl ? 
          `<img src="${company.logoUrl}" alt="Logo" style="max-width: 120px; max-height: 80px; object-fit: contain;" />` :
          `<div class="logo">
            <div>CODICE</div>
            <div>1%</div>
          </div>`
        }
        <div class="company-info">
          <div class="company-name">${company.companyName || 'ALE srl'}</div>
          <div>${company.address || ', 39'} Cap ${company.postalCode || '20143'} ${company.city || 'Capo dorlando'} (MI)</div>
          <div>C.F. e P.I. ${company.taxId || '0000000000'}</div>
          <div>Codice univoco: ${company.uniqueCode || 'M5UXCR1'}</div>
          <div>Pec: ${company.pec || 'ALE@casellapec.com'}</div>
        </div>
      </div>

      <!-- Contract Title -->
      <div class="contract-title">
        ${contractData.template?.name || contractData.templateName || company.contractTitle || 'Contratto FAST TRACK VENDITE'}
      </div>

      <!-- Client Data Table -->
      <h2 class="section-header commercial">Dati del Cliente / Committente</h2>
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
          <td colspan="2" class="full-width">In persona del suo legale rappresentante p.t.</td>
        </tr>
        <tr>
          <td ><strong>Signor./a.</strong> ${client.cliente_nome || ''}</td>
          <td ><strong>Nato a</strong> ${client.nato_a || ''}</td>
        </tr>
        <tr>
          <td ><strong>Data di nascita</strong> ${client.data_nascita ? new Date(client.data_nascita).toLocaleDateString('it-IT') : ''}</td>
          <td ><strong>Residente a</strong> ${client.residente_a || ''}</td>
        </tr>
        <tr>
          <td colspan="2" class="full-width"><strong>Indirizzo di residenza:</strong> ${client.indirizzo_residenza || ''}</td>
        </tr>
      </table>

      <!-- Payment Section - Show partnership model OR payment plan OR template text -->
      <h2 class="section-header payment">Piano Economico</h2>
      ${contractData.isPercentagePartnership && contractData.partnershipPercentage ? `
      <div class="payment-plan" style="background-color: #fef3c7; border: 3px solid #f59e0b; border-radius: 12px; padding: 24px; margin: 24px 0; page-break-inside: avoid;">
        <div class="title" style="color: #92400e; text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 16px;">
          🤝 MODELLO DI PARTNERSHIP
        </div>
        <div style="text-align: center; margin-bottom: 20px; padding: 12px; background-color: #fbbf24; border-radius: 8px;">
          <span style="font-size: 18px; font-weight: bold; color: #78350f;">
            Percentuale: ${contractData.partnershipPercentage}% sul fatturato TOTALE
          </span>
        </div>

        <div style="margin-top: 20px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #92400e; border-bottom: 2px solid #f59e0b; padding-bottom: 4px;">📊 DEFINIZIONE DI FATTURATO TOTALE</h4>
          <p style="font-size: 13px; line-height: 1.6; margin-bottom: 10px;">Per "fatturato TOTALE" si intende la somma di tutti i ricavi lordi generati dall'attività, comprensivi di:</p>
          <ul style="font-size: 13px; margin: 10px 0; padding-left: 20px; line-height: 1.6;">
            <li>Vendite di cibo e bevande</li>
            <li>Servizi di catering e delivery</li>
            <li>Eventi privati e prenotazioni speciali</li>
            <li>Qualsiasi altro ricavo direttamente collegato all'attività</li>
          </ul>

          <h4 style="font-size: 15px; font-weight: 600; margin: 20px 0 12px 0; color: #92400e; border-bottom: 2px solid #f59e0b; padding-bottom: 4px;">💰 MODALITÀ DI CALCOLO E PAGAMENTO</h4>
          <p style="font-size: 13px; line-height: 1.6; margin-bottom: 12px;">Il pagamento della percentuale sarà calcolato mensilmente sul fatturato TOTALE del mese precedente e dovrà essere corrisposto entro il 15 del mese successivo tramite bonifico bancario.</p>

          <h4 style="font-size: 15px; font-weight: 600; margin: 20px 0 12px 0; color: #92400e; border-bottom: 2px solid #f59e0b; padding-bottom: 4px;">📋 TRASPARENZA E RENDICONTAZIONE</h4>
          <p style="font-size: 13px; line-height: 1.6; margin-bottom: 10px;">Il Cliente si impegna a fornire mensilmente la documentazione contabile necessaria per il calcolo della percentuale dovuta, inclusi:</p>
          <ul style="font-size: 13px; margin: 10px 0; padding-left: 20px; line-height: 1.6;">
            <li>Estratti conto del registratore di cassa o POS</li>
            <li>Fatture emesse nel periodo di riferimento</li>
            <li>Dichiarazioni IVA periodiche</li>
            <li>Report di fatturato certificati dal commercialista</li>
          </ul>

          <h4 style="font-size: 15px; font-weight: 600; margin: 20px 0 12px 0; color: #92400e; border-bottom: 2px solid #f59e0b; padding-bottom: 4px;">⚠️ PENALI PER RITARDATO PAGAMENTO</h4>
          <p style="font-size: 13px; line-height: 1.6; margin-bottom: 12px;">In caso di ritardo nel pagamento della percentuale dovuta, saranno applicate penali pari al 2% dell'importo dovuto per ogni mese di ritardo, oltre agli interessi legali.</p>

          <div style="background-color: #fee2e2; border: 2px solid #fca5a5; border-radius: 8px; padding: 16px; margin-top: 20px;">
            <p style="font-size: 14px; color: #991b1b; margin: 0; font-weight: bold; text-align: center;">
              ⚡ IMPORTANTE: Questo modello di partnership sostituisce qualsiasi piano di pagamento fisso. Il compenso sarà calcolato esclusivamente come percentuale del fatturato totale.
            </p>
          </div>
        </div>
        </div>

        <div style="margin-top: 16px;">
          <h4 style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #92400e;">MODALITÀ DI PAGAMENTO</h4>
          <ul style="font-size: 12px;">
            <li>Comunicazione mensile del fatturato entro il giorno 5 del mese successivo</li>
            <li>Versamento della percentuale concordata entro il giorno 15 del mese successivo</li>
            <li>Documentazione contabile a supporto dei dati comunicati</li>
          </ul>
        </div>
      </div>
      ` : paymentPlan.length > 0 ? `
      <div class="payment-plan">
        <div class="title">Il prezzo totale di ${paymentPlan.reduce((sum: number, payment: any) => sum + parseFloat(payment.rata_importo), 0).toFixed(2)} EUR + IVA sarà corrisposto con le seguenti modalità:</div>
        <ul>
          ${paymentPlan.map((payment: any, index: number) => `
            <li>
              Pagamento ${index + 1} di EUR ${payment.rata_importo} + IVA entro il ${payment.rata_scadenza}
            </li>
          `).join('')}
        </ul>
      </div>
      ` : contractData.template?.paymentText ? `
      <div class="payment-text">
        <p style="margin-bottom: 16px;">${contractData.template.paymentText}</p>
      </div>
      ` : ''}

      <!-- Custom Content Section -->
      ${contractData.template?.customContent ? '<h2 class="section-header commercial">Contenuto Personalizzato</h2>' : ''}
      ${contractData.template?.customContent ? `
      <div class="custom-content-section">
        ${contractData.template.customContent}
      </div>
      ` : ''}

      <!-- Bonuses -->
      ${bonusList.length > 0 ? '<h2 class="section-header bonus">Bonus Inclusi</h2>' : ''}
      ${bonusList.length > 0 ? `
      <div class="bonus-section">
        ${bonusList.map((bonus: any, index: number) => `
          <div class="bonus-item">
            <p class="bonus-title">BONUS #${index + 1}</p>
            <p class="bonus-description">${bonus.bonus_descrizione}</p>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Contract Validity Period -->
      <h2 class="section-header validity">Validità del Contratto</h2>
      <div class="section-card blue" style="text-align: center;">
        <p style="font-size: 12pt; color: #1e40af; font-weight: 500;">
          ${contractData.contractStartDate && contractData.contractEndDate ? 
            `Il presente contratto ha validità dal ${formatDateSafe(contractData.contractStartDate)} al ${formatDateSafe(contractData.contractEndDate)}` :
            `Il presente contratto ha validità dal ${formatDateSafe(contractData.createdAt || new Date())} al ${formatDateSafe(new Date(new Date(contractData.createdAt || new Date()).getTime() + 365 * 24 * 60 * 60 * 1000))}`
          }
        </p>
      </div>

      <!-- Auto Renewal Section - Always Active -->
      <h2 class="section-header legal">Clausola di Autorinnovo</h2>
      <div class="section-card green">
        <p style="text-align: justify; line-height: 1.6; margin-bottom: 12px;">
          <strong>Il presente contratto si rinnoverà automaticamente per ulteriori ${contractData.renewalDuration || 12} mesi</strong> alle stesse condizioni economiche e contrattuali, salvo disdetta da comunicarsi da una delle parti all'altra con preavviso di almeno 30 (trenta) giorni prima della scadenza mediante raccomandata A/R o PEC.
        </p>
        <p style="text-align: justify; line-height: 1.6; margin-bottom: 12px;">
          In caso di mancata disdetta nei termini sopra indicati, il contratto si intenderà automaticamente rinnovato per un periodo pari a ${contractData.renewalDuration || 12} mesi, alle medesime condizioni del contratto originario.
        </p>
        <p style="text-align: justify; line-height: 1.6; font-size: 10pt; color: #6b7280;">
          <em>Questa clausola è stata specificatamente accettata dal Cliente al momento della sottoscrizione del presente contratto.</em>
        </p>
      </div>

      <!-- Unica sezione firma -->
      <h2 class="section-header legal">Dichiarazioni e Firma</h2>
      <div class="privacy-section" style="page-break-before: auto; margin-top: 40px;">
        <div class="privacy-item" style="page-break-inside: avoid;">
          <p class="privacy-title">Consenso per informazioni commerciali e attività promozionali.</p>
          <p class="privacy-text">Presa visione dell'informativa generale allegata, consento che i miei dati anagrafici siano utilizzati dalle Società e/o comunicati a terzi che svolgono attività commerciali e promozionali per finalità di marketing effettuate anche al telefono, ivi compreso l'invio di materiale illustrativo relativo ai servizi e ai prodotti commercializzati.</p>
          <p class="consent-label" style="margin-bottom: 16px;">Consenso</p>

          <div class="signature-section" style="page-break-inside: avoid;">
            <p style="margin-bottom: 16px;">Data ${new Date().toLocaleDateString('it-IT')} Luogo Milano <strong>firma Cliente/Committente</strong></p>
            <div class="signature-area" style="page-break-inside: avoid; min-height: 100px;">
              ${contractData.status === 'signed' && contractData.signatures?.marketing ? 
                (contractData.signatures.marketing.startsWith('data:image') ? 
                  `<img src="${contractData.signatures.marketing}" alt="Firma marketing" class="signature-image" style="max-height: 80px; border: 1px solid #ccc;" />` :
                  `<div class="signature-text" style="font-family: 'Brush Script MT', cursive; font-size: 28px; color: #1f2937; font-weight: bold; padding: 8px;">${contractData.signatures.marketing}</div>`
                ) :
                `<div class="signature-placeholder">
                  <div>✒️ Firma del cliente</div>
                  <div style="font-size: 12px; margin-top: 4px;">Area firma digitale</div>
                </div>`
              }
            </div>
          </div>
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