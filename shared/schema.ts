import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { modularSectionsArraySchema } from "./sections";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "seller"] }).notNull().default("seller"),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  companyId: integer("company_id").notNull().references(() => companySettings.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(), // HTML content with placeholders
  customContent: text("custom_content"), // Custom content before bonuses
  paymentText: text("payment_text"), // Payment terms text
  predefinedBonuses: jsonb("predefined_bonuses").default([]), // Array of predefined bonus items
  paymentOptions: jsonb("payment_options").default({
    allowInstallments: true,
    maxInstallments: 36,
    paymentFrequencies: ["monthly", "quarterly", "annual"]
  }),
  sections: jsonb("sections").default([]), // Array of modular sections: { id, title, content (HTML), defaultEnabled, required, order }
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  clientData: jsonb("client_data").notNull(), // All client info and form data
  generatedContent: text("generated_content").notNull(), // Final HTML content
  pdfPath: text("pdf_path"), // Path to generated PDF
  status: text("status", {
    enum: ["draft", "sent", "awaiting_client_data", "viewed", "signed", "expired"]
  }).notNull().default("draft"),
  contractCode: text("contract_code").notNull().unique(), // Unique code for client access
  totalValue: integer("total_value"), // In cents
  sentToEmail: text("sent_to_email"), // Email where contract was sent
  signatures: jsonb("signatures"), // Stored signatures data
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  contractStartDate: timestamp("contract_start_date"), // Data inizio contratto
  contractEndDate: timestamp("contract_end_date"), // Data fine contratto
  autoRenewal: boolean("auto_renewal").default(false), // Auto renewal setting
  renewalDuration: integer("renewal_duration").default(12), // Duration in months
  isPercentagePartnership: boolean("is_percentage_partnership").default(false), // New: Partnership type
  partnershipPercentage: numeric("partnership_percentage", { precision: 5, scale: 2 }), // New: Revenue percentage (e.g., 15.50%)
  selectedSectionIds: jsonb("selected_section_ids").default([]), // Array of section IDs selected for this contract
  coFillToken: text("co_fill_token"), // Token of co-fill session that created/owns this draft (nullable)
  // Modalità di compilazione del contratto:
  //  - "seller": flusso classico, il venditore compila tutti i dati cliente
  //  - "client_fill": il cliente compila i propri dati e firma in autonomia
  //    sul link, senza approvazione intermedia del venditore.
  fillMode: text("fill_mode", { enum: ["seller", "client_fill"] }).notNull().default("seller"),
  // Identificatore del lotto (creazione in blocco da template). Tutti i contratti
  // generati nello stesso wizard condividono lo stesso batchId + batchLabel.
  batchId: text("batch_id"),
  batchLabel: text("batch_label"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  action: text("action").notNull(), // created, sent, viewed, signed, etc.
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"), // Additional context data
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull(),
  taxId: text("tax_id").notNull(),
  vatId: text("vat_id").notNull(),
  uniqueCode: text("unique_code").notNull(),
  pec: text("pec").notNull(),
  logoUrl: text("logo_url"),
  contractTitle: text("contract_title").default("Contratto FAST TRACK VENDITE").notNull(),
  // OTP Settings
  otpMethod: text("otp_method", { enum: ["email", "twilio"] }).default("email").notNull(),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioVerifyServiceSid: text("twilio_verify_service_sid"),
  twilioWhatsappFrom: text("twilio_whatsapp_from"),
  // SMTP Settings (per-tenant transactional email)
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpSecure: boolean("smtp_secure"),
  emailFromAddress: text("email_from_address"),
  emailFromName: text("email_from_name"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companySettings, {
    fields: [users.companyId],
    references: [companySettings.id],
  }),
  createdTemplates: many(contractTemplates),
  contracts: many(contracts),
}));

export const contractTemplatesRelations = relations(contractTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [contractTemplates.createdBy],
    references: [users.id],
  }),
  contracts: many(contracts),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  template: one(contractTemplates, {
    fields: [contracts.templateId],
    references: [contractTemplates.id],
  }),
  seller: one(users, {
    fields: [contracts.sellerId],
    references: [users.id],
  }),
  auditLogs: many(auditLogs),
  otpCodes: many(otpCodes),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  contract: one(contracts, {
    fields: [auditLogs.contractId],
    references: [contracts.id],
  }),
}));

export const otpCodesRelations = relations(otpCodes, ({ one }) => ({
  contract: one(contracts, {
    fields: [otpCodes.contractId],
    references: [contracts.id],
  }),
}));

export const companySettingsRelations = relations(companySettings, ({ many }) => ({
  users: many(users),
}));

