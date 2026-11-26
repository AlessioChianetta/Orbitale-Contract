import crypto from 'crypto';

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Funzione per inviare OTP personalizzato (NON usa Twilio Verify)
export async function sendCustomOTP(contactInfo: string, code: string, companyId?: number): Promise<void> {
  console.log(`[OTP Service] Invio OTP personalizzato ${code} a ${contactInfo}`);
  
  // Always log the OTP for development debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔐 OTP Code for ${contactInfo}: ${code}`);
    console.log(`🔐 [DEVELOPMENT] OTP per ${contactInfo}: ${code}`);
  }
  
  // Determina se è un numero di telefono o email
  const isPhoneNumber = /^\+?[\d\s-()]+$/.test(contactInfo);
  
  if (isPhoneNumber) {
    // Usa SMS tradizionale (non Twilio Verify)
    try {
      console.log('[OTP Service] 📱 Invio OTP via SMS tradizionale...');
      // Qui useresti un servizio SMS diverso da Twilio Verify
      // Per ora, invia via email come fallback
      const { sendOTPEmail } = await import('./email-service');
      // Trova l'email dal contratto per il fallback
      throw new Error('SMS tradizionale non implementato, uso email');
    } catch (error) {
      console.log('[OTP Service] 🔄 Fallback da SMS a email...');
      // Fallback all'email
      const { sendOTPEmail } = await import('./email-service');
      await sendOTPEmail(contactInfo, code, companyId);
      console.log('[OTP Service] ✅ OTP Email (fallback da SMS) inviato con successo!');
    }
  } else {
    // È un'email
    console.log('[OTP Service] 📧 Invio OTP via email...');
    const { sendOTPEmail } = await import('./email-service');
    await sendOTPEmail(contactInfo, code, companyId);
    console.log('[OTP Service] ✅ OTP Email inviato con successo!');
  }
}

// Funzione legacy mantenuta per compatibilità - ora usa sendCustomOTP
export async function sendOTP(phoneNumber: string, code: string, companyId?: number): Promise<void> {
  return sendCustomOTP(phoneNumber, code, companyId);
}

export function validateOTPFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}
