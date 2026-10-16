import twilio from 'twilio';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
}

class TwilioVerifyService {
  private client: twilio.Twilio | null = null;
  private config: TwilioConfig | null = null;

  constructor() {
    // Non inizializzare automaticamente - verrà fatto con le impostazioni del database
  }

  private initializeConfig(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.log('[TWILIO] ⚠️ Credenziali Twilio Verify mancanti dalle variabili d\'ambiente');
      return;
    }

    this.config = { accountSid, authToken, verifyServiceSid };
    this.client = twilio(accountSid, authToken);
    console.log('[TWILIO] ✅ Servizio Twilio Verify inizializzato da variabili d\'ambiente');
  }

  public initializeWithDatabaseSettings(accountSid: string, authToken: string, verifyServiceSid: string): void {
    if (!accountSid || !authToken || !verifyServiceSid) {
      console.log('[TWILIO] ⚠️ Credenziali Twilio Verify mancanti dalle impostazioni database');
      return;
    }

    this.config = { accountSid, authToken, verifyServiceSid };
    this.client = twilio(accountSid, authToken);
    console.log('[TWILIO] ✅ Servizio Twilio Verify inizializzato da database');
  }

  public isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  public async sendVerificationCode(phoneNumber: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Twilio Verify service not configured. Please check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID environment variables.');
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      console.log(`[TWILIO] 📱 Invio codice di verifica a: ${formattedPhone}`);

      const verification = await this.client!.verify.v2
        .services(this.config!.verifyServiceSid)
        .verifications.create({
          to: formattedPhone,
          channel: 'sms'
        });

      console.log(`[TWILIO] ✅ Codice di verifica inviato! SID: ${verification.sid}`);
      console.log(`[TWILIO] 📊 Status: ${verification.status}`);
      
      return verification.sid;
    } catch (error: any) {
      console.error('[TWILIO] ❌ Errore nell\'invio del codice di verifica:', error);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }
  }

  public async verifyCode(phoneNumber: string, code: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Twilio Verify service not configured.');
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      console.log(`[TWILIO] 🔍 Verifica codice per: ${formattedPhone}`);

      const verificationCheck = await this.client!.verify.v2
        .services(this.config!.verifyServiceSid)
        .verificationChecks.create({
          to: formattedPhone,
          code: code
        });

      console.log(`[TWILIO] 📊 Risultato verifica: ${verificationCheck.status}`);
      
      return verificationCheck.status === 'approved';
    } catch (error: any) {
      console.error('[TWILIO] ❌ Errore nella verifica del codice:', error);
      return false;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Rimuovi spazi, trattini e altri caratteri non numerici
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Se non inizia con +, aggiungi +39 per l'Italia
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('39')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.startsWith('3')) {
        // Numero italiano che inizia con 3 (cellulare)
        cleaned = '+39' + cleaned;
      } else {
        // Aggiungi +39 di default per numeri italiani
        cleaned = '+39' + cleaned;
      }
    }
    
    return cleaned;
  }
}

// Crea un'istanza singleton del servizio
export const twilioVerifyService = new TwilioVerifyService();

// Funzione helper per inviare OTP via Twilio Verify
export async function sendOTPSMS(phoneNumber: string, companySettings?: any, customOtpCode?: string): Promise<void> {
  console.log('[TWILIO] 🔐 Tentativo di invio OTP via Twilio Verify...');
  console.log('[TWILIO] 📱 Numero destinatario:', phoneNumber);

  // Prova prima le impostazioni del database, poi le variabili d'ambiente
  if (companySettings?.twilioAccountSid && companySettings?.twilioAuthToken && companySettings?.twilioVerifyServiceSid) {
    console.log('[TWILIO] 🗄️ Uso credenziali dal database...');
    twilioVerifyService.initializeWithDatabaseSettings(
      companySettings.twilioAccountSid,
      companySettings.twilioAuthToken,
      companySettings.twilioVerifyServiceSid
    );
  } else {
    console.log('[TWILIO] 🔧 Fallback a variabili d\'ambiente...');
    // Fallback a variabili d'ambiente solo se non configurate nel database
    if (!twilioVerifyService.isConfigured()) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

      if (accountSid && authToken && verifyServiceSid) {
        twilioVerifyService.initializeWithDatabaseSettings(accountSid, authToken, verifyServiceSid);
      }
    }
  }

  if (!twilioVerifyService.isConfigured()) {
    console.error('[TWILIO] ❌ Servizio Twilio Verify non configurato!');
    throw new Error('SMS service not configured. Please check Twilio Verify credentials.');
  }

  try {
    // Con Twilio Verify, il codice viene generato automaticamente
    // Ignoriamo il customOtpCode perché Verify gestisce tutto internamente
    await twilioVerifyService.sendVerificationCode(phoneNumber);
    console.log('[TWILIO] ✅ Codice di verifica Twilio inviato con successo!');
  } catch (error) {
    console.error('[TWILIO] ❌ Fallimento nell\'invio del codice di verifica:', error);
    throw error;
  }
}

