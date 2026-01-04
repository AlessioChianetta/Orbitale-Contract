import { addMonths, addQuarters, addYears, format } from "date-fns";

// Utility functions for VAT and Tax Code validation

// Validate Italian VAT number (Partita IVA)
export function validatePartitaIva(piva: string): boolean {
  if (!piva || piva.length !== 11) return false;

  // Check if all characters are digits
  if (!/^\d{11}$/.test(piva)) return false;

  // Luhn algorithm for Italian VAT
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = parseInt(piva[i]);
    if (i % 2 === 0) {
      sum += digit;
    } else {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(piva[10]);
}

// Validate Italian Tax Code (Codice Fiscale)
export function validateCodiceFiscale(cf: string): boolean {
  if (!cf || cf.length !== 16) return false;

  cf = cf.toUpperCase();
  const pattern = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;

  if (!pattern.test(cf)) return false;

  // Check control character
  const oddMap: { [key: string]: number } = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
  };

  const evenMap: { [key: string]: number } = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
    'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
  };

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const char = cf[i];
    sum += i % 2 === 0 ? oddMap[char] : evenMap[char];
  }

  const checkChar = String.fromCharCode(65 + (sum % 26));
  return checkChar === cf[15];
}

// Lookup company data by VAT number (mock implementation - replace with real API)
export async function lookupCompanyByVAT(vatNumber: string): Promise<{
  success: boolean;
  data?: {
    company_name: string;
    address: string;
    city: string;
    postal_code: string;
    province: string;
  };
  error?: string;
}> {
  try {
    // Mock response - replace with real API call to Agenzia delle Entrate or similar service
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

    // Mock data for testing
    const mockData = {
      '12345678901': {
        company_name: 'Esempio SRL',
        address: 'Via Roma 123',
        city: 'Milano',
        postal_code: '20100',
        province: 'MI'
      },
      '98765432109': {
        company_name: 'Test SpA',
        address: 'Via Torino 456',
        city: 'Roma',
        postal_code: '00100',
        province: 'RM'
      }
    };

    const data = mockData[vatNumber as keyof typeof mockData];

    if (data) {
      return { success: true, data };
    } else {
      return { success: false, error: 'Azienda non trovata' };
    }
  } catch (error) {
    return { success: false, error: 'Errore durante la ricerca' };
  }
}

// Detect if input is VAT or Tax Code
export function detectVATorCF(input: string): 'vat' | 'cf' | 'unknown' {
  const cleanInput = input.replace(/\s/g, '').toUpperCase();

  if (/^\d{11}$/.test(cleanInput)) {
    return 'vat';
  } else if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cleanInput)) {
    return 'cf';
  }

  return 'unknown';
}

// Calcolo prezzo con logica corretta: 
// - Prezzo base è annuale (es. 2000€)
// - 1 rata = prezzo base (2000€)
// - Più rate = prezzo aumenta con sovrapprezzo
export function calculateDiscountedPrice(
  baseAnnualPrice: number,
  paymentFrequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual'
) {
  let numberOfPayments: number;
  let totalPrice: number;
  let freeBonusText: string = '';

  switch (paymentFrequency) {
    case 'annual':
      numberOfPayments = 1;
      totalPrice = baseAnnualPrice; // Prezzo base per pagamento unico
      freeBonusText = '2 mesi gratis inclusi!';
      break;
    case 'semiannual':
      numberOfPayments = 2;
      totalPrice = baseAnnualPrice * 1.10; // +10% per 2 rate semestrali
      freeBonusText = '1 mese gratis!';
      break;
    case 'quarterly':
      numberOfPayments = 4;
      totalPrice = baseAnnualPrice * 1.15; // +15% per 4 rate trimestrali
      freeBonusText = '0.5 mesi gratis!';
      break;
    case 'monthly':
      numberOfPayments = 12;
      totalPrice = baseAnnualPrice * 1.20; // +20% per 12 rate mensili
      freeBonusText = '';
      break;
  }

  const installmentAmount = totalPrice / numberOfPayments;
  const savings = paymentFrequency === 'annual' ? 0 : totalPrice - baseAnnualPrice;
  const savingsPercentage = paymentFrequency === 'annual' ? 0 : ((totalPrice - baseAnnualPrice) / baseAnnualPrice) * 100;

  return {
    totalPrice,
    baseAnnualPrice,
    installmentAmount,
    numberOfPayments,
    extraCost: savings,
    extraCostPercentage: savingsPercentage,
    freeBonusText
  };
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

// Generate payment dates
export function generatePaymentDates(
  startDate: Date, 
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual', 
  numberOfPayments: number
): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < numberOfPayments; i++) {
    dates.push(new Date(currentDate));

    // Calculate next payment date
    switch (frequency) {
      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;
      case 'quarterly':
        currentDate = addMonths(currentDate, 3);
        break;
      case 'semiannual':
        currentDate = addMonths(currentDate, 6);
        break;
      case 'annual':
        currentDate = addYears(currentDate, 1);
        break;
    }
  }

  return dates;
}

// Generate default payment plan
export function generateDefaultPaymentPlan(
  totalAmount: number,
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
  startDate: Date = new Date()
) {
  const calculation = calculateDiscountedPrice(totalAmount, frequency);
  const dates = generatePaymentDates(startDate, frequency, calculation.numberOfPayments);

  return dates.map(date => ({
    rata_importo: calculation.installmentAmount.toFixed(2),
    rata_scadenza: format(date, 'dd/MM/yyyy')
  }));
}