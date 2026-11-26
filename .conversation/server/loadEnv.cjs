// File: server/loadEnv.cjs

// Usa require() perché questo file è CommonJS e verrà pre-caricato
const dotenv = require('dotenv');

console.log('--- [loadEnv.cjs] Caricamento variabili d\'ambiente (MODO CommonJS) ---');
const envConfigResult = dotenv.config(); // Carica le variabili dal file .env

if (envConfigResult.error) {
  console.error('#########################################################################');
  console.error('## [loadEnv.cjs] ERRORE CRITICO: Impossibile caricare il file .env     ##');
  console.error('#########################################################################');
  console.error('Errore dettagliato:', envConfigResult.error);
} else {
  if (Object.keys(envConfigResult.parsed || {}).length === 0) {
    console.warn('#########################################################################');
    console.warn('## [loadEnv.cjs] AVVISO: File .env caricato ma è VUOTO.               ##');
    console.warn('#########################################################################');
  } else {
    console.log('#########################################################################');
    console.log('## [loadEnv.cjs] OK: File .env caricato correttamente.                 ##');
    console.log('#########################################################################');
  }
}

// Log di verifica per le variabili chiave (aggiungi/rimuovi secondo necessità)
console.log('--- [loadEnv.cjs] Variabili d\'ambiente caricate: ---');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? `Presente (lunghezza: ${process.env.DATABASE_URL.length})` : 'NON PRESENTE');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? `Presente (lunghezza: ${process.env.SESSION_SECRET.length})` : 'NON PRESENTE');
console.log('SMTP_USER:', process.env.SMTP_USER ? `Presente` : 'NON PRESENTE');
console.log('----------------------------------------------------');