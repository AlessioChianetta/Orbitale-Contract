// Aziende/utenti/template di prova per i test di rotta, con pulizia completa
// (contratti, registri, OTP, co-compilazioni, PDF, sessioni, contatori).
import { unlink } from "fs/promises";
import { pool } from "../../server/db";
import { storage } from "../../server/storage";
import { hashPassword } from "../../server/password";

export const TEST_PASSWORD = "password-di-prova-1";

export interface TestTenant {
  companyId: number;
  adminId: number;
  adminUsername: string;
  adminEmail: string;
  sellerId: number;
  sellerUsername: string;
  sellerEmail: string;
  templateId: number;
  fromAddress: string;
}

export async function createTenant(tag: string, name: string, opts: {
  smtpPort?: number;
  templateContent?: string;
  privacyPolicyText?: string;
} = {}): Promise<TestTenant> {
  const c = await storage.createCompany({
    companyName: `${tag} ${name}`, address: "Via Prova 1", city: "Roma", postalCode: "00100",
    taxId: "PRVTST00A00H501X", vatId: "00000000000", uniqueCode: "0000000", pec: "prova@pec.invalid",
  });
  const fromAddress = `${tag}-${name}-mittente@example.invalid`.toLowerCase();
  await pool.query(
    `UPDATE company_settings SET otp_method = 'email', is_owner = false,
       smtp_host = $2, smtp_port = $3, smtp_user = 'utente', smtp_pass = 'segreta', smtp_secure = false,
       email_from_address = $4, email_from_name = $5, privacy_policy_text = $6
     WHERE id = $1`,
    [c.id, opts.smtpPort ? "127.0.0.1" : null, opts.smtpPort ?? null, opts.smtpPort ? fromAddress : null,
     `${tag} ${name}`, opts.privacyPolicyText ?? "Informativa privacy di prova."],
  );
  const password = await hashPassword(TEST_PASSWORD);
  const mk = async (role: "admin" | "seller") => {
    const username = `${tag}-${name}-${role}`.toLowerCase();
    const email = `${username}@example.invalid`;
    const u = await storage.createUser({ username, password, email, fullName: `${name} ${role}`, role, companyId: c.id });
    return { id: u.id, username, email };
  };
  const admin = await mk("admin");
  const seller = await mk("seller");
  const tpl = await storage.createTemplate({
    name: `${tag} ${name} contratto`,
    content: opts.templateContent ?? "<h2>Contratto di prova</h2><p>Cliente: {{societa}} - {{email}}</p>",
    createdBy: admin.id,
  } as any);
  return {
    companyId: c.id, adminId: admin.id, adminUsername: admin.username, adminEmail: admin.email,
    sellerId: seller.id, sellerUsername: seller.username, sellerEmail: seller.email,
    templateId: tpl.id, fromAddress,
  };
}

export async function cleanupTenants(companyIds: number[]): Promise<void> {
  if (!companyIds.length) return;
  const { rows: users } = await pool.query(`SELECT id FROM public.users WHERE company_id = ANY($1::int[])`, [companyIds]);
  const userIds = users.map((u) => u.id as number);
  const { rows: contracts } = await pool.query(
    `SELECT id, pdf_path FROM contracts WHERE seller_id = ANY($1::int[])`, [userIds]);
  const contractIds = contracts.map((c) => c.id as number);
  for (const c of contracts) if (c.pdf_path) await unlink(c.pdf_path).catch(() => {});
  if (contractIds.length) {
    await pool.query(`DELETE FROM audit_logs WHERE contract_id = ANY($1::int[])`, [contractIds]);
    await pool.query(`DELETE FROM otp_codes WHERE contract_id = ANY($1::int[])`, [contractIds]);
  }
  await pool.query(`DELETE FROM co_fill_sessions WHERE company_id = ANY($1::int[]) OR seller_id = ANY($2::int[])`, [companyIds, userIds]);
  if (contractIds.length) await pool.query(`DELETE FROM contracts WHERE id = ANY($1::int[])`, [contractIds]);
  await pool.query(`DELETE FROM contract_presets WHERE company_id = ANY($1::int[]) OR created_by = ANY($2::int[])`, [companyIds, userIds]);
  await pool.query(`DELETE FROM contract_templates WHERE created_by = ANY($1::int[])`, [userIds]);
  await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = ANY($1::int[])`, [userIds]);
  await pool.query(`DELETE FROM session WHERE (sess::jsonb -> 'passport' ->> 'user') = ANY($1::text[])`, [userIds.map(String)]);
  await pool.query(`DELETE FROM public.users WHERE id = ANY($1::int[])`, [userIds]);
  await pool.query(`DELETE FROM company_contract_counters WHERE company_id = ANY($1::int[])`, [companyIds]);
  await pool.query(`DELETE FROM company_settings WHERE id = ANY($1::int[])`, [companyIds]);
}