export const contractPresets = pgTable("contract_presets", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companySettings.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  visibility: text("visibility", { enum: ["personal", "shared"] }).notNull().default("personal"),
  templateId: integer("template_id").references(() => contractTemplates.id, { onDelete: "set null" }),
  selectedSectionIds: jsonb("selected_section_ids").default([]).notNull(),
  bonusList: jsonb("bonus_list").default([]).notNull(),
  paymentPlan: jsonb("payment_plan").default([]).notNull(),
  rataList: jsonb("rata_list").default([]).notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }),
  isPercentagePartnership: boolean("is_percentage_partnership").notNull().default(false),
  partnershipPercentage: numeric("partnership_percentage", { precision: 5, scale: 2 }),
  autoRenewal: boolean("auto_renewal").notNull().default(false),
  renewalDuration: integer("renewal_duration").notNull().default(12),
  defaultDurationMonths: integer("default_duration_months"),
  fillMode: text("fill_mode", { enum: ["seller", "client_fill"] }).notNull().default("seller"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractPresetsRelations = relations(contractPresets, ({ one }) => ({
  template: one(contractTemplates, {
    fields: [contractPresets.templateId],
    references: [contractTemplates.id],
  }),
  creator: one(users, {
    fields: [contractPresets.createdBy],
    references: [users.id],
  }),
}));

export const presetItemSchema = z.object({
  bonus_descrizione: z.string().optional(),
  rata_importo: z.union([z.string(), z.number()]).optional(),
  rata_scadenza: z.string().optional(),
}).passthrough();

export const insertContractPresetSchema = createInsertSchema(contractPresets).omit({
  id: true,
  companyId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Nome richiesto").max(120),
  description: z.string().max(500).nullish(),
  visibility: z.enum(["personal", "shared"]).default("personal"),
  templateId: z.number().int().positive().nullish(),
  selectedSectionIds: z.array(z.string()).default([]),
  bonusList: z.array(z.object({ bonus_descrizione: z.string() }).passthrough()).default([]),
  paymentPlan: z.array(z.object({ rata_importo: z.string().optional(), rata_scadenza: z.string().optional() }).passthrough()).default([]),
  rataList: z.array(z.object({ rata_importo: z.union([z.number(), z.string()]).optional(), rata_scadenza: z.string().optional() }).passthrough()).default([]),
  totalValue: z.union([z.string(), z.number()]).nullish().transform((v) => v === undefined || v === null || v === "" ? null : String(v)),
  partnershipPercentage: z.union([z.string(), z.number()]).nullish().transform((v) => v === undefined || v === null || v === "" ? null : String(v)),
  renewalDuration: z.number().int().min(1).max(60).default(12),
  defaultDurationMonths: z.number().int().min(1).max(120).nullish(),
});

export type ContractPreset = typeof contractPresets.$inferSelect;
export type InsertContractPreset = z.infer<typeof insertContractPresetSchema>;

export const coFillSessions = pgTable("co_fill_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  companyId: integer("company_id").notNull().references(() => companySettings.id),
  sellerId: integer("seller_id").notNull().references(() => users.id),
  contractId: integer("contract_id").references(() => contracts.id),
  currentData: jsonb("current_data").default({}).notNull(),
  status: text("status", { enum: ["active", "terminated", "expired"] }).notNull().default("active"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coFillSessionsRelations = relations(coFillSessions, ({ one }) => ({
  seller: one(users, { fields: [coFillSessions.sellerId], references: [users.id] }),
  company: one(companySettings, { fields: [coFillSessions.companyId], references: [companySettings.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  companyId: z.number().int().positive("Company ID is required"),
});

export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  paymentText: z.string().optional(),
  sections: modularSectionsArraySchema.optional().default([]),
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  renewalDuration: z.number().min(1).max(60).default(12),
  partnershipPercentage: z.string().nullable().optional(),
  selectedSectionIds: z.array(z.string()).nullable().optional(),
  contractStartDate: z.union([z.string(), z.date()]).nullable().optional().transform((val) => {
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  contractEndDate: z.union([z.string(), z.date()]).nullable().optional().transform((val) => {
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  updatedAt: true,
}).extend({
  logoUrl: z.string().optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

export const insertCoFillSessionSchema = createInsertSchema(coFillSessions).omit({
  id: true,
  createdAt: true,
});
export type CoFillSession = typeof coFillSessions.$inferSelect;
export type InsertCoFillSession = z.infer<typeof insertCoFillSessionSchema>;

export const signatureSchema = z.object({
  contract: z.string().optional(),
  privacy: z.string().optional(),
  marketing: z.string().optional(),
});