// Funzione helper per verificare OTP via Twilio Verify
export async function verifyOTPSMS(phoneNumber: string, code: string, companySettings?: any): Promise<boolean> {
  console.log('[TWILIO] 🔍 Verifica OTP via Twilio Verify...');
  console.log('[TWILIO] 📱 Numero:', phoneNumber);
  console.log('[TWILIO] 🔢 Codice:', code);

  // Prova prima le impostazioni del database, poi le variabili d'ambiente
  if (companySettings?.twilioAccountSid && companySettings?.twilioAuthToken && companySettings?.twilioVerifyServiceSid) {
    console.log('[TWILIO] 🗄️ Uso credenziali dal database per verifica...');
    twilioVerifyService.initializeWithDatabaseSettings(
      companySettings.twilioAccountSid,
      companySettings.twilioAuthToken,
      companySettings.twilioVerifyServiceSid
    );
  } else {
    console.log('[TWILIO] 🔧 Fallback a variabili d\'ambiente per verifica...');
    if (!twilioVerifyService.isConfigured()) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

      if (accountSid && authToken && verifyServiceSid) {
        twilioVerifyService.initializeWithDatabaseSettings(accountSid, authToken, verifyServiceSid);
      }
    }
  }

  if (!twilioVerifyService.isConfigured()) {
    console.error('[TWILIO] ❌ Servizio Twilio Verify non configurato!');
    return false;
  }

  try {
    const isValid = await twilioVerifyService.verifyCode(phoneNumber, code);
    console.log(`[TWILIO] ${isValid ? '✅' : '❌'} Risultato verifica: ${isValid ? 'VALIDO' : 'NON VALIDO'}`);
    return isValid;
  } catch (error) {
    console.error('[TWILIO] ❌ Errore nella verifica OTP:', error);
    return false;
  }
}

// Funzione per inviare messaggi WhatsApp tramite Twilio
/** Credenziali WhatsApp dell'azienda (mai quelle globali del server). */
export interface CompanyWhatsAppSettings {
  companyName?: string | null;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioWhatsappFrom?: string | null;
}

export function isCompanyWhatsAppConfigured(settings?: CompanyWhatsAppSettings | null): boolean {
  return !!(settings?.twilioAccountSid?.trim() && settings?.twilioAuthToken?.trim() && settings?.twilioWhatsappFrom?.trim());
}

export async function sendWhatsAppMessage(phoneNumber: string, message: string, settings: CompanyWhatsAppSettings): Promise<void> {
  if (!isCompanyWhatsAppConfigured(settings)) {
    throw new Error("WhatsApp non configurato per questa azienda (Account SID, Auth Token e mittente WhatsApp nelle impostazioni azienda).");
  }
  const whatsappFrom = settings.twilioWhatsappFrom!.trim();
  const from = whatsappFrom.startsWith("whatsapp:") ? whatsappFrom : `whatsapp:${whatsappFrom}`;
  try {
    const client = twilio(settings.twilioAccountSid!.trim(), settings.twilioAuthToken!.trim());
    const formattedPhone = formatPhoneNumberForWhatsApp(phoneNumber);
    const messageResponse = await client.messages.create({ body: message, from, to: formattedPhone });
    console.log(`[TWILIO] ✅ Messaggio WhatsApp inviato (SID ${messageResponse.sid}, stato ${messageResponse.status})`);
  } catch (error: any) {
    console.error("[TWILIO] ❌ Errore nell'invio del messaggio WhatsApp:", error?.message || error);
    throw new Error(`Failed to send WhatsApp message: ${error?.message || error}`);
  }
}

// Funzione helper per formattare il numero di telefono per WhatsApp
function formatPhoneNumberForWhatsApp(phoneNumber: string): string {
  // Rimuovi spazi, trattini e altri caratteri non numerici
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Se non inizia con +, aggiungi +39 per l'Italia
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('39')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('3')) {
      // Numero italiano che inizia con 3 (cellulare)
      cleaned = '+39' + cleaned;
    } else {
      // Aggiungi +39 di default per numeri italiani
      cleaned = '+39' + cleaned;
    }
  }
  
  // Formato WhatsApp: whatsapp:+numero
  return `whatsapp:${cleaned}`;
}

// Funzione helper per inviare messaggio di congratulazioni WhatsApp
export function buildSignedWhatsAppMessage(clientName: string, contractCode: string, companyName?: string | null): string {
  const from = companyName?.trim() ? ` con ${companyName.trim()}` : "";
  return `Gentile ${clientName}, ti confermiamo che il contratto ${contractCode}${from} è stato firmato. ` +
    `Riceverai la copia firmata all'indirizzo email indicato.\n\nMessaggio automatico: non rispondere a questo numero.`;
}

export async function sendCongratulationsWhatsApp(
  phoneNumber: string,
  clientName: string,
  contractCode: string,
  settings: CompanyWhatsAppSettings,
): Promise<void> {
  await sendWhatsAppMessage(phoneNumber, buildSignedWhatsAppMessage(clientName, contractCode, settings.companyName), settings);
}
