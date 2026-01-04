import { pgTable, serial, integer, text, jsonb, timestamp, unique, foreignKey, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const auditLogs = pgTable("audit_logs", {
	id: serial().primaryKey().notNull(),
	contractId: integer("contract_id").notNull(),
	action: text().notNull(),
	userAgent: text("user_agent"),
	ipAddress: text("ip_address"),
	metadata: jsonb(),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const contracts = pgTable("contracts", {
	id: serial().primaryKey().notNull(),
	templateId: integer("template_id").notNull(),
	sellerId: integer("seller_id").notNull(),
	clientData: jsonb("client_data").notNull(),
	generatedContent: text("generated_content").notNull(),
	pdfPath: text("pdf_path"),
	status: text().default('draft').notNull(),
	contractCode: text("contract_code").notNull(),
	totalValue: integer("total_value"),
	signedAt: timestamp("signed_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("contracts_contract_code_unique").on(table.contractCode),
]);

export const contractTemplates = pgTable("contract_templates", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	content: text().notNull(),
	createdBy: integer("created_by"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	predefinedBonuses: jsonb("predefined_bonuses").default([]),
	paymentOptions: jsonb("payment_options").default({"maxInstallments":36,"allowInstallments":true,"paymentFrequencies":["monthly","quarterly","annual"]}),
	customContent: text("custom_content"),
	paymentText: text("payment_text"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "contract_templates_created_by_users_id_fk"
		}),
]);

export const otpCodes = pgTable("otp_codes", {
	id: serial().primaryKey().notNull(),
	contractId: integer("contract_id").notNull(),
	phoneNumber: text("phone_number").notNull(),
	code: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	isUsed: boolean("is_used").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const companySettings = pgTable("company_settings", {
	id: serial().primaryKey().notNull(),
	companyName: text("company_name").notNull(),
	address: text().notNull(),
	city: text().notNull(),
	postalCode: text("postal_code").notNull(),
	taxId: text("tax_id").notNull(),
	vatId: text("vat_id").notNull(),
	uniqueCode: text("unique_code").notNull(),
	pec: text().notNull(),
	logoUrl: text("logo_url"),
	contractTitle: text("contract_title").default('Contratto FAST TRACK VENDITE').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	// OTP Settings
	otpMethod: text("otp_method").default('email').notNull(),
	twilioAccountSid: text("twilio_account_sid"),
	twilioAuthToken: text("twilio_auth_token"),
	twilioVerifyServiceSid: text("twilio_verify_service_sid"),
	twilioWhatsappFrom: text("twilio_whatsapp_from"),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	role: text().default('seller').notNull(),
	email: text().notNull(),
	fullName: text("full_name").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
]);
