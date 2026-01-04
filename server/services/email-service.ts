import * as tls from 'tls';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { Contract } from '@shared/schema';
import { generatePDF } from "./pdf-generator-new";
import { storage } from "../storage";
import nodemailer from 'nodemailer';


// Native SMTP implementation without nodemailer
class SMTPClient {
  private socket: tls.TLSSocket | null = null;
  private host: string;
  private port: number;
  private user: string;
  private pass: string;

  constructor(host: string, port: number, user: string, pass: string) {
    this.host = host;
    this.port = port;
    this.user = user;
    this.pass = pass;
  }

  private async sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 10000);

      const onData = (data: Buffer) => {
        clearTimeout(timeout);
        this.socket!.off('data', onData);
        resolve(data.toString());
      };

      this.socket.on('data', onData);
      this.socket.write(command + '\r\n');
    });
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: this.host,
        port: this.port,
        rejectUnauthorized: false
      }, () => {
        this.socket = socket;
        resolve();
      });

      socket.on('error', reject);
    });
  }

  async sendMail(from: string, to: string, subject: string, htmlBody: string): Promise<void> {
    try {
      console.log('🔗 Connessione al server SMTP...');
      await this.connect();

      // Wait for welcome message
      await this.sendCommand('');

      console.log('👋 Invio EHLO...');
      await this.sendCommand(`EHLO ${this.host}`);

      console.log('🔐 Autenticazione...');
      await this.sendCommand('AUTH LOGIN');
      await this.sendCommand(Buffer.from(this.user).toString('base64'));
      await this.sendCommand(Buffer.from(this.pass).toString('base64'));

      console.log('📧 Configurazione mittente...');
      await this.sendCommand(`MAIL FROM:<${from}>`);

      console.log('📧 Configurazione destinatario...');
      await this.sendCommand(`RCPT TO:<${to}>`);

      console.log('📝 Invio contenuto...');
      await this.sendCommand('DATA');

      const emailContent = [
        `From: "Turbo Contract" <${from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        htmlBody,
        '.'
      ].join('\r\n');

      await this.sendCommand(emailContent);
      await this.sendCommand('QUIT');

      console.log('✅ Email inviata con successo!');
    } catch (error) {
      console.error('❌ Errore SMTP:', error);
      throw error;
    } finally {
      if (this.socket) {
        this.socket.end();
      }
    }
  }

  async sendMailWithAttachment(from: string, to: string, subject: string, htmlBody: string, attachmentPath?: string, attachmentName?: string): Promise<void> {
    try {
      console.log('🔗 Connessione al server SMTP...');
      await this.connect();

      // Wait for welcome message
      await this.sendCommand('');

      console.log('👋 Invio EHLO...');
      await this.sendCommand(`EHLO ${this.host}`);

      console.log('🔐 Autenticazione...');
      await this.sendCommand('AUTH LOGIN');
      await this.sendCommand(Buffer.from(this.user).toString('base64'));
      await this.sendCommand(Buffer.from(this.pass).toString('base64'));

      console.log('📧 Configurazione mittente...');
      await this.sendCommand(`MAIL FROM:<${from}>`);

      console.log('📧 Configurazione destinatario...');
      await this.sendCommand(`RCPT TO:<${to}>`);

      console.log('📝 Invio contenuto...');
      await this.sendCommand('DATA');

      const boundary = `----=_NextPart_${Date.now()}`;
      let emailContent = [
        `From: "Turbo Contract" <${from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        htmlBody,
        ''
      ];

      // Add PDF attachment if provided and exists
      if (attachmentPath && attachmentName) {
        console.log('🔍 Tentativo allegato PDF:');
        console.log('  - attachmentPath ricevuto:', attachmentPath);
        console.log('  - attachmentName:', attachmentName);

        try {
          let pdfPath = attachmentPath;

          // Handle path resolution like in the PDF download route
          if (!path.isAbsolute(pdfPath)) {
            if (!pdfPath.includes('/')) {
              pdfPath = path.join(process.cwd(), 'generated-pdfs', pdfPath);
            } else {
              pdfPath = path.resolve(pdfPath);
            }
          }

          console.log('  - pdfPath risolto:', pdfPath);
          console.log('  - File esiste?', fs.existsSync(pdfPath));

          if (fs.existsSync(pdfPath)) {
            console.log('📎 Aggiunta allegato PDF:', pdfPath);
            const pdfContent = fs.readFileSync(pdfPath);
            const pdfSize = pdfContent.length;
            console.log('  - Dimensione PDF:', pdfSize, 'bytes');

            const base64Content = pdfContent.toString('base64');
            console.log('  - Dimensione base64:', base64Content.length, 'caratteri');

            emailContent.push(
              `--${boundary}`,
              'Content-Type: application/pdf',
              `Content-Disposition: attachment; filename="${attachmentName}"`,
              'Content-Transfer-Encoding: base64',
              '',
              base64Content,
              ''
            );
            console.log('✅ Allegato PDF aggiunto correttamente');
          } else {
            console.warn('⚠️ File PDF non trovato:', pdfPath);
            console.log('  - Directory corrente:', process.cwd());
            console.log('  - Directory generated-pdfs esiste?', fs.existsSync(path.join(process.cwd(), 'generated-pdfs')));
          }
        } catch (pdfError) {
          console.error('❌ Errore lettura PDF:', pdfError);
          console.error('  - Stack:', pdfError.stack);
        }
      } else {
        console.warn('⚠️ Nessun allegato PDF da aggiungere');
        console.log('  - attachmentPath:', attachmentPath);
        console.log('  - attachmentName:', attachmentName);
      }

      emailContent.push(`--${boundary}--`, '.');

      await this.sendCommand(emailContent.join('\r\n'));
      await this.sendCommand('QUIT');

      console.log('✅ Email con allegato inviata con successo!');
    } catch (error) {
      console.error('❌ Errore SMTP:', error);
      throw error;
    } finally {
      if (this.socket) {
        this.socket.end();
      }
    }
  }
}

