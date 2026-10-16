/**
 * IP del client da registrare nei log di audit.
 *
 * Si usa `req.ip`, che Express calcola da X-Forwarded-For rispettando
 * l'impostazione `trust proxy` (vedi server/auth.ts): considera solo le voci
 * aggiunte dai proxy fidati (nginx sul VPS), quindi il browser non può
 * falsificare il proprio IP inviando un header X-Forwarded-For inventato.
 * NON leggere mai direttamente X-Forwarded-For / X-Real-IP / X-Client-IP.
 */
export function getClientIp(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  const raw = req.ip || req.socket?.remoteAddress || "";
  const ip = raw.startsWith("::ffff:") ? raw.slice(7) : raw;
  return ip || "IP non disponibile";
}
