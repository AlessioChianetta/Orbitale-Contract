import { 
  users, contractTemplates, contracts, auditLogs, otpCodes, companySettings,
  type User, type InsertUser, 
  type ContractTemplate, type InsertContractTemplate,
  type Contract, type InsertContract,
  type AuditLog, type InsertAuditLog,
  type OtpCode, type InsertOtpCode,
  type CompanySettings, type InsertCompanySettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { contracts as contractsTable, contractTemplates as contractTemplatesTable } from "@shared/schema";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  getUsersByCompanyAndUsername(companyId: number, username: string): Promise<User | undefined>;
  getUsersByCompanyAndEmail(companyId: number, email: string): Promise<User | undefined>;

  // Template methods
  getTemplates(companyId: number): Promise<ContractTemplate[]>;
  getTemplate(id: number, companyId: number): Promise<ContractTemplate | undefined>;
  createTemplate(template: InsertContractTemplate): Promise<ContractTemplate>;
  updateTemplate(id: number, template: Partial<InsertContractTemplate>): Promise<ContractTemplate>;
  deleteTemplate(id: number): Promise<void>;

  // Contract methods
  getContracts(companyId: number, sellerId?: number): Promise<Contract[]>;
  getContract(id: number, companyId: number): Promise<Contract | undefined>;
  getContractByCode(code: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: number, contract: Partial<InsertContract>): Promise<Contract>;

  // Audit log methods
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getContractAuditLogs(contractId: number): Promise<AuditLog[]>;

  // OTP methods
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getValidOtpCode(contractId: number, code: string): Promise<OtpCode | undefined>;
  markOtpAsUsed(id: number): Promise<void>;

  // Company settings methods
  getCompanySettings(companyId: number): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: InsertCompanySettings, companyId: number): Promise<CompanySettings>;
  createCompany(settings: InsertCompanySettings): Promise<CompanySettings>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error: any) {
      // Retry once on connection errors
      if (error.code === '57P01' || error.code === 'ECONNRESET') {
        console.log('Database connection error, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || undefined;
      }
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    const userList = await db.select().from(users).where(eq(users.companyId, companyId));
    return userList;
  }

  async getUsersByCompanyAndUsername(companyId: number, username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.companyId, companyId), eq(users.username, username)));
    return user || undefined;
  }

  async getUsersByCompanyAndEmail(companyId: number, email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.companyId, companyId), eq(users.email, email)));
    return user || undefined;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Template methods
  async getTemplates(companyId: number): Promise<ContractTemplate[]> {
    try {
        // Filter templates by company - get templates created by users of this company
        const templates = await db
          .select({
            id: contractTemplates.id,
            name: contractTemplates.name,
            description: contractTemplates.description,
            content: contractTemplates.content,
            customContent: contractTemplates.customContent,
            paymentText: contractTemplates.paymentText,
            predefinedBonuses: contractTemplates.predefinedBonuses,
            paymentOptions: contractTemplates.paymentOptions,
            isActive: contractTemplates.isActive,
            createdBy: contractTemplates.createdBy,
            createdAt: contractTemplates.createdAt,
            updatedAt: contractTemplates.updatedAt,
          })
          .from(contractTemplates)
          .innerJoin(users, eq(contractTemplates.createdBy, users.id))
          .where(eq(users.companyId, companyId))
          .orderBy(desc(contractTemplates.createdAt));
        
        console.log("Storage: Found", templates.length, "templates for company", companyId);
        return templates;
    } catch (error) {
      console.error("Storage error in getTemplates:", error);
      throw error;
    }
  }

  async getTemplate(id: number, companyId: number): Promise<ContractTemplate | undefined> {
      // Filter template by company - ensure it was created by a user of this company
      const [template] = await db
        .select({
          id: contractTemplates.id,
          name: contractTemplates.name,
          description: contractTemplates.description,
          content: contractTemplates.content,
          customContent: contractTemplates.customContent,
          paymentText: contractTemplates.paymentText,
          predefinedBonuses: contractTemplates.predefinedBonuses,
          paymentOptions: contractTemplates.paymentOptions,
          isActive: contractTemplates.isActive,
          createdBy: contractTemplates.createdBy,
          createdAt: contractTemplates.createdAt,
          updatedAt: contractTemplates.updatedAt,
        })
        .from(contractTemplates)
        .innerJoin(users, eq(contractTemplates.createdBy, users.id))
        .where(and(eq(contractTemplates.id, id), eq(users.companyId, companyId)));
      
      return template || undefined;
  }

  async createTemplate(template: InsertContractTemplate): Promise<ContractTemplate> {
    const [newTemplate] = await db
      .insert(contractTemplates)
      .values({
        ...template,
        updatedAt: new Date(),
      })
      .returning();
    return newTemplate;
  }

  async updateTemplate(id: number, template: Partial<InsertContractTemplate>): Promise<ContractTemplate> {
    const [updatedTemplate] = await db
      .update(contractTemplates)
      .set({
        ...template,
        updatedAt: new Date(),
      })
      .where(eq(contractTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(contractTemplates).where(eq(contractTemplates.id, id));
  }

  // Contract methods
  async getContracts(companyId: number, sellerId?: number): Promise<Contract[]> {
    try {
      if (sellerId) {
        // Filter by both company and seller
        return await db
          .select({
            id: contracts.id,
            templateId: contracts.templateId,
            sellerId: contracts.sellerId,
            clientData: contracts.clientData,
            generatedContent: contracts.generatedContent,
            pdfPath: contracts.pdfPath,
            status: contracts.status,
            contractCode: contracts.contractCode,
            totalValue: contracts.totalValue,
            sentToEmail: contracts.sentToEmail,
            signatures: contracts.signatures,
            signedAt: contracts.signedAt,
            expiresAt: contracts.expiresAt,
            contractStartDate: contracts.contractStartDate,
            contractEndDate: contracts.contractEndDate,
            autoRenewal: contracts.autoRenewal,
            renewalDuration: contracts.renewalDuration,
            isPercentagePartnership: contracts.isPercentagePartnership,
            partnershipPercentage: contracts.partnershipPercentage,
            createdAt: contracts.createdAt,
            updatedAt: contracts.updatedAt,
          })
          .from(contracts)
          .innerJoin(users, eq(contracts.sellerId, users.id))
          .where(and(eq(users.companyId, companyId), eq(contracts.sellerId, sellerId)))
          .orderBy(desc(contracts.createdAt));
      } else {
        // Filter by company only
        return await db
          .select({
            id: contracts.id,
            templateId: contracts.templateId,
            sellerId: contracts.sellerId,
            clientData: contracts.clientData,
            generatedContent: contracts.generatedContent,
            pdfPath: contracts.pdfPath,
            status: contracts.status,
            contractCode: contracts.contractCode,
            totalValue: contracts.totalValue,
            sentToEmail: contracts.sentToEmail,
            signatures: contracts.signatures,
            signedAt: contracts.signedAt,
            expiresAt: contracts.expiresAt,
            contractStartDate: contracts.contractStartDate,
            contractEndDate: contracts.contractEndDate,
            autoRenewal: contracts.autoRenewal,
            renewalDuration: contracts.renewalDuration,
            isPercentagePartnership: contracts.isPercentagePartnership,
            partnershipPercentage: contracts.partnershipPercentage,
            createdAt: contracts.createdAt,
            updatedAt: contracts.updatedAt,
          })
          .from(contracts)
          .innerJoin(users, eq(contracts.sellerId, users.id))
          .where(eq(users.companyId, companyId))
          .orderBy(desc(contracts.createdAt));
      }
    } catch (error) {
      console.error("Database error in getContracts:", error);
      throw error;
    }
  }

  async getContract(id: number, companyId: number): Promise<Contract | undefined> {
      // Filter contract by company - ensure it was created by a seller of this company
      const [contract] = await db
        .select({
          id: contracts.id,
          templateId: contracts.templateId,
          sellerId: contracts.sellerId,
          clientData: contracts.clientData,
          generatedContent: contracts.generatedContent,
          pdfPath: contracts.pdfPath,
          status: contracts.status,
          contractCode: contracts.contractCode,
          totalValue: contracts.totalValue,
          sentToEmail: contracts.sentToEmail,
          signatures: contracts.signatures,
          signedAt: contracts.signedAt,
          expiresAt: contracts.expiresAt,
          contractStartDate: contracts.contractStartDate,
          contractEndDate: contracts.contractEndDate,
          autoRenewal: contracts.autoRenewal,
          renewalDuration: contracts.renewalDuration,
          isPercentagePartnership: contracts.isPercentagePartnership,
          partnershipPercentage: contracts.partnershipPercentage,
          createdAt: contracts.createdAt,
          updatedAt: contracts.updatedAt,
        })
        .from(contracts)
        .innerJoin(users, eq(contracts.sellerId, users.id))
        .where(and(eq(contracts.id, id), eq(users.companyId, companyId)));
      
      return contract || undefined;
  }

  async getContractByCode(contractCode: string): Promise<any> {
    const contracts = await db.select({
      contract: contractsTable,
      template: contractTemplatesTable,
      seller: users
    }).from(contractsTable)
    .leftJoin(contractTemplatesTable, eq(contractsTable.templateId, contractTemplatesTable.id))
    .leftJoin(users, eq(contractsTable.sellerId, users.id))
    .where(eq(contractsTable.contractCode, contractCode));

    if (contracts.length === 0) return undefined;

    const result = contracts[0];
    // Add company information and template to the contract
    const contractWithCompanyAndTemplate = {
      ...result.contract,
      companyId: result.seller?.companyId,
      template: result.template ? {
        id: result.template.id,
        name: result.template.name,
        description: result.template.description,
        content: result.template.content,
        customContent: result.template.customContent,
        paymentText: result.template.paymentText,
        predefinedBonuses: result.template.predefinedBonuses,
        paymentOptions: result.template.paymentOptions,
        isActive: result.template.isActive
      } : null
    };
    return contractWithCompanyAndTemplate;
  }

  

  async createContract(contract: InsertContract): Promise<Contract> {
    const [newContract] = await db
      .insert(contracts)
      .values(contract)
      .returning();
    return newContract;
  }

  async updateContract(id: number, data: Partial<InsertContract>): Promise<Contract> {
    const [updatedContract] = await db.update(contracts)
      .set(data)
      .where(eq(contracts.id, id))
      .returning();
    return updatedContract;
  }

  // Audit log methods
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return auditLog;
  }

  async getContractAuditLogs(contractId: number): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.contractId, contractId))
      .orderBy(auditLogs.timestamp);
  }

  // OTP methods
  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const [otpCode] = await db
      .insert(otpCodes)
      .values(otp)
      .returning();
    return otpCode;
  }

  async getValidOtpCode(contractId: number, code: string): Promise<OtpCode | undefined> {
    const [otpCode] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.contractId, contractId),
          eq(otpCodes.code, code),
          eq(otpCodes.isUsed, false)
        )
      )
      .orderBy(desc(otpCodes.createdAt)) // Prendi il più recente
      .limit(1);

    if (!otpCode || otpCode.expiresAt < new Date()) {
      return undefined;
    }

    return otpCode;
  }

  async markOtpAsUsed(id: number): Promise<void> {
    await db
      .update(otpCodes)
      .set({ isUsed: true })
      .where(eq(otpCodes.id, id));
  }

  // Company settings methods
  async getCompanySettings(companyId?: number): Promise<CompanySettings | undefined> {
    let query = db.select().from(companySettings);
    
    if (companyId) {
      query = query.where(eq(companySettings.id, companyId));
    } else {
      // If no companyId provided, get the first company settings
      query = query.limit(1);
    }
    
    const [settings] = await query;
    return settings;
  }

  async updateCompanySettings(settings: InsertCompanySettings, companyId: number): Promise<CompanySettings> {
    const existingSettings = await this.getCompanySettings(companyId);
    
    if (existingSettings) {
      // Update existing settings for specific company
      const [updatedSettings] = await db
        .update(companySettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(companySettings.id, companyId))
        .returning();
      return updatedSettings;
    } else {
      // Cannot create company settings with specific ID as ID is auto-generated
      throw new Error("Company settings not found for the specified company ID");
    }
  }

  async createCompany(settings: InsertCompanySettings): Promise<CompanySettings> {
    const [newCompany] = await db
      .insert(companySettings)
      .values({ ...settings, updatedAt: new Date() })
      .returning();
    return newCompany;
  }
}

export const storage = new DatabaseStorage();