export async function sendContractEmail(contract: Contract, contractCode: string, emailTo?: string): Promise<void> {
  console.log('🔄 Tentativo di invio email...');

  const clientData = contract.clientData as any;
  const clientEmail = emailTo || clientData.email;
  const clientName = clientData.cliente_nome || clientData.nome || 'Cliente';

  console.log('📧 Email destinatario:', clientEmail);
  console.log('👤 Nome cliente:', clientName);
  console.log('📋 Codice contratto:', contractCode);

  // Verifica configurazione SMTP
  console.log('⚙️ Configurazione SMTP:');
  console.log('  - SMTP_HOST:', process.env.SMTP_HOST);
  console.log('  - SMTP_PORT:', process.env.SMTP_PORT);
  console.log('  - SMTP_SECURE:', process.env.SMTP_SECURE);
  console.log('  - SMTP_USER:', process.env.SMTP_USER ? '✅ Configurato' : '❌ Mancante');
  console.log('  - SMTP_PASS:', process.env.SMTP_PASS ? '✅ Configurato' : '❌ Mancante');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Credenziali SMTP mancanti! Email non può essere inviata.');
    throw new Error('SMTP credentials missing');
  }

  if (!clientEmail) {
    console.error('❌ Email destinatario mancante!');
    throw new Error('Recipient email missing');
  }

  // Generate contract viewing URL - use BASE_URL or DEV_URL from environment or fallback
  const baseUrl = (process.env.BASE_URL || process.env.DEV_URL) 
    ? (process.env.BASE_URL || process.env.DEV_URL)!.replace(/\/$/, '') // Remove trailing slash if present
    : (process.env.NODE_ENV === 'production' 
        ? `https://${process.env.REPL_SLUG || 'workspace'}.${process.env.REPL_OWNER || 'yirok79246'}.repl.co`
        : 'http://localhost:5000');

  const contractUrl = `${baseUrl}/client/${contractCode}?email=${encodeURIComponent(clientEmail)}`;
  console.log(`🔗 URL contratto: ${contractUrl}`);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { 
          display: inline-block; 
          background-color: #3B82F6; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0;
        }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Turbo Contract</h1>
          <p>Sistema di Gestione Contratti</p>
        </div>

        <div class="content">
          <h2>Ciao ${clientName},</h2>

          <p>Hai ricevuto un nuovo contratto da firmare. Per procedere alla visualizzazione e alla firma elettronica, clicca sul pulsante qui sotto:</p>

          <div style="text-align: center;">
            <a href="${contractUrl}" class="button">Visualizza e Firma Contratto</a>
          </div>

          <p><strong>Codice Contratto:</strong> ${contractCode}</p>

          <p>Il processo di firma è completamente digitale e legalmente valido. Ti verrà richiesto di:</p>
          <ul>
            <li>Visualizzare il documento completo</li>
            <li>Confermare il tuo numero di telefono</li>
            <li>Inserire il codice OTP ricevuto via SMS</li>
            <li>Apporre la firma elettronica</li>
          </ul>

          <p><em>Questo link è personale e sicuro. Non condividerlo con altre persone.</em></p>
        </div>

        <div class="footer">
          <p>© 2024 Turbo Contract. Tutti i diritti riservati.</p>
          <p>Questa email è stata generata automaticamente dal sistema.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  console.log('📤 Tentativo di invio in corso...');

  try {
    const smtpClient = new SMTPClient(
      process.env.SMTP_HOST || 'smtp.gmail.com',
      parseInt(process.env.SMTP_PORT || '465'),
      process.env.SMTP_USER!,
      process.env.SMTP_PASS!
    );

    await smtpClient.sendMail(
      process.env.SMTP_USER!,
      clientEmail,
      'Nuovo Contratto da Firmare - Turbo Contract',
      htmlContent
    );

    console.log('✅ Email inviata con successo!');
    console.log('👤 Destinatario:', clientEmail);
  } catch (error: any) {
    console.error('❌ ERRORE nell\'invio email:');
    console.error('  - Messaggio:', error.message);
    console.error('  - Stack completo:', error.stack);

    throw new Error(`Failed to send contract email: ${error.message}`);
  }
}

