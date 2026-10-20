import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";
import { pool } from "./db";
import { hashPassword } from "./password";
import { ensureTenantSchema } from "./tenant-schema";

/**
 * Creazione (o aggiornamento) di un'azienda cliente con il suo primo admin e
 * il suo contratto. Idempotente: rilanciata con lo stesso file non duplica
 * nulla e non cambia la password dell'admin. Usata dallo script
 * `scripts/onboard-company.ts` da lanciare sul VPS (il DB del sito
 * pubblicato non è quello di Replit).
 */

const fileOrText = z.string().trim().min(1);

export const onboardingConfigSchema = z.object({
  company: z.object({
    companyName: z.string().trim().min(2),
    address: z.string().trim().min(1),
    city: z.string().trim().min(1),
    postalCode: z.string().trim().min(1),
    taxId: z.string().trim().min(1),
    vatId: z.string().trim().min(1),
    uniqueCode: z.string().trim().min(1).default("0000000"),
    pec: z.string().trim().min(1),
    contractTitle: z.string().trim().optional(),
    /** percorso di un'immagine (png/jpg/svg) salvata come logo */
    logoPath: fileOrText.optional(),
    priceVatMode: z.enum(["plus_vat", "vat_included", "none"]).default("plus_vat"),
    /** percorso di un file di testo con l'informativa privacy dell'azienda */
    privacyPolicyTextPath: fileOrText.optional(),
    privacyPolicyUrl: z.string().trim().regex(/^https?:\/\/\S+$/i).optional(),
    marketingConsentEnabled: z.boolean().default(false),
  }),
  admin: z.object({
    username: z.string().trim().min(3),
    email: z.string().trim().email(),
    fullName: z.string().trim().min(2),
  }),
  template: z.object({
    name: z.string().trim().min(2),
    /** percorso del file HTML del contratto (con i segnaposto {{...}}) */
    htmlPath: fileOrText,
    recipientType: z.enum(["cliente", "procacciatore"]).default("cliente"),
    category: z.string().trim().default("Clienti"),
  }).optional(),
});

export type OnboardingConfig = z.infer<typeof onboardingConfigSchema>;

export interface OnboardingResult {
  companyId: number;
  companyCreated: boolean;
  adminId: number;
  adminCreated: boolean;
  /** solo se l'admin è stato creato ora: va comunicata una volta e poi cambiata */
  temporaryPassword: string | null;
  template: { id: number; action: "created" | "updated" | "unchanged" } | null;
  placeholders: string[];
  warnings: string[];
}

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

function readLogo(p: string, baseDir: string): string {
  const abs = path.resolve(baseDir, p);
  const mime = MIME[path.extname(abs).toLowerCase()];
  if (!mime) throw new Error(`Logo: formato non supportato (${path.extname(abs)}). Usa png, jpg, svg o webp.`);
  return `data:${mime};base64,${readFileSync(abs).toString("base64")}`;
}

/** Segnaposto {{chiave}} presenti nell'HTML (esclusi i blocchi {{#...}} / {{/...}}). */
export function listPlaceholders(html: string): string[] {
  const out = new Set<string>();
  for (const m of Array.from(html.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g))) out.add(m[1]);
  return Array.from(out).sort();
}

