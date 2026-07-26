import { 
  users, contractTemplates, contracts, auditLogs, otpCodes, companySettings, coFillSessions,
  contractPresets,
  type User, type InsertUser, 
  type ContractTemplate, type InsertContractTemplate,
  type Contract, type InsertContract,
  type AuditLog, type InsertAuditLog,
  type OtpCode, type InsertOtpCode,
  type CompanySettings, type InsertCompanySettings,
  type CoFillSession, type InsertCoFillSession,
  type ContractPreset, type InsertContractPreset
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, inArray, sql, or, like } from "drizzle-orm";
import {
  getOrbitalContractEmptyHtml,
  getOrbitalServicePackages,
  ORBITAL_TEMPLATE_NAME,
  ORBITAL_TEMPLATE_DESCRIPTION,
  ORBITAL_LEGACY_TEMPLATE_NAMES,
  ORBITAL_TEMPLATE_MARKER_PREFIX,
  ORBITAL_TEMPLATE_V2_MARKER,
} from "@shared/orbital-template";
import { parseSections } from "@shared/sections";
import { isOrbitalPackagesTemplate } from "@shared/orbital-packages";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { contracts as contractsTable, contractTemplates as contractTemplatesTable } from "@shared/schema";

const PostgresSessionStore = connectPg(session);

// Statistiche di utilizzo per template, calcolate dai contratti della company.
// I contratti "orfani" (templateId di template cancellati) semplicemente non
// matchano nessun template della lista: il conteggio non si rompe.
export type TemplateUsage = {
  totalContracts: number;
  activeContracts: number; // non archiviati
  lastContractAt: Date | null;
};