export async function sendOTPEmail(email: string, otpCode: string): Promise<void> {
  console.log('🔐 Tentativo di invio OTP via email...');
  console.log('📧 Email destinatario OTP:', email);
  console.log('🔢 Codice OTP:', otpCode);

  // Verifica configurazione SMTP
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Credenziali SMTP mancanti! OTP email non può essere inviata.');
    throw new Error('SMTP credentials missing');
  }

  if (!email) {
    console.error('❌ Email destinatario mancante!');
    throw new Error('Recipient email missing');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; text-align: center; }
        .otp-code { 
          display: inline-block; 
          background-color: #F3F4F6; 
          color: #1F2937; 
          padding: 20px 30px; 
          font-size: 32px; 
          font-weight: bold; 
          letter-spacing: 8px; 
          border-radius: 10px; 
          margin: 20px 0;
          border: 2px dashed #3B82F6;
        }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .warning { background-color: #FEF3C7; color: #92400E; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Codice di Verifica</h1>
          <p>Turbo Contract</p>
        </div>

        <div class="content">
          <h2>Il tuo codice OTP</h2>

          <p>Utilizza il seguente codice per completare la firma del contratto:</p>

          <div class="otp-code">${otpCode}</div>

          <div class="warning">
            <strong>⏰ Importante:</strong> Questo codice è valido per 10 minuti e può essere utilizzato una sola volta.
          </div>

          <p><small>Se non hai richiesto questo codice, ignora questa email.</small></p>
        </div>

        <div class="footer">
          <p>© 2024 Turbo Contract. Tutti i diritti riservati.</p>
          <p>Questa email è stata generata automaticamente dal sistema.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const smtpClient = new SMTPClient(
      process.env.SMTP_HOST || 'smtp.gmail.com',
      parseInt(process.env.SMTP_PORT || '465'),
      process.env.SMTP_USER!,
      process.env.SMTP_PASS!
    );

    await smtpClient.sendMail(
      process.env.SMTP_USER!,
      email,
      'Codice di Verifica OTP - Turbo Contract',
      htmlContent
    );

    console.log('✅ Email OTP inviata con successo!');
    console.log('👤 Destinatario:', email);
  } catch (error: any) {
    console.error('❌ ERRORE nell\'invio email OTP:');
    console.error('  - Messaggio:', error.message);
    console.error('  - Stack completo:', error.stack);

    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
}

export async function sendContractSignedNotification(contract: Contract): Promise<void> {
  console.log('🎉 Tentativo di invio notifica firma contratto...');

  const clientData = contract.clientData as any;
  const clientEmail = contract.sentToEmail || clientData.email;
  const clientName = clientData.cliente_nome || clientData.nome || 'Cliente';

  console.log('📧 Email destinatario notifica:', clientEmail);
  console.log('👤 Nome cliente:', clientName);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Contratto Firmato</h1>
          <p>Turbo Contract</p>
        </div>

        <div class="content">
          <div class="success-icon">🎉</div>

          <h2>Complimenti ${clientName}!</h2>

          <p>Il tuo contratto è stato firmato con successo e tutte le procedure legali sono state completate.</p>

          <p><strong>Dettagli della firma:</strong></p>
          <ul>
            <li>Data e ora: ${new Date().toLocaleString('it-IT')}</li>
            <li>Metodo: Firma Elettronica Avanzata</li>
            <li>Conformità: Standard eIDAS</li>
          </ul>

          <p>Il documento firmato e sigillato digitalmente è allegato a questa email e sarà conservato in modo sicuro nei nostri archivi.</p>

          <p><em>Grazie per aver utilizzato Turbo Contract!</em></p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const smtpClient = new SMTPClient(
      process.env.SMTP_HOST || 'smtp.gmail.com',
      parseInt(process.env.SMTP_PORT || '465'),
      process.env.SMTP_USER!,
      process.env.SMTP_PASS!
    );

    // Use the final PDF that was already generated with audit trail
      console.log('📄 Utilizzo PDF finale già generato con audit trail...');
      const pdfPath = contract.pdfPath;
      console.log('📄 Path PDF finale:', pdfPath);

    await smtpClient.sendMailWithAttachment(
      process.env.SMTP_USER!,
      clientEmail,
      'Contratto Firmato con Successo - Turbo Contract',
      htmlContent,
      pdfPath,
      `contratto-firmato-${contract.contractCode}.pdf`
    );

    console.log('✅ Notifica firma inviata con successo!');
    console.log('👤 Destinatario:', clientEmail);
  } catch (error: any) {
    console.error('❌ ERRORE nell\'invio notifica firma:');
    console.error('  - Messaggio:', error.message);
    console.error('  - Stack:', error.stack);
  }
}