function temporaryPassword(): string {
  // 12 caratteri leggibili (niente 0/O/1/l): da dettare o copiare senza errori.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function onboardCompany(
  rawConfig: unknown,
  opts: { baseDir: string; dryRun?: boolean } ,
): Promise<OnboardingResult> {
  const cfg = onboardingConfigSchema.parse(rawConfig);
  const warnings: string[] = [];
  const c = cfg.company;

  // File letti prima di toccare il DB: un percorso sbagliato non lascia lavori a metà.
  const logoUrl = c.logoPath ? readLogo(c.logoPath, opts.baseDir) : undefined;
  const privacyText = c.privacyPolicyTextPath
    ? readFileSync(path.resolve(opts.baseDir, c.privacyPolicyTextPath), "utf8").trim()
    : undefined;
  const html = cfg.template ? readFileSync(path.resolve(opts.baseDir, cfg.template.htmlPath), "utf8") : null;
  if (html !== null && !html.trim()) throw new Error("Il file HTML del contratto è vuoto.");
  if (!privacyText && !c.privacyPolicyUrl) {
    warnings.push("Informativa privacy non impostata: il cliente finale deve accettarla senza poterla leggere. Aggiungila (testo o link) prima di inviare contratti.");
  }

  await ensureTenantSchema();
  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    // --- azienda: si riconosce dall'admin (se esiste già) o dal nome esatto
    const { rows: existingAdmin } = await db.query(
      `SELECT id, company_id, role, email, username FROM public.users WHERE lower(email) = lower($1) OR lower(username) = lower($2)`,
      [cfg.admin.email, cfg.admin.username],
    );
    let companyId: number | null = existingAdmin[0]?.company_id ?? null;
    if (existingAdmin.length > 1) {
      throw new Error("Email e username dell'admin appartengono a due account diversi: correggi il file di configurazione.");
    }
    if (!companyId) {
      const { rows } = await db.query(`SELECT id FROM company_settings WHERE company_name = $1`, [c.companyName]);
      if (rows.length > 1) throw new Error(`Più aziende si chiamano "${c.companyName}": impossibile scegliere.`);
      companyId = rows[0]?.id ?? null;
    }
    if (companyId) {
      const { rows } = await db.query(`SELECT is_owner, company_name FROM company_settings WHERE id = $1`, [companyId]);
      if (rows[0]?.is_owner) {
        throw new Error(`L'account ${cfg.admin.email} appartiene all'azienda del proprietario (${rows[0].company_name}): usa un'altra email per la cliente.`);
      }
    }

    const companyCreated = !companyId;
    if (!companyId) {
      const { rows } = await db.query(
        `INSERT INTO company_settings
           (company_name, address, city, postal_code, tax_id, vat_id, unique_code, pec, contract_title, logo_url,
            otp_method, price_vat_mode, privacy_policy_text, privacy_policy_url, marketing_consent_enabled, is_owner, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'email',$11,$12,$13,$14,false,now())
         RETURNING id`,
        [c.companyName, c.address, c.city, c.postalCode, c.taxId, c.vatId, c.uniqueCode, c.pec,
         c.contractTitle || "Contratto", logoUrl ?? null, c.priceVatMode, privacyText ?? null, c.privacyPolicyUrl ?? null,
         c.marketingConsentEnabled],
      );
      companyId = rows[0].id as number;
    } else {
      // Aggiorna i dati presenti nel file; SMTP e credenziali restano quelli
      // impostati dalla cliente in Impostazioni Azienda.
      await db.query(
        `UPDATE company_settings SET
           company_name = $2, address = $3, city = $4, postal_code = $5, tax_id = $6, vat_id = $7,
           unique_code = $8, pec = $9,
           contract_title = COALESCE($10, contract_title),
           logo_url = COALESCE($11, logo_url),
           otp_method = 'email',
           price_vat_mode = $12,
           privacy_policy_text = COALESCE($13, privacy_policy_text),
           privacy_policy_url = COALESCE($14, privacy_policy_url),
           marketing_consent_enabled = $15,
           updated_at = now()
         WHERE id = $1`,
        [companyId, c.companyName, c.address, c.city, c.postalCode, c.taxId, c.vatId, c.uniqueCode, c.pec,
         c.contractTitle ?? null, logoUrl ?? null, c.priceVatMode, privacyText ?? null, c.privacyPolicyUrl ?? null,
         c.marketingConsentEnabled],
      );
    }

    // --- admin
    let adminId: number;
    let tempPassword: string | null = null;
    const adminCreated = existingAdmin.length === 0;
    if (adminCreated) {
      tempPassword = temporaryPassword();
      const { rows } = await db.query(
        `INSERT INTO public.users (username, password, role, email, full_name, company_id, is_active, must_change_password)
         VALUES ($1, $2, 'admin', $3, $4, $5, true, true) RETURNING id`,
        [cfg.admin.username, await hashPassword(tempPassword), cfg.admin.email, cfg.admin.fullName, companyId],
      );
      adminId = rows[0].id;
    } else {
      adminId = existingAdmin[0].id;
      if (existingAdmin[0].role !== "admin") {
        warnings.push(`L'account ${existingAdmin[0].email} esiste ma non è admin: ruolo lasciato invariato.`);
      }
    }

    // --- template del contratto
    let template: OnboardingResult["template"] = null;
    if (cfg.template && html !== null) {
      const { rows } = await db.query(
        `SELECT t.id, t.content FROM contract_templates t
           JOIN public.users u ON u.id = t.created_by
          WHERE u.company_id = $1 AND t.name = $2
          ORDER BY t.id`,
        [companyId, cfg.template.name],
      );
      if (rows.length > 1) warnings.push(`Più template "${cfg.template.name}" nell'azienda: aggiornato il primo (id ${rows[0].id}).`);
      if (!rows[0]) {
        const { rows: ins } = await db.query(
          `INSERT INTO contract_templates (name, content, recipient_type, category, created_by, is_active)
           VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
          [cfg.template.name, html, cfg.template.recipientType, cfg.template.category, adminId],
        );
        template = { id: ins[0].id, action: "created" };
      } else if (rows[0].content !== html) {
        // I contratti già creati hanno il loro testo (generated_content): non cambiano.
        await db.query(`UPDATE contract_templates SET content = $2, recipient_type = $3, updated_at = now() WHERE id = $1`,
          [rows[0].id, html, cfg.template.recipientType]);
        template = { id: rows[0].id, action: "updated" };
      } else {
        template = { id: rows[0].id, action: "unchanged" };
      }
    }

    if (opts.dryRun) {
      await db.query("ROLLBACK");
    } else {
      await db.query("COMMIT");
    }
    return {
      companyId: companyId!,
      companyCreated,
      adminId,
      adminCreated,
      temporaryPassword: opts.dryRun ? null : tempPassword,
      template,
      placeholders: html ? listPlaceholders(html) : [],
      warnings,
    };
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}
