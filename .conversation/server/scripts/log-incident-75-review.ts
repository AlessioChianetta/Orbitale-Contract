/**
 * Idempotent: registra l'audit log di chiusura dell'incidente #75 sul
 * contratto 75 (incident_review). Eseguito una sola volta durante la
 * remediation post-incidente; il blocco WHERE NOT EXISTS lo rende sicuro
 * da rieseguire senza creare duplicati.
 *
 * Già eseguito in produzione il 2026-04-19 (audit_logs.id = 1581).
 * Lasciato in repo come traccia versionata del provvedimento e per poter
 * essere replicato in altri ambienti (staging, sviluppo locale).
 *
 * Uso:
 *   npx tsx --require ./server/loadEnv.cjs server/scripts/log-incident-75-review.ts
 */
import { config } from "dotenv";
config();

import { pool } from "../db";

const CONTRACT_ID = 75;
const ACTION = "incident_review";

async function main() {
  const metadata = {
    incident: "#75",
    date: "2026-04-19",
    summary:
      "Incidente UX risolto: la firma OTP era REALMENTE verificata e registrata server-side (audit log 'signed' presente, IP firmatario 151.64.85.66). La cliente ha visto schermo bianco a causa di Google Translate che corrompe il DOM React durante il setTimeout(reload) post-firma, e ha pensato di non aver firmato.",
    rootCause:
      "Estensione browser (Google Translate) + reload immediato dopo firma",
    fix: [
      "Pagina /firmato/:code server-rendered come destinazione post-firma (no React, no reload), mostra codice contratto, data/ora e IP firmatario",
      "Audit log otp_failed con codice mascherato, IP, user agent e attemptNumber per ogni tentativo OTP non valido",
      "Lockout: 5 tentativi falliti in 10 minuti → blocco 30 minuti, alert email informativo al venditore con IP del tentativo e link al contratto",
      "Hotfix Google Translate (meta+body notranslate) deployato",
    ],
    closedBy: "agent",
  };

  const result = await pool.query(
    `INSERT INTO audit_logs (contract_id, action, ip_address, user_agent, metadata)
     SELECT $1, $2, NULL, 'system/agent', $3::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM audit_logs WHERE contract_id = $1 AND action = $2
     )
     RETURNING id, contract_id, action, timestamp;`,
    [CONTRACT_ID, ACTION, JSON.stringify(metadata)],
  );

  if (result.rowCount === 0) {
    console.log(
      `[incident-75] Nota di chiusura già presente per contract ${CONTRACT_ID}, niente da fare.`,
    );
  } else {
    console.log(
      `[incident-75] Inserita nota di chiusura: id=${result.rows[0].id}, ts=${result.rows[0].timestamp}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[incident-75] Errore:", err);
    process.exit(1);
  });
