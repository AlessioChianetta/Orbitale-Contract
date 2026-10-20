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

/**
 * Preset dell'offerta collegato al template: valori di partenza del form
 * (prezzo, durata, autorinnovo) che il venditore può sempre cambiare.
 */
const presetSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  /** prezzo totale in euro; assente = da inserire a ogni contratto */
  totalValue: z.number().positive().optional(),
  defaultDurationMonths: z.number().int().min(1).max(120).optional(),
  autoRenewal: z.boolean().default(false),
});

const templateSchema = z.object({
  name: z.string().trim().min(2),
  /** percorso del file HTML del contratto (con i segnaposto {{...}}) */
  htmlPath: fileOrText,
  recipientType: z.enum(["cliente", "procacciatore"]).default("cliente"),
  category: z.string().trim().default("Clienti"),
  description: z.string().trim().optional(),
  preset: presetSchema.optional(),
});

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
  /** un solo template (forma storica) */
  template: templateSchema.optional(),
  /** più template, ciascuno con il suo eventuale preset */
  templates: z.array(templateSchema).optional(),
}).superRefine((cfg, ctx) => {
  const names = [cfg.template, ...(cfg.templates || [])].filter(Boolean).map((t) => t!.name.toLowerCase());
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["templates"], message: `Template ripetuto: "${dup}"` });
});

export type OnboardingConfig = z.infer<typeof onboardingConfigSchema>;

type UpsertAction = "created" | "updated" | "unchanged";

export interface OnboardingTemplateResult {
  name: string;
  id: number;
  action: UpsertAction;
  placeholders: string[];
  preset: { name: string; id: number; action: UpsertAction } | null;
}

export interface OnboardingResult {
  companyId: number;
  companyCreated: boolean;
  adminId: number;
  adminCreated: boolean;
  /** solo se l'admin è stato creato ora: va comunicata una volta e poi cambiata */
  temporaryPassword: string | null;
  /** primo template (compatibilità con la forma storica a template singolo) */
  template: { id: number; action: UpsertAction } | null;
  placeholders: string[];
  templates: OnboardingTemplateResult[];
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
  // Campi lasciati da completare nel file (es. "INSERIRE_PEC"): meglio
  // fermarsi che stampare un segnaposto nei contratti.
  const todo = Object.entries(c).filter(([, v]) => typeof v === "string" && /^INSERIRE/i.test(v)).map(([k]) => k);
  if (todo.length) throw new Error(`Completa nel file di configurazione: ${todo.join(", ")}.`);

  // File letti prima di toccare il DB: un percorso sbagliato non lascia lavori a metà.
  const logoUrl = c.logoPath ? readLogo(c.logoPath, opts.baseDir) : undefined;
  const privacyText = c.privacyPolicyTextPath
    ? readFileSync(path.resolve(opts.baseDir, c.privacyPolicyTextPath), "utf8").trim()
    : undefined;
  const templateCfgs = [cfg.template, ...(cfg.templates || [])].filter((t): t is NonNullable<typeof t> => !!t);
  const templateFiles = templateCfgs.map((t) => {
    const html = readFileSync(path.resolve(opts.baseDir, t.htmlPath), "utf8");
    if (!html.trim()) throw new Error(`Il file HTML del contratto "${t.name}" è vuoto.`);
    return { cfg: t, html };
  });
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

    // --- template dei contratti (+ preset)
    const templates: OnboardingTemplateResult[] = [];
    let presetsAvailable: boolean | null = null;
    for (const { cfg: t, html } of templateFiles) {
      const { rows } = await db.query(
        `SELECT t.id, t.content, t.description, t.category, t.recipient_type FROM contract_templates t
           JOIN public.users u ON u.id = t.created_by
          WHERE u.company_id = $1 AND t.name = $2
          ORDER BY t.id`,
        [companyId, t.name],
      );
      if (rows.length > 1) warnings.push(`Più template "${t.name}" nell'azienda: aggiornato il primo (id ${rows[0].id}).`);
      let templateId: number;
      let action: UpsertAction;
      if (!rows[0]) {
        const { rows: ins } = await db.query(
          `INSERT INTO contract_templates (name, description, content, recipient_type, category, created_by, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
          [t.name, t.description ?? null, html, t.recipientType, t.category, adminId],
        );
        templateId = ins[0].id;
        action = "created";
      } else {
        templateId = rows[0].id;
        const changed = rows[0].content !== html
          || rows[0].recipient_type !== t.recipientType
          || (t.description !== undefined && rows[0].description !== t.description);
        if (changed) {
          // I contratti già creati hanno il loro testo (generated_content): non cambiano.
          await db.query(
            `UPDATE contract_templates SET content = $2, recipient_type = $3, description = COALESCE($4, description), updated_at = now() WHERE id = $1`,
            [templateId, html, t.recipientType, t.description ?? null],
          );
          action = "updated";
        } else {
          action = "unchanged";
        }
      }

      let preset: OnboardingTemplateResult["preset"] = null;
      if (t.preset) {
        if (presetsAvailable === null) {
          const { rows: reg } = await db.query(`SELECT to_regclass('contract_presets') AS t`);
          presetsAvailable = !!reg[0]?.t;
        }
        if (!presetsAvailable) {
          warnings.push(`Preset "${t.preset.name}" non creato: in questo database manca la tabella dei preset.`);
        } else {
          const p = t.preset;
          const values = [p.description ?? null, templateId, p.totalValue ?? null, p.autoRenewal, p.defaultDurationMonths ?? null];
          const { rows: ex } = await db.query(
            `SELECT id, description, template_id, total_value, auto_renewal, default_duration_months
               FROM contract_presets WHERE company_id = $1 AND name = $2 ORDER BY id`,
            [companyId, p.name],
          );
          if (!ex[0]) {
            const { rows: ins } = await db.query(
              `INSERT INTO contract_presets
                 (company_id, created_by, name, description, visibility, template_id, total_value, auto_renewal, default_duration_months)
               VALUES ($1, $2, $3, $4, 'shared', $5, $6, $7, $8) RETURNING id`,
              [companyId, adminId, p.name, ...values],
            );
            preset = { name: p.name, id: ins[0].id, action: "created" };
          } else {
            const cur = ex[0];
            const same = (cur.description ?? null) === values[0]
              && cur.template_id === templateId
              && (cur.total_value === null ? null : Number(cur.total_value)) === values[2]
              && cur.auto_renewal === p.autoRenewal
              && (cur.default_duration_months ?? null) === values[4];
            if (!same) {
              await db.query(
                `UPDATE contract_presets SET description = $2, template_id = $3, total_value = $4, auto_renewal = $5,
                   default_duration_months = $6, visibility = 'shared', updated_at = now() WHERE id = $1`,
                [cur.id, ...values],
              );
            }
            preset = { name: p.name, id: cur.id, action: same ? "unchanged" : "updated" };
          }
        }
      }
      templates.push({ name: t.name, id: templateId, action, placeholders: listPlaceholders(html), preset });
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
      template: templates[0] ? { id: templates[0].id, action: templates[0].action } : null,
      placeholders: templates[0]?.placeholders ?? [],
      templates,
      warnings,
    };
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}
