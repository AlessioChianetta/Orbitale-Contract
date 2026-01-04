import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
    enum: ["draft", "sent", "viewed", "signed", "expired"]
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

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionToken: text("session_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
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
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  renewalDuration: z.number().min(1).max(60).default(12),
  partnershipPercentage: z.string().nullable().optional(),
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

export const signatureSchema = z.object({
  contract: z.string().optional(),
  privacy: z.string().optional(),
  marketing: z.string().optional(),
});