export type ContractTemplateWithUsage = ContractTemplate & { usage: TemplateUsage };

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
  getTemplates(companyId: number): Promise<ContractTemplateWithUsage[]>;
  getTemplate(id: number, companyId: number): Promise<ContractTemplate | undefined>;
  createTemplate(template: InsertContractTemplate): Promise<ContractTemplate>;
  updateTemplate(id: number, template: Partial<InsertContractTemplate>): Promise<ContractTemplate>;
  deleteTemplate(id: number): Promise<void>;

  // Contract methods
  getContracts(companyId: number, sellerId?: number, includeArchived?: boolean): Promise<Contract[]>;
  getContract(id: number, companyId: number): Promise<Contract | undefined>;
  getContractByCode(code: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: number, contract: Partial<InsertContract> & { isArchived?: boolean }): Promise<Contract>;
  setContractsArchived(ids: number[], companyId: number, isArchived: boolean): Promise<number[]>;
  deleteContracts(ids: number[], companyId: number): Promise<number[]>;

  // Audit log methods
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getContractAuditLogs(contractId: number): Promise<AuditLog[]>;
  getRecentAuditLogCount(contractId: number, action: string, sinceMs: number): Promise<number>;
  getRecentAuditLogTimestamps(contractId: number, action: string, sinceMs: number, limit: number): Promise<Date[]>;

  // OTP methods
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getValidOtpCode(contractId: number, code: string): Promise<OtpCode | undefined>;
  markOtpAsUsed(id: number): Promise<void>;

  // Company settings methods
  getCompanySettings(companyId: number): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: InsertCompanySettings, companyId: number): Promise<CompanySettings>;
  createCompany(settings: InsertCompanySettings): Promise<CompanySettings>;

  // Co-fill session methods
  createCoFillSession(session: InsertCoFillSession): Promise<CoFillSession>;
  getCoFillSessionByToken(token: string): Promise<CoFillSession | undefined>;
  updateCoFillSessionData(token: string, data: any): Promise<CoFillSession | undefined>;
  terminateCoFillSession(token: string, companyId: number, sellerId: number): Promise<boolean>;
  listActiveCoFillSessionsForSeller(companyId: number, sellerId: number): Promise<CoFillSession[]>;
  getActiveCoFillSessionByContractId(contractId: number): Promise<CoFillSession | undefined>;

  // Contract Preset methods
  listContractPresets(companyId: number, userId: number): Promise<ContractPreset[]>;
  getContractPreset(id: number, companyId: number, userId: number): Promise<ContractPreset | undefined>;
  createContractPreset(input: InsertContractPreset & { companyId: number; createdBy: number }): Promise<ContractPreset>;
  updateContractPreset(id: number, companyId: number, userId: number, isAdmin: boolean, input: Partial<InsertContractPreset>): Promise<ContractPreset | undefined>;
  deleteContractPreset(id: number, companyId: number, userId: number, isAdmin: boolean): Promise<boolean>;

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
  /**
   * Seed + sincronizzazione idempotente del template "Sistema Orbitale".
   *
   * - Nessun candidato in azienda (riconosciuto per nome storico o marker nel
   *   contenuto): seed del contratto v2 (5 pacchetti cumulativi + FAQ).
   * - Candidati presenti: si individua quello "in uso" (più contratti
   *   agganciati; a parità di conteggio l'id più basso) e lo si porta al
   *   contratto v2 UNA SOLA VOLTA (guardia: marker v2 nel contenuto). Nome,
   *   categoria, bonus e stato attivo/archiviato non vengono toccati, così
   *   rinomine e modifiche manuali successive alla sincronizzazione restano.
   * - Gli altri candidati senza contratti vengono disattivati (duplicati
   *   creati dal vecchio seed dopo la rinomina del template principale).
   *
   * Gira a ogni getTemplates; dopo la prima sincronizzazione è un no-op.
   * Stessa logica su dev e VPS: nessuna migrazione manuale richiesta.
   */
  async ensureOrbitalTemplate(companyId: number): Promise<void> {
    try {
      // Concurrency-safe: advisory lock transazionale per company
      // (namespace 4242, arbitrario ma stabile).
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(4242, ${companyId})`);

        const candidates = await tx
          .select({
            id: contractTemplates.id,
            name: contractTemplates.name,
            content: contractTemplates.content,
            sections: contractTemplates.sections,
            isActive: contractTemplates.isActive,
          })
          .from(contractTemplates)
          .innerJoin(users, eq(contractTemplates.createdBy, users.id))
          .where(
            and(
              eq(users.companyId, companyId),
              or(
                inArray(contractTemplates.name, ORBITAL_LEGACY_TEMPLATE_NAMES),
                like(contractTemplates.content, `%${ORBITAL_TEMPLATE_MARKER_PREFIX}%`),
                // Fingerprint sulle sezioni: riconosce i template orbitali
                // anche se rinominati con nomi non storici (es. sul VPS) e
                // senza marker nel contenuto — v1 e v2.
                sql`${contractTemplates.sections}::text LIKE '%pkg_setter_ai%'`,
                sql`${contractTemplates.sections}::text LIKE '%pkg-1-base%'`,
              ),
            ),
          );

        if (candidates.length === 0) {
          const [adminUser] = await tx
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.companyId, companyId), eq(users.role, "admin")))
            .limit(1);
          if (!adminUser) return;

          await tx.insert(contractTemplates).values({
            name: ORBITAL_TEMPLATE_NAME,
            description: ORBITAL_TEMPLATE_DESCRIPTION,
            category: "Clienti",
            content: getOrbitalContractEmptyHtml(),
            sections: getOrbitalServicePackages(),
            createdBy: adminUser.id,
            updatedAt: new Date(),
          });
          console.log(`Storage: Seeded "${ORBITAL_TEMPLATE_NAME}" v2 template for company ${companyId}`);
          return;
        }

        // Quale candidato è "in uso"? Quello con più contratti agganciati.
        const candidateIds = candidates.map((c) => c.id);
        const usage = await tx
          .select({
            templateId: contracts.templateId,
            total: sql<number>`count(*)::int`,
          })
          .from(contracts)
          .where(inArray(contracts.templateId, candidateIds))
          .groupBy(contracts.templateId);
        const usageMap = new Map(usage.map((u) => [u.templateId, u.total]));

        const primary = [...candidates].sort((a, b) => {
          const diff = (usageMap.get(b.id) ?? 0) - (usageMap.get(a.id) ?? 0);
          return diff !== 0 ? diff : a.id - b.id;
        })[0];

        // Sync una sola volta (guardia: marker v2 nel contenuto). Se il
        // marker manca MA le sezioni sono già quelle v2, significa che
        // l'admin ha modificato il contenuto a mano rimuovendo il marker:
        // le sue modifiche si rispettano, nessuna sovrascrittura.
        const primaryAlreadyV2 = isOrbitalPackagesTemplate(parseSections(primary.sections));
        if (!(primary.content ?? "").includes(ORBITAL_TEMPLATE_V2_MARKER) && !primaryAlreadyV2) {
          await tx
            .update(contractTemplates)
            .set({
              content: getOrbitalContractEmptyHtml(),
              sections: getOrbitalServicePackages(),
              description: ORBITAL_TEMPLATE_DESCRIPTION,
              updatedAt: new Date(),
            })
            .where(eq(contractTemplates.id, primary.id));
          console.log(
            `Storage: Synced Orbitale template #${primary.id} to v2 (5 pacchetti cumulativi) for company ${companyId}`,
          );
        }

        for (const candidate of candidates) {
          if (candidate.id === primary.id) continue;
          if ((usageMap.get(candidate.id) ?? 0) === 0 && candidate.isActive !== false) {
            await tx
              .update(contractTemplates)
              .set({ isActive: false, updatedAt: new Date() })
              .where(eq(contractTemplates.id, candidate.id));
            console.log(
              `Storage: Deactivated unused duplicate Orbitale template #${candidate.id} for company ${companyId}`,
            );
          }
        }
      });
    } catch (err) {
      console.error("Storage: Failed to ensure Orbitale template:", err);
    }
  }

  async getTemplates(companyId: number): Promise<ContractTemplateWithUsage[]> {
    try {
        // Idempotent seed of the Sistema Orbitale modular template
        await this.ensureOrbitalTemplate(companyId);

        // Filter templates by company - get templates created by users of this company
        const templates = await db
          .select({
            id: contractTemplates.id,
            name: contractTemplates.name,
            description: contractTemplates.description,
            category: contractTemplates.category,
            content: contractTemplates.content,
            customContent: contractTemplates.customContent,
            paymentText: contractTemplates.paymentText,
            predefinedBonuses: contractTemplates.predefinedBonuses,
            paymentOptions: contractTemplates.paymentOptions,
            sections: contractTemplates.sections,
            isActive: contractTemplates.isActive,
            createdBy: contractTemplates.createdBy,
            createdAt: contractTemplates.createdAt,
            updatedAt: contractTemplates.updatedAt,
          })
          .from(contractTemplates)
          .innerJoin(users, eq(contractTemplates.createdBy, users.id))
          .where(eq(users.companyId, companyId))
          .orderBy(desc(contractTemplates.createdAt));

        // Conteggi di utilizzo per template (scope: contratti dei venditori
        // della stessa company). Query aggregata separata: i contratti che
        // puntano a template cancellati restano fuori dalla mappa senza errori.
        const usageRows = await db
          .select({
            templateId: contracts.templateId,
            totalContracts: sql<number>`count(*)::int`,
            activeContracts: sql<number>`(count(*) filter (where ${contracts.isArchived} = false))::int`,
            lastContractAt: sql<Date | null>`max(${contracts.createdAt})`,
          })
          .from(contracts)
          .innerJoin(users, eq(contracts.sellerId, users.id))
          .where(eq(users.companyId, companyId))
          .groupBy(contracts.templateId);

        const usageMap = new Map<number, TemplateUsage>();
        for (const row of usageRows) {
          if (row.templateId == null) continue;
          usageMap.set(row.templateId, {
            totalContracts: row.totalContracts,
            activeContracts: row.activeContracts,
            lastContractAt: row.lastContractAt ? new Date(row.lastContractAt) : null,
          });
        }

        const withUsage: ContractTemplateWithUsage[] = templates.map((t) => ({
          ...t,
          usage: usageMap.get(t.id) ?? { totalContracts: 0, activeContracts: 0, lastContractAt: null },
        }));

        console.log("Storage: Found", withUsage.length, "templates for company", companyId);
        return withUsage;
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
          category: contractTemplates.category,
          content: contractTemplates.content,
          customContent: contractTemplates.customContent,
          paymentText: contractTemplates.paymentText,
          predefinedBonuses: contractTemplates.predefinedBonuses,
          paymentOptions: contractTemplates.paymentOptions,
          sections: contractTemplates.sections,
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
  async getContracts(companyId: number, sellerId?: number, includeArchived: boolean = false): Promise<Contract[]> {
    try {
      const conditions = [eq(users.companyId, companyId)];
      if (sellerId) conditions.push(eq(contracts.sellerId, sellerId));
      if (!includeArchived) conditions.push(eq(contracts.isArchived, false));

      return await db
        .select()
        .from(contracts)
        .innerJoin(users, eq(contracts.sellerId, users.id))
        .where(and(...conditions))
        .orderBy(desc(contracts.createdAt))
        .then(rows => rows.map(r => r.contracts));
    } catch (error) {
      console.error("Database error in getContracts:", error);
      throw error;
    }
  }

  async getContract(id: number, companyId: number): Promise<Contract | undefined> {
      const [row] = await db
        .select()
        .from(contracts)
        .innerJoin(users, eq(contracts.sellerId, users.id))
        .where(and(eq(contracts.id, id), eq(users.companyId, companyId)));

      return row ? row.contracts : undefined;
  }

  async setContractsArchived(ids: number[], companyId: number, isArchived: boolean): Promise<number[]> {
    if (ids.length === 0) return [];
    // Only archive contracts belonging to this company (via seller join)
    const eligible = await db
      .select({ id: contracts.id })
      .from(contracts)
      .innerJoin(users, eq(contracts.sellerId, users.id))
      .where(and(eq(users.companyId, companyId), inArray(contracts.id, ids)));
    const eligibleIds = eligible.map(r => r.id);
    if (eligibleIds.length === 0) return [];
    await db.update(contracts)
      .set({ isArchived, updatedAt: new Date() })
      .where(inArray(contracts.id, eligibleIds));
    return eligibleIds;
  }

  async deleteContracts(ids: number[], companyId: number): Promise<number[]> {
    if (ids.length === 0) return [];
    const eligible = await db
      .select({ id: contracts.id })
      .from(contracts)
      .innerJoin(users, eq(contracts.sellerId, users.id))
      .where(and(eq(users.companyId, companyId), inArray(contracts.id, ids)));
    const eligibleIds = eligible.map(r => r.id);
    if (eligibleIds.length === 0) return [];
    // Delete dependent rows first to avoid FK violations
    await db.delete(otpCodes).where(inArray(otpCodes.contractId, eligibleIds));
    await db.delete(auditLogs).where(inArray(auditLogs.contractId, eligibleIds));
    await db.delete(contracts).where(inArray(contracts.id, eligibleIds));
    return eligibleIds;
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
        sections: result.template.sections,
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

  async getRecentAuditLogCount(contractId: number, action: string, sinceMs: number): Promise<number> {
    const since = new Date(Date.now() - sinceMs);
    const rows = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.contractId, contractId),
          eq(auditLogs.action, action),
          gte(auditLogs.timestamp, since),
        ),
      );
    return rows.length;
  }

  async getRecentAuditLogTimestamps(
    contractId: number,
    action: string,
    sinceMs: number,
    limit: number,
  ): Promise<Date[]> {
    const since = new Date(Date.now() - sinceMs);
    const rows = await db
      .select({ timestamp: auditLogs.timestamp })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.contractId, contractId),
          eq(auditLogs.action, action),
          gte(auditLogs.timestamp, since),
        ),
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
    return rows.map((r) => r.timestamp);
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

  // Co-fill session methods
  async createCoFillSession(input: InsertCoFillSession): Promise<CoFillSession> {
    const [row] = await db.insert(coFillSessions).values(input).returning();
    return row;
  }

  async getCoFillSessionByToken(token: string): Promise<CoFillSession | undefined> {
    const [row] = await db.select().from(coFillSessions).where(eq(coFillSessions.token, token));
    return row || undefined;
  }

  async updateCoFillSessionData(token: string, data: any): Promise<CoFillSession | undefined> {
    const [row] = await db
      .update(coFillSessions)
      .set({ currentData: data })
      .where(eq(coFillSessions.token, token))
      .returning();
    return row || undefined;
  }

  async terminateCoFillSession(token: string, companyId: number, sellerId: number): Promise<boolean> {
    const result = await db
      .update(coFillSessions)
      .set({ status: "terminated" })
      .where(and(
        eq(coFillSessions.token, token),
        eq(coFillSessions.companyId, companyId),
        eq(coFillSessions.sellerId, sellerId),
      ))
      .returning({ id: coFillSessions.id });
    return result.length > 0;
  }

  async listActiveCoFillSessionsForSeller(companyId: number, sellerId: number): Promise<CoFillSession[]> {
    return await db.select().from(coFillSessions).where(and(
      eq(coFillSessions.companyId, companyId),
      eq(coFillSessions.sellerId, sellerId),
      eq(coFillSessions.status, "active"),
    ));
  }

  // Contract Preset methods
  async listContractPresets(companyId: number, userId: number): Promise<ContractPreset[]> {
    const rows = await db
      .select()
      .from(contractPresets)
      .where(and(
        eq(contractPresets.companyId, companyId),
        sql`(${contractPresets.visibility} = 'shared' OR ${contractPresets.createdBy} = ${userId})`,
      ))
      .orderBy(desc(contractPresets.updatedAt));
    return rows;
  }

  async getContractPreset(id: number, companyId: number, userId: number): Promise<ContractPreset | undefined> {
    const [row] = await db
      .select()
      .from(contractPresets)
      .where(and(
        eq(contractPresets.id, id),
        eq(contractPresets.companyId, companyId),
        sql`(${contractPresets.visibility} = 'shared' OR ${contractPresets.createdBy} = ${userId})`,
      ));
    return row || undefined;
  }

  async createContractPreset(input: InsertContractPreset & { companyId: number; createdBy: number }): Promise<ContractPreset> {
    const [row] = await db
      .insert(contractPresets)
      .values({
        ...input,
        updatedAt: new Date(),
      })
      .returning();
    return row;
  }

  async updateContractPreset(
    id: number,
    companyId: number,
    userId: number,
    isAdmin: boolean,
    input: Partial<InsertContractPreset>,
  ): Promise<ContractPreset | undefined> {
    const [existing] = await db
      .select()
      .from(contractPresets)
      .where(and(eq(contractPresets.id, id), eq(contractPresets.companyId, companyId)));
    if (!existing) return undefined;
    if (!isAdmin && existing.createdBy !== userId) return undefined;
    // I preset condivisi possono essere modificati solo da admin,
    // anche se a crearli era stato un seller poi promosso/retrocesso.
    if (existing.visibility === "shared" && !isAdmin) return undefined;
    const [row] = await db
      .update(contractPresets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(contractPresets.id, id))
      .returning();
    return row;
  }

  async deleteContractPreset(id: number, companyId: number, userId: number, isAdmin: boolean): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(contractPresets)
      .where(and(eq(contractPresets.id, id), eq(contractPresets.companyId, companyId)));
    if (!existing) return false;
    if (!isAdmin && existing.createdBy !== userId) return false;
    // I preset condivisi possono essere eliminati solo da admin.
    if (existing.visibility === "shared" && !isAdmin) return false;
    await db.delete(contractPresets).where(eq(contractPresets.id, id));
    return true;
  }

  async getActiveCoFillSessionByContractId(contractId: number): Promise<CoFillSession | undefined> {
    const [row] = await db.select().from(coFillSessions).where(and(
      eq(coFillSessions.contractId, contractId),
      eq(coFillSessions.status, "active"),
    )).orderBy(desc(coFillSessions.createdAt)).limit(1);
    return row || undefined;
  }
}

export const storage = new DatabaseStorage();