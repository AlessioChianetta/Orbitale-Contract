import twilio from 'twilio';

/**
 * OTP via SMS con Twilio Verify.
 *
 * Il client Twilio si crea a ogni chiamata con le credenziali dell'azienda
 * del contratto: niente istanza condivisa (con due aziende che inviano nello
 * stesso momento un singleton poteva usare le credenziali dell'altra).
 * Le credenziali globali del server (.env) appartengono al proprietario e si
 * usano solo per l'azienda proprietaria; ogni altra azienda senza Twilio
 * configurato riceve un errore esplicito.
 */
interface TwilioVerifyConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
}

export function resolveTwilioVerifyConfig(companySettings?: any): TwilioVerifyConfig | null {
  const sid = companySettings?.twilioAccountSid?.trim();
  const token = companySettings?.twilioAuthToken?.trim();
  const service = companySettings?.twilioVerifyServiceSid?.trim();
  if (sid && token && service) return { accountSid: sid, authToken: token, verifyServiceSid: service };
  if (companySettings?.isOwner === true) {
    const envSid = process.env.TWILIO_ACCOUNT_SID;
    const envToken = process.env.TWILIO_AUTH_TOKEN;
    const envService = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (envSid && envToken && envService) return { accountSid: envSid, authToken: envToken, verifyServiceSid: envService };
  }
  return null;
}

function formatPhoneNumber(phoneNumber: string): string {
  // Rimuovi spazi, trattini e altri caratteri non numerici
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  // Senza prefisso internazionale: numero italiano (+39)
  if (!cleaned.startsWith('+')) {
    cleaned = cleaned.startsWith('39') && cleaned.length > 10 ? '+' + cleaned : '+39' + cleaned;
  }
  return cleaned;
}

export async function sendOTPSMS(phoneNumber: string, companySettings?: any, _customOtpCode?: string): Promise<void> {
  const config = resolveTwilioVerifyConfig(companySettings);
  if (!config) {
    throw new Error("SMS non configurati per questa azienda: inserisci Account SID, Auth Token e Verify Service SID in Impostazioni Azienda oppure usa l'OTP via email.");
  }
  const client = twilio(config.accountSid, config.authToken);
  try {
    // Con Twilio Verify il codice lo genera Twilio.
    const verification = await client.verify.v2
      .services(config.verifyServiceSid)
      .verifications.create({ to: formatPhoneNumber(phoneNumber), channel: 'sms' });
    console.log(`[TWILIO] Codice di verifica inviato (SID ${verification.sid}, stato ${verification.status})`);
  } catch (error: any) {
    console.error("[TWILIO] Errore nell'invio del codice di verifica:", error?.message || error);
    throw new Error(`Failed to send verification code: ${error?.message || error}`);
  }
}

export async function verifyOTPSMS(phoneNumber: string, code: string, companySettings?: any): Promise<boolean> {
  const config = resolveTwilioVerifyConfig(companySettings);
  if (!config) {
    console.error('[TWILIO] Verifica OTP impossibile: Twilio non configurato per questa azienda');
    return false;
  }
  const client = twilio(config.accountSid, config.authToken);
  try {
    const check = await client.verify.v2
      .services(config.verifyServiceSid)
      .verificationChecks.create({ to: formatPhoneNumber(phoneNumber), code });
    console.log(`[TWILIO] Risultato verifica: ${check.status}`);
    return check.status === 'approved';
  } catch (error: any) {
    console.error('[TWILIO] Errore nella verifica OTP:', error?.message || error);
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
