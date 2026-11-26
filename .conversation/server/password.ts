import { Express } from "express";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { z } from "zod";
import { pool } from "./db";
import { storage } from "./storage";
import { getBaseUrl, sendPasswordResetEmail } from "./services/email-service";

/**
 * Password degli utenti del gestionale (task 001, Fase C, punto 24):
 * - cambio password per l'utente collegato (obbligatorio al primo accesso
 *   quando la password è temporanea);
 * - recupero password via email con link monouso valido 1 ora. Del token si
 *   salva solo l'hash; la risposta alla richiesta è sempre la stessa, così
 *   non si scopre quali email hanno un account.
 */

const scryptAsync = promisify(scrypt);

export const PASSWORD_MIN_LENGTH = 8;
const RESET_TOKEN_TTL_MINUTES = 60;
const RESET_MAX_REQUESTS_PER_HOUR = 3;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = String(stored || "").split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return hashedBuf.length === suppliedBuf.length && timingSafeEqual(hashedBuf, suppliedBuf);
}

const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri`)
  .max(200, "Password troppo lunga");

const changeSchema = z.object({
  currentPassword: z.string().min(1, "Inserisci la password attuale"),
  newPassword: newPasswordSchema,
});
const requestSchema = z.object({ email: z.string().trim().min(3).max(320) });
const confirmSchema = z.object({ token: z.string().min(20).max(200), newPassword: newPasswordSchema });

const RESET_REQUEST_MESSAGE =
  "Se l'indirizzo corrisponde a un account attivo, riceverai a breve un'email con il link per scegliere una nuova password.";

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function setPassword(userId: number, password: string): Promise<void> {
  await pool.query(
    `UPDATE public.users SET password = $1, must_change_password = false WHERE id = $2`,
    [await hashPassword(password), userId],
  );
}

/** Chiude le sessioni aperte dell'utente (tranne, se indicata, quella corrente). */
async function destroyUserSessions(userId: number, exceptSid?: string): Promise<void> {
  await pool.query(
    `DELETE FROM session
      WHERE (sess::jsonb -> 'passport' ->> 'user') = $1::text
        AND ($2::text IS NULL OR sid <> $2::text)`,
    [String(userId), exceptSid ?? null],
  );
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message || "Dati non validi";
}

export function registerPasswordRoutes(app: Express): void {
  // Cambio password dell'utente collegato.
  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = changeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
    const { currentPassword, newPassword } = parsed.data;

    const user = await storage.getUser(req.user.id);
    if (!user || !(await comparePasswords(currentPassword, user.password))) {
      return res.status(400).json({ message: "La password attuale non è corretta" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "La nuova password deve essere diversa da quella attuale" });
    }
    await setPassword(user.id, newPassword);
    // Le altre sessioni aperte con la vecchia password decadono.
    await destroyUserSessions(user.id, req.sessionID);
    res.json({ message: "Password aggiornata" });
  });

  // Richiesta di recupero: risposta identica che l'account esista o no.
  app.post("/api/password-reset/request", async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Inserisci un indirizzo email valido" });
    const email = parsed.data.email.toLowerCase();

    try {
      const { rows } = await pool.query(
        `SELECT id, email, full_name, company_id, is_active FROM public.users WHERE lower(email) = $1`,
        [email],
      );
      const user = rows[0];
      if (user && user.is_active) {
        const { rows: recent } = await pool.query(
          `SELECT count(*)::int AS n FROM password_reset_tokens
            WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
          [user.id],
        );
        if ((recent[0]?.n ?? 0) < RESET_MAX_REQUESTS_PER_HOUR) {
          const token = randomBytes(32).toString("base64url");
          await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
            [user.id, hashResetToken(token), String(RESET_TOKEN_TTL_MINUTES)],
          );
          const link = `${getBaseUrl()}/reimposta-password?token=${encodeURIComponent(token)}`;
          // Invio senza attendere: i tempi di risposta non devono far capire
          // se l'account esiste.
          sendPasswordResetEmail({
            companyId: user.company_id,
            to: user.email,
            fullName: user.full_name,
            link,
            validMinutes: RESET_TOKEN_TTL_MINUTES,
          }).catch((e: any) => console.error("[PASSWORD] Email di recupero non inviata:", e?.message || e));
        } else {
          console.warn(`[PASSWORD] Troppe richieste di recupero per l'utente ${user.id}: ignorata.`);
        }
      }
    } catch (e: any) {
      // Non si rivela nulla al richiedente (né se l'account esiste né se
      // l'SMTP dell'azienda non è configurato): si registra nel log.
      console.error("[PASSWORD] Recupero password non inviato:", e?.message || e);
    }
    res.json({ message: RESET_REQUEST_MESSAGE });
  });

  // Nuova password con il link ricevuto via email.
  app.post("/api/password-reset/confirm", async (req, res) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
    const { token, newPassword } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `UPDATE password_reset_tokens SET used_at = now()
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          RETURNING user_id`,
        [hashResetToken(token)],
      );
      const userId: number | undefined = rows[0]?.user_id;
      if (!userId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Link non valido o scaduto: richiedine uno nuovo." });
      }
      const { rows: u } = await client.query(`SELECT is_active FROM public.users WHERE id = $1`, [userId]);
      if (!u[0]?.is_active) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Account disattivato: contatta l'amministratore della tua azienda" });
      }
      await client.query(
        `UPDATE public.users SET password = $1, must_change_password = false WHERE id = $2`,
        [await hashPassword(newPassword), userId],
      );
      // Gli altri link ancora validi dello stesso utente non servono più.
      await client.query(
        `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
        [userId],
      );
      await client.query("COMMIT");
      await destroyUserSessions(userId);
      res.json({ message: "Password aggiornata: ora puoi accedere." });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[PASSWORD] Errore reimpostazione:", e);
      res.status(500).json({ message: "Errore durante l'aggiornamento della password" });
    } finally {
      client.release();
    }
  });
}
