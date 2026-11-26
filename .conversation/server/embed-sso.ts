import { createHmac, timingSafeEqual } from "crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";

/**
 * Accesso automatico da un altro software del proprietario (es. il sito che
 * mostra questo software in un riquadro). Il server dell'altro software crea
 * un "lasciapassare" firmato con la chiave condivisa EMBED_SSO_SECRET:
 *
 *   v1.<payload base64url>.<firma base64url>
 *   payload = {"email": "...", "exp": <secondi unix>, "nonce": "<casuale>"}
 *   firma   = HMAC-SHA256("v1.<payload base64url>", EMBED_SSO_SECRET)
 *
 * Il lasciapassare vale al massimo 5 minuti e una volta sola. Istruzioni per
 * lo sviluppatore dell'altro software: docs/accesso-automatico.md.
 */

export const SSO_MAX_LIFETIME_SECONDS = 300;

export interface SsoClaims {
  email: string;
  exp: number;
  nonce: string;
}

export type SsoVerifyResult = { ok: true; claims: SsoClaims } | { ok: false; reason: string };

function sign(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/** Crea un lasciapassare (usato dai test e come riferimento per l'altro software). */
export function createSsoToken(claims: SsoClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `v1.${payload}.${sign(`v1.${payload}`, secret).toString("base64url")}`;
}

export function verifySsoToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): SsoVerifyResult {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return { ok: false, reason: "formato non valido" };
  const expected = sign(`v1.${parts[1]}`, secret);
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "firma non valida" };
  let claims: any;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "contenuto non leggibile" };
  }
  if (!claims || typeof claims.email !== "string" || !claims.email.includes("@")) return { ok: false, reason: "email mancante" };
  if (typeof claims.nonce !== "string" || claims.nonce.length < 16 || claims.nonce.length > 200) return { ok: false, reason: "nonce mancante" };
  if (!Number.isInteger(claims.exp)) return { ok: false, reason: "scadenza mancante" };
  if (claims.exp < nowSeconds) return { ok: false, reason: "scaduto" };
  if (claims.exp > nowSeconds + SSO_MAX_LIFETIME_SECONDS) return { ok: false, reason: "scadenza troppo lontana" };
  return { ok: true, claims: { email: claims.email.trim(), exp: claims.exp, nonce: claims.nonce } };
}

/** Segna il nonce come usato; false se era già stato usato. */
export async function consumeSsoNonce(nonce: string, expSeconds: number): Promise<boolean> {
  await pool.query(`DELETE FROM sso_used_nonces WHERE expires_at < now() - interval '1 day'`);
  const { rowCount } = await pool.query(
    `INSERT INTO sso_used_nonces (nonce, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT (nonce) DO NOTHING`,
    [nonce, expSeconds],
  );
  return rowCount === 1;
}

/**
 * Sessione aperta con il lasciapassare: il cookie deve viaggiare anche dentro
 * il riquadro di un altro sito (SameSite=None; Secure; Partitioned). Va
 * riapplicato dopo ogni req.logIn, che rigenera la sessione.
 */
export function markEmbedSession(req: Request) {
  req.session.viaSso = true;
  req.session.cookie.sameSite = "none";
  req.session.cookie.secure = true;
  (req.session.cookie as any).partitioned = true;
}

/** Pagine del sito mostrabili in un riquadro solo dai siti elencati in EMBED_ALLOWED_ORIGINS. */
export function frameAncestorsMiddleware() {
  const origins = (process.env.EMBED_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o));
  return (_req: Request, res: Response, next: NextFunction) => {
    if (origins.length) res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${origins.join(" ")}`);
    next();
  };
}

/**
 * Le sessioni del riquadro mandano il cookie anche a richieste da altri siti:
 * per le operazioni che modificano dati si accettano solo richieste partite
 * da questo stesso sito.
 */
export function embedCsrfGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.viaSso || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const fetchSite = req.get("sec-fetch-site");
  let sameOrigin: boolean;
  if (fetchSite) {
    sameOrigin = fetchSite === "same-origin";
  } else {
    const origin = req.get("origin");
    const host = req.get("x-forwarded-host") || req.get("host");
    sameOrigin = !origin || (!!host && origin.replace(/^https?:\/\//i, "") === host);
  }
  if (!sameOrigin) return res.status(403).json({ message: "Richiesta non consentita" });
  next();
}

export function ssoErrorPage(message: string): string {
  const esc = message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accesso non riuscito</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#0f172a">
<h1 style="font-size:20px">Accesso automatico non riuscito</h1>
<p style="color:#475569">${esc}</p>
<p><a href="/auth" style="color:#0f172a">Accedi con username e password</a></p>
</body></html>`;
}
