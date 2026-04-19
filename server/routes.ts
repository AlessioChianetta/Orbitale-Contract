import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { insertContractTemplateSchema, insertContractSchema, insertCompanySettingsSchema, insertContractPresetSchema, type InsertCoFillSession, type User } from "@shared/schema";
import { resolveSelectedSections, renderSectionsHtml, parseSelectedIds, SECTIONS_MARKER } from "@shared/sections";
import { getMissingClientFields, getClientType, SYNCED_FIELD_KEYS } from "@shared/client-fields";
// @ts-ignore - no shipped types
import cookie from "cookie";
// @ts-ignore - no shipped types
import signature from "cookie-signature";
import { generatePDF } from "./services/pdf-generator-new";
import { sendContractEmail, sendContractSignedNotification, sendTestEmail, getEmailConfigStatusForCompany, sendCoFillLinkEmail, getBaseUrl, buildContractRequestEmail } from "./services/email-service";
import { hashContractPayload, hashBulkIds, signPreviewToken, verifyPreviewToken, type PreviewScope } from "./services/preview-token";
import { generateOTP, sendOTP } from "./services/otp-service";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { pool } from "./db";

// ============================================================================
// Client presence (Task #12) — in-memory tracking of clients viewing
// /client/:code via the /ws/client-presence/:contractCode WebSocket. Source of
// truth for "live" boolean; first_opened_at / last_activity_at are mirrored to
// the contracts table (debounced) so they survive process restarts.
// ============================================================================

type PresenceSession = {
  sessionId: string;
  contractCode: string;
  contractId: number;
  openedAt: number;
  lastPingAt: number;
  lastDbFlushAt: number;
};
const presenceSessions = new Map<string, PresenceSession>(); // sessionId -> session
const presenceByContract = new Map<number, Set<string>>(); // contractId -> sessionIds
const presenceFirstSessionAt = new Map<number, number>(); // contractId -> earliest live session openedAt

const PRESENCE_HEARTBEAT_MS = 15_000;
const PRESENCE_TIMEOUT_MS = 30_000;
const PRESENCE_DB_FLUSH_MS = 30_000;

let presenceSchemaReady: Promise<void> | null = null;
async function ensurePresenceSchema(): Promise<void> {
  if (!presenceSchemaReady) {
    presenceSchemaReady = (async () => {
      await pool.query(
        `ALTER TABLE contracts
           ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMP NULL,
           ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP NULL`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_contracts_last_activity_at
           ON contracts(last_activity_at)`
      );
      console.log("[PRESENCE] Schema ready (first_opened_at, last_activity_at).");
    })().catch((e) => {
      // Reset so a later call can retry instead of being permanently degraded
      console.error("[PRESENCE] Failed to ensure schema, will retry on next call:", e);
      presenceSchemaReady = null;
      throw e;
    });
  }
  return presenceSchemaReady;
}

async function presenceMarkOpen(contractId: number): Promise<void> {
  await ensurePresenceSchema();
  const now = new Date();
  try {
    await pool.query(
      `UPDATE contracts
         SET first_opened_at = COALESCE(first_opened_at, $2),
             last_activity_at = $2
         WHERE id = $1`,
      [contractId, now]
    );
  } catch (e) {
    console.error("[PRESENCE] markOpen DB error", e);
  }
}

async function presenceFlushActivity(contractId: number): Promise<void> {
  await ensurePresenceSchema();
  try {
    await pool.query(
      `UPDATE contracts SET last_activity_at = NOW() WHERE id = $1`,
      [contractId]
    );
  } catch (e) {
    console.error("[PRESENCE] flushActivity DB error", e);
  }
}

function presenceAddSession(s: PresenceSession): boolean {
  presenceSessions.set(s.sessionId, s);
  let set = presenceByContract.get(s.contractId);
  const wasEmpty = !set || set.size === 0;
  if (!set) {
    set = new Set();
    presenceByContract.set(s.contractId, set);
  }
  set.add(s.sessionId);
  if (wasEmpty) presenceFirstSessionAt.set(s.contractId, s.openedAt);
  return wasEmpty;
}

function presenceRemoveSession(sessionId: string): void {
  const s = presenceSessions.get(sessionId);
  if (!s) return;
  presenceSessions.delete(sessionId);
  const set = presenceByContract.get(s.contractId);
  if (set) {
    set.delete(sessionId);
    if (set.size === 0) {
      presenceByContract.delete(s.contractId);
      presenceFirstSessionAt.delete(s.contractId);
    } else {
      // Recompute earliest among remaining
      let earliest = Number.POSITIVE_INFINITY;
      for (const sid of set) {
        const ss = presenceSessions.get(sid);
        if (ss && ss.openedAt < earliest) earliest = ss.openedAt;
      }
      if (earliest !== Number.POSITIVE_INFINITY) {
        presenceFirstSessionAt.set(s.contractId, earliest);
      }
    }
  }
}

function presenceCleanupOnce(): void {
  const now = Date.now();
  const expired: string[] = [];
  const contractsToFlush = new Set<number>();
  for (const [sid, s] of presenceSessions) {
    if (now - s.lastPingAt > PRESENCE_TIMEOUT_MS) {
      expired.push(sid);
      contractsToFlush.add(s.contractId);
    }
  }
  for (const sid of expired) presenceRemoveSession(sid);
  // Flush last_activity_at una volta sola per contratto, così il "Visto N min fa"
  // resta accurato anche dopo disconnessioni brusche (timeout, no close event).
  for (const cid of contractsToFlush) {
    presenceFlushActivity(cid).catch(() => {});
  }
}

setInterval(presenceCleanupOnce, 15_000).unref?.();

import { chatContratto, guidedContractWizard, generateContractFromAI, type ChatMessage } from "./services/provider-factory";
import rateLimit from "express-rate-limit";

// Rate limit for public OTP endpoints (send + verify). 5 attempts per IP per 15 minutes.
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppi tentativi. Riprova tra qualche minuto." },
});

// Limita il numero di submit di dati cliente sull'endpoint pubblico
// (modalità "client_fill"): protegge dal flood verso lo storage e dalla
// possibilità di spam-mare la notifica al venditore.
const clientDataRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppe richieste. Riprova tra qualche minuto." },
});

// Whitelist dei campi che il cliente è autorizzato a scrivere via endpoint
// pubblico: solo i campi anagrafici. Tutto il resto (totalValue, durata,
// percentuali, ecc.) NON deve poter essere modificato dal cliente perché
// finirebbe direttamente nel testo del contratto generato.
const CLIENT_DATA_ALLOWED_KEYS: ReadonlySet<string> = new Set(SYNCED_FIELD_KEYS);

function sanitizeClientDataInput(input: unknown): Record<string, any> {
  const out: Record<string, any> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, any>)) {
    if (!CLIENT_DATA_ALLOWED_KEYS.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string") {
      // Limita la lunghezza per evitare payload abusivi nel PDF.
      out[k] = v.slice(0, 500);
    } else if (typeof v === "boolean" || typeof v === "number") {
      out[k] = v;
    }
    // Ignora array/oggetti annidati: i campi anagrafici sono tutti scalari.
  }
  return out;
}

// Max number of contract IDs accepted in a single bulk operation payload.
const BULK_IDS_MAX = 100;

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Helper function to ensure user is authenticated
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Global error handler for database connection issues
  const handleDbError = (error: any, req: any, res: any, next: any) => {
    if (error.code === '57P01') {
      return res.status(503).json({ 
        message: "Database temporarily unavailable. Please try again in a moment." 
      });
    }
    next(error);
  };

  // Helper function to ensure admin role
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Helper function to get real client IP
  const getRealClientIP = (req: any): string => {
    // Check X-Forwarded-For header first (most common)
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, first one is the original client
      const ips = xForwardedFor.split(',');
      return ips[0].trim();
    }

    // Fallback to other headers
    return req.headers['x-real-ip'] || 
           req.headers['x-client-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           'IP non disponibile';
  };

  // Template routes
  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      console.log("Fetching templates...");
      const templates = await storage.getTemplates(req.user.companyId);
      console.log("Templates fetched:", templates.length);
      res.json(templates);
    } catch (error) {
      console.error("Database error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Renders the contract preview without persisting anything to the DB.
  // Runs the same `generateContractContent` pipeline used by POST/PUT
  // /api/contracts so that what the seller previews is exactly what
  // /generate at send time. Returns also the template object and a safe
  // subset of company settings needed by the client-side renderer.
  const previewContractSchema = z.object({
    templateId: z.number().int().positive("templateId richiesto"),
    clientData: z.record(z.any()).default({}),
    totalValue: z.number().nullable().optional(),
    isPercentagePartnership: z.boolean().optional(),
    partnershipPercentage: z.number().nullable().optional(),
    autoRenewal: z.boolean().optional(),
    renewalDuration: z.number().int().positive().optional(),
    contractStartDate: z.string().optional(),
    contractEndDate: z.string().optional(),
    selectedSectionIds: z.array(z.string()).optional(),
    fillMode: z.enum(["seller", "client_fill"]).optional(),
    sendToEmail: z.string().optional(),
    // Variabili-prodotto orbitali, valori grezzi (numero o stringa).
    // Vengono iniettate come placeholder formattati lato server.
    accessLevel: z.string().nullable().optional(),
    // Stessi vincoli economici dell'insertContractSchema, replicati qui
    // perché /preview riceve il payload prima del parse principale e
    // dobbiamo bloccare valori incoerenti (canone <= 0, attivazione < 0)
    // anche su chiamate API dirette.
    monthlyFee: z.union([z.string(), z.number()]).nullable().optional().refine((v) => {
      if (v === undefined || v === null || v === "") return true;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
      return !isNaN(n) && n > 0;
    }, { message: "Il canone mensile deve essere maggiore di 0" }),
    activationFee: z.union([z.string(), z.number()]).nullable().optional().refine((v) => {
      if (v === undefined || v === null || v === "") return true;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
      return !isNaN(n) && n >= 0;
    }, { message: "Il costo di attivazione non può essere negativo" }),
    // Distingue token di anteprima per creazione vs aggiornamento di un
    // contratto già esistente. Il client deve dichiararlo esplicitamente
    // perché il token verrà legato a quello scope.
    contractId: z.number().int().positive().optional(),
  });

  function previewScopeFor(input: { contractId?: number | null }): PreviewScope {
    return input.contractId ? (`update-contract:${input.contractId}` as const) : "create-contract";
  }

  app.post("/api/contracts/preview", requireAuth, async (req, res) => {
    try {
      const input = previewContractSchema.parse(req.body);
      const template = await storage.getTemplate(input.templateId, req.user.companyId);
      if (!template) {
        return res.status(404).json({ message: "Template non trovato" });
      }
      const generatedContent = await generateContractContent(
        template.content,
        input.clientData,
        template,
        input.autoRenewal,
        input.renewalDuration,
        input.totalValue ?? undefined,
        input.isPercentagePartnership,
        input.partnershipPercentage ?? undefined,
        input.contractStartDate,
        input.contractEndDate,
        input.selectedSectionIds ?? null,
        {
          accessLevel: input.accessLevel ?? null,
          monthlyFee: input.monthlyFee ?? null,
          activationFee: input.activationFee ?? null,
        },
      );

      // Rete di sicurezza: se il template contiene placeholder `{{...}}`
      // ancora non risolti (es. il venditore non ha compilato livello /
      // canone / attivazione), restituiamo errore strutturato che il
      // wizard intercetta per portare l'utente al campo mancante.
      const unresolved = findUnresolvedPlaceholders(generatedContent);
      if (unresolved.length > 0) {
        return res.status(400).json({
          message: "Il contratto contiene variabili non compilate.",
          code: "UNRESOLVED_PLACEHOLDERS",
          missing: unresolved,
          missingLabels: unresolved.map((k) => ({
            key: k,
            label: PLACEHOLDER_LABELS[k]?.label || k,
            hint: PLACEHOLDER_LABELS[k]?.hint,
          })),
        });
      }
      const settings = await storage.getCompanySettings(req.user.companyId);
      const safeSettings = settings
        ? {
            companyName: settings.companyName,
            address: settings.address,
            city: settings.city,
            postalCode: settings.postalCode,
            taxId: settings.taxId,
            uniqueCode: settings.uniqueCode,
            pec: settings.pec,
            contractTitle: settings.contractTitle,
            logoUrl: settings.logoUrl,
          }
        : null;
      const scope = previewScopeFor({ contractId: input.contractId ?? null });
      const payloadHash = hashContractPayload(input);
      const previewToken = signPreviewToken({ hash: payloadHash, scope, userId: req.user.id });
      res.json({
        template,
        generatedContent,
        companySettings: safeSettings,
        previewToken,
        previewTokenScope: scope,
        previewTokenExpiresAt: Date.now() + 10 * 60 * 1000,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati anteprima non validi", errors: error.errors });
      }
      console.error("Preview error:", error);
      res.status(500).json({ message: "Impossibile generare l'anteprima" });
    }
  });

  // --------------------------------------------------------------
  // Anteprima dell'EMAIL che il cliente riceverà al momento dell'invio.
  // Restituisce subject, mittente, destinatario, link di firma e l'HTML
  // identico a quello che spediremo. Non spedisce nulla.
  // --------------------------------------------------------------
  app.post("/api/contracts/preview-email", requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const contractCode = (body.contractCode || "ANTEPRIMA").toString();
      const emailTo = (body.emailTo || body.sendToEmail || "").toString() || undefined;
      const clientData = body.clientData || {};

      // Verifica preventiva configurazione SMTP per dare un messaggio chiaro
      const emailStatus = await getEmailConfigStatusForCompany(req.user.companyId);
      if (!emailStatus.configured) {
        return res.status(400).json({
          message: "Email aziendale non configurata: impossibile generare l'anteprima dell'email.",
          code: "EMAIL_NOT_CONFIGURED",
          emailConfig: emailStatus,
        });
      }

      const built = await buildContractRequestEmail({
        contract: { sellerId: req.user.id, clientData },
        contractCode,
        emailTo,
        companyId: req.user.companyId,
      });

      // Difesa in profondità: anche l'email (subject + html) viene
      // controllata per placeholder {{...}} non risolti, così se in
      // futuro il template email dovesse iniziare a contenerne, il gate
      // non mostra mai una preview "rotta" al venditore.
      const emailUnresolved = findUnresolvedPlaceholders(`${built.subject}\n${built.html}`);
      if (emailUnresolved.length > 0) {
        return res.status(400).json({
          message: "Impossibile generare l'anteprima: l'email contiene variabili non compilate.",
          code: "UNRESOLVED_PLACEHOLDERS",
          missing: emailUnresolved,
          missingLabels: emailUnresolved.map((k) => ({
            key: k,
            label: PLACEHOLDER_LABELS[k]?.label || k,
            hint: PLACEHOLDER_LABELS[k]?.hint,
          })),
        });
      }

      res.json({
        subject: built.subject,
        html: built.html,
        fromName: built.fromName,
        fromEmail: built.fromEmail,
        fromHeader: built.fromHeader,
        to: built.to,
        signLink: built.signLink,
        clientName: built.clientName,
        contractCode: built.contractCode,
      });
    } catch (error: any) {
      console.error("Preview-email error:", error?.message || error);
      res.status(400).json({ message: error?.message || "Impossibile generare l'anteprima email" });
    }
  });

  app.get("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getTemplate(id, req.user.companyId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", requireAdmin, async (req, res) => {
    try {
      const templateData = insertContractTemplateSchema.parse({
        ...req.body,
        createdBy: req.user.id,
      });
      const template = await storage.createTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.put("/api/templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const templateData = insertContractTemplateSchema.partial().parse(req.body);
      const template = await storage.updateTemplate(id, templateData);
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTemplate(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ============================================================
  // Contract Presets routes (Preset Offerta riusabili)
  // ============================================================
  // Helper: estrae i campi rilevanti da un payload del form contratto
  // (bonus, piano pagamento, rate, sezioni selezionate, totale, durata...)
  // e li converte nello shape persistente del preset.
  const extractPresetFromContractForm = (body: any) => {
    const cd = body?.clientData ?? {};
    return {
      templateId: typeof body?.templateId === "number" ? body.templateId : null,
      selectedSectionIds: Array.isArray(body?.selectedSectionIds) ? body.selectedSectionIds : [],
      bonusList: Array.isArray(cd.bonus_list) ? cd.bonus_list : [],
      paymentPlan: Array.isArray(cd.payment_plan) ? cd.payment_plan : [],
      rataList: Array.isArray(cd.rata_list) ? cd.rata_list : [],
      totalValue: body?.totalValue ?? null,
      isPercentagePartnership: !!body?.isPercentagePartnership,
      partnershipPercentage: body?.partnershipPercentage ?? null,
      autoRenewal: !!body?.autoRenewal,
      renewalDuration: typeof body?.renewalDuration === "number" ? body.renewalDuration : 12,
      defaultDurationMonths: typeof body?.defaultDurationMonths === "number" ? body.defaultDurationMonths : null,
      fillMode: body?.fillMode === "client_fill" ? "client_fill" : "seller",
    };
  };

  app.get("/api/presets", requireAuth, async (req, res) => {
    try {
      const presets = await storage.listContractPresets(req.user.companyId, req.user.id);
      res.json(presets);
    } catch (err) {
      console.error("Errore lettura preset:", err);
      res.status(500).json({ message: "Impossibile caricare i preset" });
    }
  });

  app.get("/api/presets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const preset = await storage.getContractPreset(id, req.user.companyId, req.user.id);
      if (!preset) return res.status(404).json({ message: "Preset non trovato" });
      res.json(preset);
    } catch (err) {
      res.status(500).json({ message: "Errore caricamento preset" });
    }
  });

  app.post("/api/presets", requireAuth, async (req, res) => {
    try {
      const parsed = insertContractPresetSchema.parse(req.body);
      // Solo gli admin possono creare preset condivisi
      if (parsed.visibility === "shared" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Solo gli admin possono creare preset condivisi" });
      }
      // Se templateId fornito, verifica appartenenza alla company
      if (parsed.templateId) {
        const t = await storage.getTemplate(parsed.templateId, req.user.companyId);
        if (!t) return res.status(400).json({ message: "Template non valido per la tua azienda" });
      }
      const created = await storage.createContractPreset({
        ...parsed,
        companyId: req.user.companyId,
        createdBy: req.user.id,
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Dati non validi", errors: err.errors });
      console.error("Errore creazione preset:", err);
      res.status(500).json({ message: "Impossibile creare il preset" });
    }
  });

  // Helper endpoint: crea un preset partendo direttamente dal payload
  // del form contratto, evitando al frontend di rimappare i campi.
  app.post("/api/presets/from-contract-form", requireAuth, async (req, res) => {
    try {
      const meta = z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).nullish(),
        visibility: z.enum(["personal", "shared"]).default("personal"),
      }).parse(req.body?.meta ?? {});
      if (meta.visibility === "shared" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Solo gli admin possono creare preset condivisi" });
      }
      const extracted = extractPresetFromContractForm(req.body?.contractForm ?? {});
      const parsed = insertContractPresetSchema.parse({ ...meta, ...extracted });
      if (parsed.templateId) {
        const t = await storage.getTemplate(parsed.templateId, req.user.companyId);
        if (!t) return res.status(400).json({ message: "Template non valido per la tua azienda" });
      }
      const created = await storage.createContractPreset({
        ...parsed,
        companyId: req.user.companyId,
        createdBy: req.user.id,
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Dati non validi", errors: err.errors });
      console.error("Errore creazione preset da form:", err);
      res.status(500).json({ message: "Impossibile salvare il preset" });
    }
  });

  app.put("/api/presets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertContractPresetSchema.partial().parse(req.body);
      if (parsed.visibility === "shared" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Solo gli admin possono usare preset condivisi" });
      }
      if (parsed.templateId) {
        const t = await storage.getTemplate(parsed.templateId, req.user.companyId);
        if (!t) return res.status(400).json({ message: "Template non valido per la tua azienda" });
      }
      const updated = await storage.updateContractPreset(
        id,
        req.user.companyId,
        req.user.id,
        req.user.role === "admin",
        parsed,
      );
      if (!updated) return res.status(404).json({ message: "Preset non trovato o non modificabile" });
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Dati non validi", errors: err.errors });
      console.error("Errore aggiornamento preset:", err);
      res.status(500).json({ message: "Impossibile aggiornare il preset" });
    }
  });

  app.delete("/api/presets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteContractPreset(id, req.user.companyId, req.user.id, req.user.role === "admin");
      if (!ok) return res.status(404).json({ message: "Preset non trovato o non eliminabile" });
      res.status(204).send();
    } catch (err) {
      console.error("Errore eliminazione preset:", err);
      res.status(500).json({ message: "Impossibile eliminare il preset" });
    }
  });

  // Company settings routes
  const SMTP_PASS_MASK = "••••••••";
  const maskCompanySettings = (settings: any) => {
    if (!settings) return settings;
    const { smtpPass, ...rest } = settings;
    return {
      ...rest,
      smtpPass: null,
      smtpPassConfigured: Boolean(smtpPass && String(smtpPass).length > 0),
    };
  };

  app.get("/api/company-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getCompanySettings(req.user.companyId);
      res.json(maskCompanySettings(settings));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company settings" });
    }
  });

  app.put("/api/company-settings", requireAdmin, async (req, res) => {
    // We invalidate the SMTP transporter cache unconditionally at the end of this
    // request lifecycle (success OR partial failure after the update touched the
    // DB). This prevents stale transporters from lingering when any SMTP field may
    // have changed, regardless of which branch ran.
    const companyId = req.user.companyId;
    let needsCacheInvalidation = false;
    try {
      const settingsData = insertCompanySettingsSchema.parse(req.body);
      // Preserve existing smtpPass when client sends empty string or the masked placeholder
      const incomingPass = (settingsData as any).smtpPass;
      if (incomingPass === undefined || incomingPass === null || incomingPass === "" || incomingPass === SMTP_PASS_MASK) {
        const existing = await storage.getCompanySettings(companyId);
        (settingsData as any).smtpPass = existing?.smtpPass ?? null;
      }
      needsCacheInvalidation = true;
      const settings = await storage.updateCompanySettings(settingsData, companyId);
      res.json(maskCompanySettings(settings));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      }
      console.error("Failed to update company settings:", error);
      res.status(500).json({ message: "Failed to update company settings" });
    } finally {
      if (needsCacheInvalidation) {
        try {
          const { invalidateEmailTransporterCache } = await import('./services/email-service');
          invalidateEmailTransporterCache(companyId);
        } catch (invalidationError) {
          console.error("⚠️  Failed to invalidate SMTP transporter cache:", invalidationError);
        }
      }
    }
  });

  // Email configuration status (available to every authenticated user of the tenant)
  app.get("/api/company-settings/email-status", requireAuth, async (req, res) => {
    try {
      const status = await getEmailConfigStatusForCompany(req.user.companyId);
      res.json(status);
    } catch (error) {
      console.error("Failed to compute email config status:", error);
      res.status(500).json({ message: "Failed to read email configuration status" });
    }
  });

  // Send a test email using the current tenant's SMTP credentials
  app.post("/api/company-settings/test-email", requireAdmin, async (req, res) => {
    const schema = z.object({
      to: z.string().email("Indirizzo email non valido").optional(),
    });
    try {
      const { to } = schema.parse(req.body ?? {});
      const recipient = (to ?? req.user.email ?? "").trim();
      if (!recipient) {
        return res.status(400).json({ message: "Specifica un indirizzo email destinatario." });
      }
      const result = await sendTestEmail(req.user.companyId, recipient);
      res.json({
        success: true,
        message: `Email di prova inviata a ${recipient}.`,
        messageId: result.messageId,
        to: recipient,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      console.error("Test email error:", error);
      res.status(400).json({
        success: false,
        message: error?.message || "Invio email di prova fallito.",
      });
    }
  });

  // Presence (Task #12) — returns live + last-activity for contracts
  // visible to the seller. In-memory map is the source of truth for `live`,
  // DB columns mirror first/last activity. Cached briefly to keep polling cheap.
  let presenceCache: { at: number; companyId: number; sellerId?: number; data: any } | null = null;
  app.get("/api/contracts/presence", requireAuth, async (req, res) => {
    try {
      await ensurePresenceSchema();
      const sellerId = req.user.role === "seller" ? req.user.id : undefined;
      const companyId = req.user.companyId;
      const now = Date.now();
      if (
        presenceCache &&
        presenceCache.companyId === companyId &&
        presenceCache.sellerId === sellerId &&
        now - presenceCache.at < 2500
      ) {
        return res.json(presenceCache.data);
      }
      // Pull contractIds visible to this user, then fetch presence columns
      const params: any[] = [companyId];
      let where = "u.company_id = $1";
      if (sellerId) {
        params.push(sellerId);
        where += ` AND c.seller_id = $${params.length}`;
      }
      const result = await pool.query(
        `SELECT c.id, c.first_opened_at, c.last_activity_at
           FROM contracts c
           INNER JOIN users u ON u.id = c.seller_id
           WHERE ${where}`,
        params
      );
      const data = result.rows.map((r: any) => {
        const id = r.id as number;
        const liveCount = presenceByContract.get(id)?.size || 0;
        const liveSince = presenceFirstSessionAt.get(id) || null;
        return {
          contractId: id,
          live: liveCount > 0,
          liveSessions: liveCount,
          liveSinceMs: liveSince,
          firstOpenedAt: r.first_opened_at ? new Date(r.first_opened_at).toISOString() : null,
          lastActivityAt: r.last_activity_at ? new Date(r.last_activity_at).toISOString() : null,
        };
      });
      presenceCache = { at: now, companyId, sellerId, data };
      res.json(data);
    } catch (e) {
      console.error("Presence endpoint error:", e);
      res.status(500).json({ message: "Failed to fetch presence" });
    }
  });

  // Contract routes
  app.get("/api/contracts", requireAuth, async (req, res) => {
    try {
      const sellerId = req.user.role === "seller" ? req.user.id : undefined;
      const includeArchived = req.query.includeArchived === "true";
      const contracts = await storage.getContracts(req.user.companyId, sellerId, includeArchived);
      res.json(contracts);
    } catch (error) {
      console.error("Database error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  // Archive / unarchive contract
  app.post("/api/contracts/:id/archive", requireAuth, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContract(contractId, req.user.companyId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (req.user.role === "seller" && contract.sellerId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updated = await storage.setContractsArchived([contractId], req.user.companyId, true);
      if (updated.length === 0) return res.status(404).json({ message: "Contract not found" });
      await storage.createAuditLog({
        contractId,
        action: "archived",
        userAgent: req.get("User-Agent"),
        ipAddress: getRealClientIP(req),
        metadata: { archivedBy: req.user.id },
      });
      res.json({ message: "Contract archived" });
    } catch (error) {
      console.error("Archive error:", error);
      res.status(500).json({ message: "Failed to archive contract" });
    }
  });

  app.post("/api/contracts/:id/unarchive", requireAuth, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContract(contractId, req.user.companyId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (req.user.role === "seller" && contract.sellerId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updated = await storage.setContractsArchived([contractId], req.user.companyId, false);
      if (updated.length === 0) return res.status(404).json({ message: "Contract not found" });
      await storage.createAuditLog({
        contractId,
        action: "unarchived",
        userAgent: req.get("User-Agent"),
        ipAddress: getRealClientIP(req),
        metadata: { unarchivedBy: req.user.id },
      });
      res.json({ message: "Contract restored" });
    } catch (error) {
      console.error("Unarchive error:", error);
      res.status(500).json({ message: "Failed to restore contract" });
    }
  });

  // Bulk archive / unarchive
  app.post("/api/contracts/bulk-archive", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.number().int().positive()).min(1).max(BULK_IDS_MAX),
        archive: z.boolean().default(true),
      });
      const { ids, archive } = schema.parse(req.body);

      let allowedIds = ids;
      if (req.user.role === "seller") {
        const mine = await storage.getContracts(req.user.companyId, req.user.id, true);
        const mineIds = new Set(mine.map((c: any) => c.id));
        allowedIds = ids.filter(id => mineIds.has(id));
      }

      const updatedIds = await storage.setContractsArchived(allowedIds, req.user.companyId, archive);

      for (const id of updatedIds) {
        await storage.createAuditLog({
          contractId: id,
          action: archive ? "archived" : "unarchived",
          userAgent: req.get("User-Agent"),
          ipAddress: getRealClientIP(req),
          metadata: { bulk: true, by: req.user.id },
        });
      }

      res.json({
        message: `${updatedIds.length} contratti ${archive ? "archiviati" : "ripristinati"}`,
        count: updatedIds.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: error.errors });
      }
      console.error("Bulk archive error:", error);
      res.status(500).json({ message: "Failed to bulk archive" });
    }
  });

  // Duplicate contract
  app.post("/api/contracts/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const original = await storage.getContract(contractId, req.user.companyId);
      if (!original) return res.status(404).json({ message: "Contract not found" });
      if (req.user.role === "seller" && original.sellerId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Regenerate content from current template so duplicate reflects any template edits
      const template = await storage.getTemplate(original.templateId, req.user.companyId);
      if (!template) return res.status(400).json({ message: "Template not found" });

      const generatedContent = await generateContractContent(
        template.content,
        original.clientData,
        template,
        original.autoRenewal ?? undefined,
        original.renewalDuration ?? undefined,
        original.totalValue ?? undefined,
        original.isPercentagePartnership ?? undefined,
        original.partnershipPercentage ? Number(original.partnershipPercentage) : undefined,
        original.contractStartDate ? original.contractStartDate.toISOString() : undefined,
        original.contractEndDate ? original.contractEndDate.toISOString() : undefined,
        parseSelectedIds(original.selectedSectionIds),
        {
          accessLevel: original.accessLevel ?? null,
          monthlyFee: original.monthlyFee ?? null,
          activationFee: original.activationFee ?? null,
        },
      );

      const duplicatePayload = insertContractSchema.parse({
        templateId: original.templateId,
        sellerId: req.user.id,
        clientData: original.clientData,
        generatedContent,
        status: "draft",
        contractCode: nanoid(16),
        totalValue: original.totalValue,
        sentToEmail: null,
        signatures: null,
        signedAt: null,
        expiresAt: null,
        contractStartDate: original.contractStartDate,
        contractEndDate: original.contractEndDate,
        autoRenewal: original.autoRenewal ?? false,
        renewalDuration: original.renewalDuration ?? 12,
        isPercentagePartnership: original.isPercentagePartnership ?? false,
        partnershipPercentage: original.partnershipPercentage,
        // Preserve the original selection fedelmente: se il contratto
        // originale non aveva una scelta esplicita (legacy `null`),
        // manteniamo `null` così che rigenerazioni successive usino i
        // `defaultSelectedIds` del template, coerentemente con il
        // `generatedContent` appena duplicato.
        selectedSectionIds: parseSelectedIds(original.selectedSectionIds),
        pdfPath: null,
      });

      const newContract = await storage.createContract(duplicatePayload);

      await storage.createAuditLog({
        contractId: newContract.id,
        action: "duplicated",
        userAgent: req.get("User-Agent"),
        ipAddress: getRealClientIP(req),
        metadata: { duplicatedFrom: original.id, duplicatedBy: req.user.id },
      });

      res.json(newContract);
    } catch (error) {
      console.error("Duplicate error:", error);
      res.status(500).json({ message: "Failed to duplicate contract" });
    }
  });

  // Regenerate content from template (admin only) — preserves signatures and status
  app.post("/api/contracts/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(BULK_IDS_MAX) });
      const { ids } = schema.parse(req.body);
      const deletedIds = await storage.deleteContracts(ids, req.user.companyId);
      // Audit log entries for deleted contracts are also removed by the cascade,
      // so we only return the count to the client.
      res.json({
        message: `${deletedIds.length} contratti eliminati definitivamente`,
        count: deletedIds.length,
        ids: deletedIds,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: error.errors });
      }
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Failed to delete contracts" });
    }
  });

  app.post("/api/contracts/:id/regenerate-content", requireAdmin, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContract(contractId, req.user.companyId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const template = await storage.getTemplate(contract.templateId, req.user.companyId);
      if (!template) return res.status(400).json({ message: "Template not found" });

      const previousContent = contract.generatedContent || "";
      const newContent = await generateContractContent(
        template.content,
        contract.clientData,
        template,
        contract.autoRenewal ?? undefined,
        contract.renewalDuration ?? undefined,
        contract.totalValue ?? undefined,
        contract.isPercentagePartnership ?? undefined,
        contract.partnershipPercentage ? Number(contract.partnershipPercentage) : undefined,
        contract.contractStartDate ? contract.contractStartDate.toISOString() : undefined,
        contract.contractEndDate ? contract.contractEndDate.toISOString() : undefined,
        parseSelectedIds(contract.selectedSectionIds),
        {
          accessLevel: contract.accessLevel ?? null,
          monthlyFee: contract.monthlyFee ?? null,
          activationFee: contract.activationFee ?? null,
        },
      );

      // For signed contracts, regenerate the sealed PDF FIRST so we can fail atomically
      // before mutating generatedContent. We only persist content + pdfPath if the PDF succeeds.
      let newPdfPath: string | undefined;
      let regeneratedPdf = false;
      if (contract.status === "signed") {
        const auditLogs = await storage.getContractAuditLogs(contract.id);
        const pdfCompanySettings = await storage.getCompanySettings(req.user.companyId);
        const regenerationNotice = {
          regeneratedAt: new Date(),
          originalSignedAt: contract.signedAt,
          reason: (req.body?.reason as string | undefined) || "Rigenerazione contenuto da template aggiornato",
        };
        const contractForPdf = {
          id: contract.id,
          templateName: template.name || 'Contratto',
          generatedContent: newContent,
          clientData: contract.clientData,
          totalValue: contract.totalValue,
          // Unifichiamo la sorgente del corpo contratto: il PDF usa
          // `template.content = generatedContent` così il rendering è
          // identico a preview/client-view (sezioni modulari già risolte).
          template: { ...template, content: newContent },
          status: "signed" as const,
          signatures: contract.signatures || {},
          signedAt: contract.signedAt,
          createdAt: contract.createdAt,
          contractStartDate: contract.contractStartDate,
          contractEndDate: contract.contractEndDate,
          autoRenewal: contract.autoRenewal,
          renewalDuration: contract.renewalDuration,
          isPercentagePartnership: contract.isPercentagePartnership,
          partnershipPercentage: contract.partnershipPercentage,
          selectedSectionIds: contract.selectedSectionIds,
          regenerationNotice,
        };
        try {
          newPdfPath = await generatePDF(contract.id, newContent, auditLogs, contractForPdf, pdfCompanySettings);
          regeneratedPdf = true;
        } catch (pdfErr: any) {
          console.error("PDF regeneration failed; aborting content regeneration to keep body+PDF consistent:", pdfErr);
          return res.status(500).json({
            message: "Rigenerazione PDF fallita; contenuto NON aggiornato per mantenere coerenza con il PDF firmato.",
            error: pdfErr?.message || String(pdfErr),
          });
        }
      }

      // Persist content (and pdfPath if regenerated). Signatures, signedAt, status are preserved.
      const updates: { generatedContent: string; pdfPath?: string } = { generatedContent: newContent };
      if (newPdfPath) updates.pdfPath = newPdfPath;
      await storage.updateContract(contractId, updates);

      // Audit log with cryptographic SHA-256 before/after hashes
      const hash = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
      await storage.createAuditLog({
        contractId: contract.id,
        action: "content_regenerated",
        userAgent: req.get("User-Agent"),
        ipAddress: getRealClientIP(req),
        metadata: {
          regeneratedBy: req.user.id,
          reason: req.body?.reason || null,
          beforeHash: hash(previousContent),
          afterHash: hash(newContent),
          beforeLength: previousContent.length,
          afterLength: newContent.length,
          pdfRegenerated: regeneratedPdf,
          contractStatus: contract.status,
          signaturesPreserved: !!contract.signatures,
        },
      });

      const updated = await storage.getContract(contractId, req.user.companyId);
      res.json({ message: "Contenuto rigenerato con successo", contract: updated, pdfRegenerated: regeneratedPdf });
    } catch (error) {
      console.error("Content regeneration error:", error);
      res.status(500).json({ message: "Failed to regenerate content" });
    }
  });

  app.get("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const contract = await storage.getContract(id, req.user.companyId);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Check permissions
      if (req.user.role === "seller" && contract.sellerId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.put("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);

      // Get existing contract to check permissions and status
      const existingContract = await storage.getContract(contractId, req.user.companyId);
      if (!existingContract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Check permissions
      if (req.user.role === "seller" && existingContract.sellerId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Allow editing of contracts in any status for real-time updates
      // (Previously restricted to draft only, now allows modifications at any stage)

      // Generate contract content from template
      const template = await storage.getTemplate(req.body.templateId, req.user.companyId);
      if (!template) {
        return res.status(400).json({ message: "Template not found" });
      }

      const generatedContent = await generateContractContent(
        template.content, 
        req.body.clientData, 
        template, 
        req.body.autoRenewal, 
        req.body.renewalDuration,
        req.body.totalValue,
        req.body.isPercentagePartnership,
        req.body.partnershipPercentage,
        req.body.contractStartDate,
        req.body.contractEndDate,
        req.body.selectedSectionIds ?? existingContract.selectedSectionIds ?? null,
        {
          accessLevel: req.body.accessLevel ?? existingContract.accessLevel ?? null,
          monthlyFee: req.body.monthlyFee ?? existingContract.monthlyFee ?? null,
          activationFee: req.body.activationFee ?? existingContract.activationFee ?? null,
        },
      );

      // Validate the updated contract data
      const contractData = insertContractSchema.partial().parse({
        ...req.body,
        generatedContent,
      });

      // If the client asked to send immediately, verify SMTP is configured BEFORE
      // persisting any change, so that a "missing SMTP" case doesn't leave the
      // contract half-saved with the client seeing an error.
      let emailNotConfigured: { configured: boolean; missingFields: string[] } | null = null;
      if (req.body.sendImmediately) {
        // Gate: invio immediato richiede sempre un previewToken HMAC valido
        const expectedHash = hashContractPayload(req.body);
        const verification = verifyPreviewToken(req.body.previewToken, {
          hash: expectedHash,
          scope: `update-contract:${contractId}`,
          userId: req.user.id,
        });
        if (!verification.ok) {
          return res.status(400).json({
            message: verification.reason,
            code: `PREVIEW_TOKEN_${verification.code}`,
          });
        }
        // Rete di sicurezza pre-invio: blocca l'invio al cliente se il
        // contenuto generato contiene ancora placeholder `{{...}}` non
        // risolti. Si esegue PRIMA di toccare il DB per evitare di
        // marcare il contratto come "sent" quando non lo è realmente.
        const unresolved = findUnresolvedPlaceholders(generatedContent);
        if (unresolved.length > 0) {
          return res.status(400).json({
            message: "Impossibile inviare: il contratto contiene variabili non compilate.",
            code: "UNRESOLVED_PLACEHOLDERS",
            missing: unresolved,
            missingLabels: unresolved.map((k) => ({
              key: k,
              label: PLACEHOLDER_LABELS[k]?.label || k,
              hint: PLACEHOLDER_LABELS[k]?.hint,
            })),
          });
        }
        const emailStatus = await getEmailConfigStatusForCompany(req.user.companyId);
        if (!emailStatus.configured) {
          emailNotConfigured = emailStatus;
        }
      }

      const updatedContract = await storage.updateContract(contractId, contractData);

      // Log the update action (keep in sync with non-send path below)
      await storage.createAuditLog({
        contractId: contractId,
        action: "updated",
        userAgent: req.get("User-Agent"),
        ipAddress: getRealClientIP(req),
        metadata: {
          updatedBy: req.user.id,
          previousStatus: existingContract.status
        },
      });

      if (emailNotConfigured) {
        return res.json({
          ...updatedContract,
          message: "Contratto aggiornato, ma non inviato: configura l'email aziendale in Impostazioni Azienda → Configurazione Email per poterlo inviare.",
          warning: "EMAIL_NOT_CONFIGURED",
          emailConfig: emailNotConfigured,
        });
      }

      // Send email if contract is being sent immediately
      let emailSendError: string | null = null;
      if (req.body.sendImmediately) {
        const emailToSend = req.body.sendToEmail || contractData.clientData?.email;
        console.log('🔄 Richiesta invio immediato contratto modificato');
        console.log('📧 Email di destinazione:', emailToSend);
        console.log('📋 ID contratto:', contractId);
        console.log('🔗 Codice contratto:', existingContract.contractCode);

        try {
          await sendContractEmail(updatedContract, existingContract.contractCode, emailToSend);
          const effectiveFillMode = (req.body.fillMode || (existingContract as any).fillMode || "seller");
          const sentStatus = effectiveFillMode === "client_fill" ? "awaiting_client_data" : "sent";
          await storage.updateContract(contractId, { 
            status: sentStatus,
            sentToEmail: emailToSend 
          });
          console.log(`✅ Contratto aggiornato con status "${sentStatus}"`);

          // Log audit trail
          await storage.createAuditLog({
            contractId: contractId,
            action: "sent",
            userAgent: req.get("User-Agent"),
            ipAddress: getRealClientIP(req),
            metadata: { 
              sentBy: req.user.id,
              sentToEmail: emailToSend,
              method: "email",
              action: "updated_and_sent"
            },
          });
        } catch (emailError: any) {
          console.error("❌ ERRORE nell'invio email durante modifica contratto:");
          console.error("  - Errore:", emailError.message);
          console.error("  - Stack:", emailError.stack);
          emailSendError = emailError?.message || "Errore sconosciuto durante l'invio email.";
        }
      }

      if (emailSendError) {
        return res.json({
          ...updatedContract,
          message: `Contratto aggiornato, ma l'invio email è fallito: ${emailSendError}`,
          warning: "EMAIL_SEND_FAILED",
          emailError: emailSendError,
        });
      }

      res.json({ 
        ...updatedContract, 
        message: "Contratto aggiornato con successo" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      }
      console.error("Contract update error:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.post("/api/contracts", requireAuth, async (req, res) => {
    try {
      const contractCode = nanoid(16);
      console.log("Request body:", JSON.stringify(req.body, null, 2));

      // Generate contract content from template first
      const template = await storage.getTemplate(req.body.templateId, req.user.companyId);
      if (!template) {
        return res.status(400).json({ message: "Template not found" });
      }

      // Modalità "cliente compila e firma": il venditore può creare il contratto
      // anche senza dati anagrafici completi (basta l'email). Il content verrà
      // rigenerato quando il cliente avrà compilato i propri dati.
      const fillMode: "seller" | "client_fill" =
        req.body.fillMode === "client_fill" ? "client_fill" : "seller";

      if (fillMode === "client_fill") {
        const email = (req.body?.clientData?.email || req.body?.sendToEmail || "").trim();
        if (!email) {
          return res.status(400).json({
            message: "Per la modalità 'cliente compila' serve almeno l'email del destinatario.",
          });
        }
        // Normalizza minimo indispensabile
        req.body.clientData = {
          tipo_cliente: req.body.clientData?.tipo_cliente || "azienda",
          ...(req.body.clientData || {}),
          email,
        };
      }

      const generatedContent = await generateContractContent(
        template.content, 
        req.body.clientData, 
        template, 
        req.body.autoRenewal, 
        req.body.renewalDuration,
        req.body.totalValue,
        req.body.isPercentagePartnership,
        req.body.partnershipPercentage,
        req.body.contractStartDate,
        req.body.contractEndDate,
        req.body.selectedSectionIds ?? null,
        {
          accessLevel: req.body.accessLevel ?? null,
          monthlyFee: req.body.monthlyFee ?? null,
          activationFee: req.body.activationFee ?? null,
        },
      );

      // Now validate the complete contract data including generated content
      const contractData = insertContractSchema.parse({
        ...req.body,
        sellerId: req.user.id,
        contractCode,
        status: "draft",
        fillMode,
        generatedContent,
      });

      const contract = await storage.createContract(contractData);

      // Send email if contract is being sent immediately
      if (req.body.sendImmediately) {
        // Gate: l'invio immediato richiede sempre un previewToken HMAC
        // valido, prodotto da /api/contracts/preview e poi confermato
        // dall'utente nel gate "Conferma invio contratto al cliente".
        const expectedHash = hashContractPayload(req.body);
        const verification = verifyPreviewToken(req.body.previewToken, {
          hash: expectedHash,
          scope: "create-contract",
          userId: req.user.id,
        });
        if (!verification.ok) {
          await storage.deleteContracts([contract.id], req.user.companyId).catch(() => {});
          return res.status(400).json({
            message: verification.reason,
            code: `PREVIEW_TOKEN_${verification.code}`,
          });
        }
        // Rete di sicurezza esplicita anche in fase di creazione: il
        // previewToken di per sé è già sufficiente (preview ha già
        // bloccato i placeholder), ma una doppia verifica difende da
        // eventuali bypass futuri o token riusati su payload diversi.
        const unresolved = findUnresolvedPlaceholders(generatedContent);
        if (unresolved.length > 0) {
          await storage.deleteContracts([contract.id], req.user.companyId).catch(() => {});
          return res.status(400).json({
            message: "Impossibile inviare: il contratto contiene variabili non compilate.",
            code: "UNRESOLVED_PLACEHOLDERS",
            missing: unresolved,
            missingLabels: unresolved.map((k) => ({
              key: k,
              label: PLACEHOLDER_LABELS[k]?.label || k,
              hint: PLACEHOLDER_LABELS[k]?.hint,
            })),
          });
        }
        const emailToSend = req.body.sendToEmail || contractData.clientData.email;
        console.log('🚀 Richiesta invio immediato contratto');
        console.log('📧 Email di destinazione:', emailToSend);
        console.log('📋 ID contratto:', contract.id);
        console.log('🔗 Codice contratto:', contractCode);

        const emailStatus = await getEmailConfigStatusForCompany(req.user.companyId);
        if (!emailStatus.configured) {
          return res.status(201).json({
            ...contract,
            message: "Contratto creato come bozza. Configura l'email aziendale in Impostazioni Azienda → Configurazione Email per poterlo inviare.",
            warning: "EMAIL_NOT_CONFIGURED",
            emailConfig: emailStatus,
          });
        }

        try {
          await sendContractEmail(contract, contractCode, emailToSend);
          const sentStatus = fillMode === "client_fill" ? "awaiting_client_data" : "sent";
          await storage.updateContract(contract.id, { 
            status: sentStatus,
            sentToEmail: emailToSend 
          });
          console.log(`✅ Contratto aggiornato con status "${sentStatus}"`);

          // Log audit trail
          await storage.createAuditLog({
            contractId: contract.id,
            action: "sent",
            userAgent: req.get("User-Agent"),
            ipAddress: getRealClientIP(req),
            metadata: { 
              sentBy: req.user.id,
              sentToEmail: emailToSend,
              method: "email",
              fillMode,
            },
          });
        } catch (emailError: any) {
          console.error("❌ ERRORE nell'invio email durante creazione contratto:");
          console.error("  - Errore:", emailError.message);
          console.error("  - Stack:", emailError.stack);
          // Don't fail the entire contract creation if email fails
          // Mark as draft instead of sent and surface a readable warning
          await storage.updateContract(contract.id, { status: "draft" });
          console.log('📝 Contratto mantenuto come "draft" a causa dell\'errore email');
          return res.status(201).json({
            ...contract,
            message: `Contratto creato come bozza: invio email fallito (${emailError?.message || "errore SMTP sconosciuto"}).`,
            warning: "EMAIL_SEND_FAILED",
            emailError: emailError?.message || "Errore sconosciuto durante l'invio email.",
          });
        }
      }

      // Check final contract status to provide appropriate response
      const finalContract = await storage.getContract(contract.id, req.user.companyId);

      if (finalContract?.status === "sent") {
        res.status(201).json({ 
          ...contract, 
          message: "Contratto creato e inviato con successo" 
        });
      } else {
        res.status(201).json({ 
          ...contract, 
          message: "Contratto creato con successo." 
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      }
      console.error("Contract creation error:", error);
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  // ----------------------------------------------------------------
  // BULK: crea N bozze da template per una lista di email.
  // I contratti vengono creati in modalità "client_fill" e raggruppati da
  // batchId/batchLabel così la dashboard può mostrarli insieme e l'invio
  // di massa successivo è semplice.
  // ----------------------------------------------------------------
  app.post("/api/contracts/bulk-from-template", requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const templateId = Number(body.templateId);
      const emailsRaw = Array.isArray(body.emails) ? body.emails : [];
      const label = (body.batchLabel || "").toString().trim() || `Lotto del ${new Date().toLocaleString("it-IT")}`;

      if (!templateId) return res.status(400).json({ message: "templateId mancante" });
      if (emailsRaw.length === 0) return res.status(400).json({ message: "Nessuna email fornita" });
      if (emailsRaw.length > BULK_IDS_MAX) {
        return res.status(400).json({ message: `Massimo ${BULK_IDS_MAX} destinatari per lotto.` });
      }

      const template = await storage.getTemplate(templateId, req.user.companyId);
      if (!template) return res.status(400).json({ message: "Template non trovato" });

      // Pulisci e dedup-a la lista email
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const seen = new Set<string>();
      const emails: string[] = [];
      const invalid: string[] = [];
      for (const e of emailsRaw) {
        const v = String(e || "").trim().toLowerCase();
        if (!v) continue;
        if (!emailRe.test(v)) { invalid.push(v); continue; }
        if (seen.has(v)) continue;
        seen.add(v);
        emails.push(v);
      }
      if (emails.length === 0) {
        return res.status(400).json({ message: "Nessuna email valida.", invalid });
      }

      const batchId = nanoid(12);
      const created: any[] = [];
      const failed: { email: string; error: string }[] = [];

      // Sanitizza la bonus list (formato { bonus_descrizione }) — solo
      // stringhe brevi, niente oggetti annidati.
      const bonusListInput: Array<{ bonus_descrizione: string }> = Array.isArray(body.bonusList)
        ? body.bonusList
            .map((b: any) => ({
              bonus_descrizione: String(b?.bonus_descrizione || b?.description || "").trim().slice(0, 300),
            }))
            .filter((b: { bonus_descrizione: string }) => b.bonus_descrizione.length > 0)
        : [];

      const selectedSectionIds = Array.isArray(body.selectedSectionIds)
        ? (body.selectedSectionIds as unknown[]).filter((v): v is string => typeof v === "string")
        : null;

      for (const email of emails) {
        try {
          const contractCode = nanoid(16);
          const clientData: Record<string, any> = { tipo_cliente: "azienda", email };
          if (bonusListInput.length > 0) clientData.bonus_list = bonusListInput;
          const generatedContent = await generateContractContent(
            template.content,
            clientData,
            template,
            !!body.autoRenewal,
            body.renewalDuration ?? 12,
            body.totalValue,
            body.isPercentagePartnership,
            body.partnershipPercentage,
            body.contractStartDate,
            body.contractEndDate,
            selectedSectionIds,
            {
              accessLevel: body.accessLevel ?? null,
              monthlyFee: body.monthlyFee ?? null,
              activationFee: body.activationFee ?? null,
            },
          );
          // partnershipPercentage è `numeric` lato DB (drizzle-zod lo
          // tipizza come stringa): convertiamo qui i valori numerici
          // ricevuti dal wizard per non far fallire la validazione.
          const partnershipPercentageStr =
            body.partnershipPercentage === null || body.partnershipPercentage === undefined
              ? null
              : String(body.partnershipPercentage);
          const data = insertContractSchema.parse({
            templateId,
            sellerId: req.user.id,
            companyId: req.user.companyId,
            clientData,
            generatedContent,
            contractCode,
            status: "draft",
            fillMode: "client_fill",
            batchId,
            batchLabel: label,
            totalValue: body.totalValue ?? null,
            autoRenewal: !!body.autoRenewal,
            renewalDuration: body.renewalDuration ?? 12,
            isPercentagePartnership: !!body.isPercentagePartnership,
            partnershipPercentage: partnershipPercentageStr,
            contractStartDate: body.contractStartDate ?? null,
            contractEndDate: body.contractEndDate ?? null,
            selectedSectionIds,
            sentToEmail: email,
          });
          const c = await storage.createContract(data);
          created.push({ id: c.id, contractCode: c.contractCode, email });
        } catch (e: any) {
          failed.push({ email, error: e?.message || "errore" });
        }
      }

      res.status(201).json({
        message: `Creati ${created.length} contratti su ${emails.length} email valide.`,
        batchId,
        batchLabel: label,
        created,
        failed,
        invalid,
      });
    } catch (err: any) {
      console.error("[bulk-from-template] errore:", err?.message || err);
      res.status(500).json({ message: "Creazione in blocco non riuscita." });
    }
  });

  // BULK send preview: restituisce l'elenco dei destinatari + un previewToken
  // HMAC che il client dovrà rispedire al momento dell'invio reale.
  app.post("/api/contracts/bulk-send/preview", requireAuth, async (req, res) => {
    try {
      const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((x: any) => Number(x)).filter(Boolean) : [];
      if (ids.length === 0) return res.status(400).json({ message: "Nessun contratto selezionato." });
      if (ids.length > BULK_IDS_MAX) return res.status(400).json({ message: `Massimo ${BULK_IDS_MAX} contratti per invio.` });

      const emailStatus = await getEmailConfigStatusForCompany(req.user.companyId);
      const settings = await storage.getCompanySettings(req.user.companyId);
      const subjectTemplate = settings?.contractTitle
        ? `${settings.contractTitle} — {{codice}}`
        : "Compila e firma il contratto — {{codice}}";
      const recipients: Array<{
        id: number;
        contractCode: string;
        templateName: string | null;
        clientLabel: string;
        email: string | null;
        totalEuro: number | null;
        emailSubject: string;
        eligible: boolean;
        reason?: string;
      }> = [];

      for (const id of ids) {
        const c = await storage.getContract(id, req.user.companyId);
        if (!c) {
          recipients.push({
            id, contractCode: "?", templateName: null, clientLabel: "?",
            email: null, totalEuro: null, emailSubject: "",
            eligible: false, reason: "non trovato",
          });
          continue;
        }
        if (req.user.role === "seller" && c.sellerId !== req.user.id) {
          recipients.push({
            id, contractCode: c.contractCode, templateName: null, clientLabel: "?",
            email: null, totalEuro: null, emailSubject: "",
            eligible: false, reason: "non autorizzato",
          });
          continue;
        }
        const cd: any = c.clientData || {};
        const clientLabel = cd.societa || cd.cliente_nome || cd.nome || "—";
        const email = c.sentToEmail || cd.email || null;
        const totalEuro = typeof c.totalValue === "number" ? c.totalValue / 100 : null;
        const emailSubject = subjectTemplate.replace("{{codice}}", c.contractCode);
        let templateName: string | null = null;
        try {
          const t = await storage.getTemplate(c.templateId, req.user.companyId);
          templateName = t?.name ?? null;
        } catch {}
        let eligible = true;
        let reason: string | undefined;
        if (c.isArchived) { eligible = false; reason = "contratto archiviato"; }
        else if (c.status !== "draft") { eligible = false; reason = `stato non valido (${c.status})`; }
        else if ((c as any).fillMode !== "client_fill") { eligible = false; reason = "non è in modalità 'compila il cliente'"; }
        else if (!email) { eligible = false; reason = "email mancante"; }
        else {
          // Rete di sicurezza: se nel contenuto già salvato restano
          // placeholder `{{...}}` non risolti (tipicamente le variabili
          // prodotto del template orbitale non compilate sui contratti
          // creati da bulk-from-template), il contratto va escluso.
          const unresolved = findUnresolvedPlaceholders(c.generatedContent || "");
          // Le variabili compilate dal cliente in modalità client_fill
          // sono accettabili: vengono iniettate al submit del modulo.
          // Filtriamo via i campi anagrafici noti per non bloccare i
          // bulk legittimi.
          const blocking = unresolved.filter(
            (k) => !["nome", "cognome", "codice_fiscale", "data_nascita", "luogo_nascita", "indirizzo_residenza", "residente_a", "provincia_residenza", "nome_legale_rappresentante", "cognome_legale_rappresentante", "societa", "ragione_sociale", "sede", "indirizzo", "provincia_sede", "partita_iva", "telefono", "email"].includes(k),
          );
          if (blocking.length > 0) {
            eligible = false;
            reason = `variabili non compilate: ${blocking.map((k) => PLACEHOLDER_LABELS[k]?.label || k).join(", ")}`;
          }
        }
        recipients.push({
          id, contractCode: c.contractCode, templateName, clientLabel,
          email, totalEuro, emailSubject, eligible, reason,
        });
      }

      const eligibleIds = recipients.filter((r) => r.eligible).map((r) => r.id);
      const previewToken = eligibleIds.length > 0
        ? signPreviewToken({ hash: hashBulkIds(eligibleIds), scope: "bulk-send", userId: req.user.id })
        : null;

      res.json({
        recipients,
        eligibleIds,
        previewToken,
        previewTokenExpiresAt: previewToken ? Date.now() + 10 * 60 * 1000 : null,
        emailConfig: emailStatus,
      });
    } catch (err: any) {
      console.error("[bulk-send/preview] errore:", err?.message || err);
      res.status(500).json({ message: "Anteprima invio in blocco non riuscita." });
    }
  });

  // BULK send: prende una lista di id e invia il link a ognuno (best-effort).
  app.post("/api/contracts/bulk-send", requireAuth, async (req, res) => {
    try {
      const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((x: any) => Number(x)).filter(Boolean) : [];
      if (ids.length === 0) return res.status(400).json({ message: "Nessun contratto selezionato." });
      if (ids.length > BULK_IDS_MAX) return res.status(400).json({ message: `Massimo ${BULK_IDS_MAX} contratti per invio.` });

      // Gate: invio in blocco richiede sempre un previewToken HMAC firmato
      // sull'esatto insieme di id che l'utente ha visto nell'anteprima.
      const tokenCheck = verifyPreviewToken(req.body?.previewToken, {
        hash: hashBulkIds(ids),
        scope: "bulk-send",
        userId: req.user.id,
      });
      if (!tokenCheck.ok) {
        return res.status(400).json({
          message: tokenCheck.reason,
          code: `PREVIEW_TOKEN_${tokenCheck.code}`,
        });
      }

      const emailStatus = await getEmailConfigStatusForCompany(req.user.companyId);
      if (!emailStatus.configured) {
        return res.status(400).json({
          message: "Email aziendale non configurata: impossibile inviare.",
          code: "EMAIL_NOT_CONFIGURED",
        });
      }

      const sent: number[] = [];
      const failed: { id: number; error: string }[] = [];
      for (const id of ids) {
        try {
          const c = await storage.getContract(id, req.user.companyId);
          if (!c) { failed.push({ id, error: "non trovato" }); continue; }
          if (req.user.role === "seller" && c.sellerId !== req.user.id) {
            failed.push({ id, error: "non autorizzato" }); continue;
          }
          // Guard: l'invio in blocco è pensato esclusivamente per i lotti
          // creati con bulk-from-template (bozze in modalità client_fill).
          // Rifiutiamo qualsiasi contratto fuori da questo perimetro per
          // evitare transizioni di stato indesiderate sui contratti già
          // gestiti dal seller in modo classico.
          if (c.isArchived) { failed.push({ id, error: "contratto archiviato" }); continue; }
          if (c.status !== "draft") { failed.push({ id, error: `stato non valido (${c.status})` }); continue; }
          if ((c as any).fillMode !== "client_fill") {
            failed.push({ id, error: "non è in modalità 'compila il cliente'" }); continue;
          }
          const email = c.sentToEmail || (c.clientData as any)?.email;
          if (!email) { failed.push({ id, error: "email mancante" }); continue; }
          // Stessa rete di sicurezza dell'anteprima bulk: rifiuta i
          // contratti con variabili-prodotto irrisolte.
          const unresolved = findUnresolvedPlaceholders(c.generatedContent || "");
          const blocking = unresolved.filter(
            (k) => !["nome", "cognome", "codice_fiscale", "data_nascita", "luogo_nascita", "indirizzo_residenza", "residente_a", "provincia_residenza", "nome_legale_rappresentante", "cognome_legale_rappresentante", "societa", "ragione_sociale", "sede", "indirizzo", "provincia_sede", "partita_iva", "telefono", "email"].includes(k),
          );
          if (blocking.length > 0) {
            failed.push({ id, error: `variabili non compilate: ${blocking.map((k) => PLACEHOLDER_LABELS[k]?.label || k).join(", ")}` });
            continue;
          }
          await sendContractEmail(c, c.contractCode, email);
          await storage.updateContract(c.id, { status: "awaiting_client_data", sentToEmail: email });
          await storage.createAuditLog({
            contractId: c.id,
            action: "sent",
            userAgent: req.get("User-Agent"),
            ipAddress: getRealClientIP(req),
            metadata: { sentBy: req.user.id, sentToEmail: email, method: "email", bulk: true },
          });
          sent.push(id);
        } catch (e: any) {
          failed.push({ id, error: e?.message || "errore" });
        }
      }

      res.json({
        message: `Inviati ${sent.length} contratti su ${ids.length}.`,
        sent,
        failed,
      });
    } catch (err: any) {
      console.error("[bulk-send] errore:", err?.message || err);
      res.status(500).json({ message: "Invio in blocco non riuscito." });
    }
  });

  // Client contract view (no auth required, uses contract code)
  app.get("/api/client/contracts/:code", async (req, res) => {
    try {
      const contract = await storage.getContractByCode(req.params.code);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Get company settings for the specific company that owns this contract
      const contractCompanySettings = await storage.getCompanySettings(contract.companyId);

      // Check if this IP has already viewed the contract recently (within 5 minutes)
      const currentIP = getRealClientIP(req);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Get recent audit logs for this contract
      const recentLogs = await storage.getContractAuditLogs(contract.id);
      const recentViewFromSameIP = recentLogs.find(log => 
        log.action === "viewed" && 
        log.ipAddress === currentIP && 
        log.timestamp > fiveMinutesAgo
      );

      // Log view action only if not already viewed from same IP recently
      if (!recentViewFromSameIP) {
        await storage.createAuditLog({
          contractId: contract.id,
          action: "viewed",
          userAgent: req.get("User-Agent"),
          ipAddress: currentIP,
          metadata: {
            accessMethod: req.query.email ? "email_link" : "direct_link",
            emailUsed: req.query.email || null
          }
        });
      }

      // Mirror "first opened" + "last activity" on the contract row so the
      // seller dashboard can show last-seen even if the client closes the
      // page before the presence WS connects.
      presenceMarkOpen(contract.id).catch(() => {});

      // Update status if first view. Per i contratti in modalità
      // "client_fill" il cliente passa a "viewed" solo dopo aver
      // completato i dati anagrafici: altrimenti la UI gating sull'OTP
      // resterebbe bloccata su un documento ancora con placeholder.
      const cFillModeForStatus = (contract as any).fillMode === "client_fill" ? "client_fill" : "seller";
      const missingForStatus = getMissingClientFields(contract.clientData as any);
      const dataCompleteForStatus = missingForStatus.length === 0;
      if (contract.status === "sent") {
        await storage.updateContract(contract.id, { status: "viewed" });
        contract.status = "viewed";
      } else if (
        contract.status === "awaiting_client_data" &&
        cFillModeForStatus === "client_fill" &&
        dataCompleteForStatus
      ) {
        await storage.updateContract(contract.id, { status: "viewed" });
        contract.status = "viewed";
      }

      // Public client endpoint: whitelist response fields to avoid leaking internal
      // identifiers (sellerId, companyId, userId, pdfPath, etc.) to unauthenticated
      // callers who only have the contract code.
      // In modalità "client_fill", finché il cliente non ha completato i dati,
      // omettiamo il generatedContent (contiene placeholder vuoti) ed esponiamo
      // solo l'anteprima delle condizioni commerciali.
      const cFillMode = (contract as any).fillMode === "client_fill" ? "client_fill" : "seller";
      const missingFields = getMissingClientFields(contract.clientData as any);
      const dataComplete = missingFields.length === 0;

      // In modalità "client_fill" prima della compilazione, generiamo
      // un'anteprima del contratto usando i dati cliente parziali (i
      // placeholder per i campi mancanti restano vuoti). Così il cliente
      // può comunque scorrere e leggere il corpo del template scelto dal
      // venditore mentre compila il modulo in alto.
      let exposedGeneratedContent: string | null = contract.generatedContent;
      let publicTemplate: any = null;
      if (cFillMode === "client_fill" && !dataComplete) {
        try {
          const tplForPreview = await storage.getTemplate(
            contract.templateId,
            (contract as any).companyId
          );
          if (tplForPreview) {
            exposedGeneratedContent = await generateContractContent(
              tplForPreview.content,
              contract.clientData,
              tplForPreview,
              contract.autoRenewal ?? undefined,
              contract.renewalDuration ?? undefined,
              contract.totalValue ?? undefined,
              contract.isPercentagePartnership ?? undefined,
              contract.partnershipPercentage as any,
              contract.contractStartDate ?? undefined,
              contract.contractEndDate ?? undefined,
              contract.selectedSectionIds ?? undefined,
              {
                accessLevel: contract.accessLevel ?? null,
                monthlyFee: contract.monthlyFee ?? null,
                activationFee: contract.activationFee ?? null,
              },
            );
            publicTemplate = {
              id: tplForPreview.id,
              name: tplForPreview.name,
              content: tplForPreview.content,
              customContent: (tplForPreview as any).customContent ?? null,
              paymentText: (tplForPreview as any).paymentText ?? null,
              predefinedBonuses: (tplForPreview as any).predefinedBonuses ?? null,
              sections: (tplForPreview as any).sections ?? null,
            };
          } else {
            exposedGeneratedContent = null;
          }
        } catch (previewErr) {
          console.error("Failed to generate client_fill preview content", previewErr);
          exposedGeneratedContent = null;
        }
      }

      const safeContract = {
        id: contract.id,
        contractCode: contract.contractCode,
        templateId: contract.templateId,
        status: contract.status,
        fillMode: cFillMode,
        dataComplete,
        clientData: contract.clientData,
        template: publicTemplate,
        generatedContent: exposedGeneratedContent,
        totalValue: contract.totalValue,
        signatures: contract.signatures,
        signedAt: contract.signedAt,
        createdAt: contract.createdAt,
        contractStartDate: contract.contractStartDate,
        contractEndDate: contract.contractEndDate,
        autoRenewal: contract.autoRenewal,
        renewalDuration: contract.renewalDuration,
        isPercentagePartnership: contract.isPercentagePartnership,
        partnershipPercentage: contract.partnershipPercentage,
        sentToEmail: contract.sentToEmail,
        selectedSectionIds: contract.selectedSectionIds,
      };
      const safeCompanySettings = contractCompanySettings ? {
        companyName: contractCompanySettings.companyName,
        address: contractCompanySettings.address,
        city: contractCompanySettings.city,
        postalCode: contractCompanySettings.postalCode,
        taxId: contractCompanySettings.taxId,
        vatId: contractCompanySettings.vatId,
        pec: contractCompanySettings.pec,
        contractTitle: contractCompanySettings.contractTitle,
        logoUrl: contractCompanySettings.logoUrl,
        otpMethod: contractCompanySettings.otpMethod,
      } : null;

      res.json({
        ...safeContract,
        companySettings: safeCompanySettings,
      });
    } catch (error) {
      console.error("Database error fetching client contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  // ----------------------------------------------------------------
  // Modalità "cliente compila": il cliente salva i propri dati anagrafici
  // dal link pubblico, senza autenticazione (è protetto solo dal contractCode).
  // ----------------------------------------------------------------
  app.post("/api/client/contracts/:code/client-data", clientDataRateLimiter, async (req, res) => {
    try {
      const contract = await storage.getContractByCode(req.params.code);
      if (!contract) {
        return res.status(404).json({ message: "Contratto non trovato" });
      }
      if ((contract as any).fillMode !== "client_fill") {
        return res.status(400).json({ message: "Questo contratto non è in modalità compilazione cliente." });
      }
      if (contract.status === "signed") {
        return res.status(400).json({ message: "Contratto già firmato." });
      }

      // Sanitizza l'input: solo campi anagrafici whitelistati, niente
      // sovrascrittura di campi commerciali (prezzo, durata, ecc.) che
      // verrebbero iniettati direttamente nel testo del contratto.
      const incoming = sanitizeClientDataInput(req.body?.clientData);
      const merged: Record<string, any> = {
        ...(contract.clientData as any || {}),
        ...incoming,
      };
      // Email non sovrascrivibile dal cliente: deve restare quella su cui è
      // stato inviato il link (per evitare deviazioni in fase di firma OTP).
      const lockedEmail = (contract.sentToEmail || (contract.clientData as any)?.email || merged.email || "").toString();
      if (lockedEmail) merged.email = lockedEmail;

      // "stesso_indirizzo" → riallinea residenza
      if (merged.stesso_indirizzo) {
        merged.residente_a = merged.sede ?? merged.residente_a ?? "";
        merged.provincia_residenza = merged.provincia_sede ?? merged.provincia_residenza ?? "";
        merged.indirizzo_residenza = merged.indirizzo ?? merged.indirizzo_residenza ?? "";
      }

      const missing = getMissingClientFields(merged);
      const dataComplete = missing.length === 0;

      // Aggiorna i dati cliente. Quando completi, rigeneriamo il contenuto del
      // contratto con i dati corretti e portiamo lo status a "viewed".
      let nextContent = contract.generatedContent;
      if (dataComplete) {
        try {
          const tpl = await storage.getTemplate(contract.templateId, contract.companyId);
          if (tpl) {
            nextContent = await generateContractContent(
              tpl.content,
              merged,
              tpl,
              contract.autoRenewal,
              contract.renewalDuration ?? 12,
              contract.totalValue,
              contract.isPercentagePartnership,
              contract.partnershipPercentage,
              contract.contractStartDate,
              contract.contractEndDate,
              contract.selectedSectionIds ?? null,
              {
                accessLevel: contract.accessLevel ?? null,
                monthlyFee: contract.monthlyFee ?? null,
                activationFee: contract.activationFee ?? null,
              },
            );
          }
        } catch (regenErr: any) {
          console.error("[client-data] errore rigenerazione contenuto:", regenErr?.message || regenErr);
        }
      }

      const updates: any = {
        clientData: merged,
        generatedContent: nextContent,
      };
      if (dataComplete && contract.status !== "viewed") {
        updates.status = "viewed";
      }
      await storage.updateContract(contract.id, updates);

      await storage.createAuditLog({
        contractId: contract.id,
        action: dataComplete ? "client_data_completed" : "client_data_updated",
        userAgent: req.get("User-Agent"),
        ipAddress: getRealClientIP(req),
        metadata: {
          fillMode: "client_fill",
          missingCount: missing.length,
        },
      });

      // Best-effort: notifica al venditore quando i dati sono completi.
      // Riusiamo sendCoFillLinkEmail come canale "info" — il link punta alla
      // dashboard del contratto, e il venditore vedrà comunque il badge in
      // dashboard. Se l'invio fallisce non blocchiamo la richiesta.
      if (dataComplete) {
        try {
          const seller = await storage.getUser(contract.sellerId);
          if (seller?.email) {
            const link = `${getBaseUrl()}/contracts/${contract.id}`;
            await sendCoFillLinkEmail({
              companyId: contract.companyId,
              to: seller.email,
              link,
              clientName: (merged.societa || merged.email || "Cliente").toString(),
            });
          }
        } catch (notifyErr: any) {
          console.warn("[client-data] notifica venditore fallita:", notifyErr?.message || notifyErr);
        }
      }

      res.json({
        message: dataComplete ? "Dati salvati. Ora puoi firmare il contratto." : "Dati salvati.",
        dataComplete,
        missingFields: missing.map((f) => ({ key: f.key, label: f.label })),
      });
    } catch (err: any) {
      console.error("[client-data] errore:", err?.message || err);
      res.status(500).json({ message: "Salvataggio dati non riuscito" });
    }
  });

  // Send OTP for contract signing
  app.post("/api/client/contracts/:code/send-otp", otpRateLimiter, async (req, res) => {
    try {
      const contract = await storage.getContractByCode(req.params.code);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      if (contract.status === "signed") {
        return res.status(400).json({ message: "Contract already signed" });
      }

      // In modalità "cliente compila": l'invio OTP è bloccato finché i dati
      // anagrafici obbligatori non sono completi.
      if ((contract as any).fillMode === "client_fill") {
        const missing = getMissingClientFields(contract.clientData as any);
        if (missing.length > 0) {
          return res.status(400).json({
            message: "Per ricevere il codice di firma devi prima completare i tuoi dati.",
            code: "CLIENT_DATA_INCOMPLETE",
            missingFields: missing.map((f) => ({ key: f.key, label: f.label })),
          });
        }
      }

      const clientData = contract.clientData as any;

      // Priorità: numero di telefono modificabile dal frontend, poi quello dal contratto, poi email
      const modifiedPhone = req.body?.phoneNumber;
      const clientPhone = modifiedPhone || clientData.phone || clientData.telefono || clientData.cellulare;
      const clientEmail = contract.sentToEmail || clientData.email;

      // Usa il telefono se disponibile, altrimenti l'email
      const contactInfo = clientPhone || clientEmail;

      if (!contactInfo) {
        return res.status(400).json({ message: "Phone number or email not found" });
      }

      // Ottieni le impostazioni azienda CORRETTE (del tenant che possiede il contratto).
      // Senza companyId il metodo ritornava il primo tenant del DB → cross-tenant leak.
      const otpMethodSettings = await storage.getCompanySettings(contract.companyId);
      
      let otpCode: string;
      let useTwilioVerify = false;

      // Log dettagliati per debugging
      console.log(`[DEBUG OTP] ==================== INIZIO DEBUG OTP ====================`);
      console.log(`[DEBUG OTP] 🏢 Impostazioni azienda:`, {
        otpMethod: otpMethodSettings?.otpMethod || "NON IMPOSTATO",
        hasTwilioAccountSid: !!otpMethodSettings?.twilioAccountSid,
        hasTwilioAuthToken: !!otpMethodSettings?.twilioAuthToken,
        hasTwilioVerifyServiceSid: !!otpMethodSettings?.twilioVerifyServiceSid,
        companyName: otpMethodSettings?.companyName || "NON TROVATO"
      });
      
      console.log(`[DEBUG OTP] 👤 Dati cliente:`, {
        clientPhone: clientPhone || "NON PRESENTE",
        clientEmail: clientEmail || "NON PRESENTE", 
        modifiedPhone: modifiedPhone || "NON MODIFICATO",
        contractCode: req.params.code
      });

      // Usa il metodo configurato nelle impostazioni azienda
      const useOtpMethod = otpMethodSettings?.otpMethod || "email";
      console.log(`[DEBUG OTP] ⚙️  Metodo OTP configurato nel database: "${useOtpMethod}"`);

      if (useOtpMethod === "twilio" && clientPhone) {
        console.log(`[DEBUG OTP] 📱 Tentativo di usare Twilio (telefono presente: ${clientPhone})`);
        
        // Usa Twilio se configurato nelle impostazioni
        if (otpMethodSettings?.twilioAccountSid && otpMethodSettings?.twilioAuthToken && otpMethodSettings?.twilioVerifyServiceSid) {
          try {
            console.log(`[DEBUG OTP] ✅ DECISIONE: Usando Twilio Verify per ${clientPhone}`);
            console.log(`[DEBUG OTP] 🔑 Credenziali Twilio complete e valide`);
            useTwilioVerify = true;
            otpCode = "TWILIO_VERIFY";
          } catch (error) {
            console.log(`[DEBUG OTP] ❌ Errore nell'inizializzazione Twilio Verify:`, error);
            console.log(`[DEBUG OTP] 🔄 DECISIONE: Fallback a OTP personalizzato via email`);
            otpCode = generateOTP();
          }
        } else {
          console.log(`[DEBUG OTP] ⚠️  DECISIONE: Twilio selezionato ma credenziali incomplete, fallback a email`);
          console.log(`[DEBUG OTP] 🔍 Credenziali mancanti:`, {
            accountSid: otpMethodSettings?.twilioAccountSid ? "PRESENTE" : "MANCANTE",
            authToken: otpMethodSettings?.twilioAuthToken ? "PRESENTE" : "MANCANTE", 
            verifyServiceSid: otpMethodSettings?.twilioVerifyServiceSid ? "PRESENTE" : "MANCANTE"
          });
          otpCode = generateOTP();
        }
      } else if (useOtpMethod === "email" || !clientPhone) {
        console.log(`[DEBUG OTP] 📧 DECISIONE: Usando email per OTP`);
        console.log(`[DEBUG OTP] 📧 Motivo: metodo configurato = "${useOtpMethod}", telefono presente = ${!!clientPhone}`);
        otpCode = generateOTP();
      } else {
        console.log(`[DEBUG OTP] 🔄 DECISIONE: Fallback generico a email per OTP`);
        otpCode = generateOTP();
      }

      console.log(`[DEBUG OTP] 🎯 METODO FINALE SCELTO:`, {
        useTwilioVerify: useTwilioVerify,
        otpCode: useTwilioVerify ? "TWILIO_VERIFY" : "CODICE_PERSONALIZZATO",
        sendTo: useTwilioVerify ? clientPhone : clientEmail,
        method: useTwilioVerify ? "SMS_TWILIO" : "EMAIL_SMTP"
      });
      console.log(`[DEBUG OTP] ==================== FINE DEBUG OTP ====================`);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Crea il record OTP nel database solo se non usiamo Twilio Verify
      if (!useTwilioVerify) {
        await storage.createOtpCode({
          contractId: contract.id,
          phoneNumber: contactInfo,
          code: otpCode,
          expiresAt,
        });
      } else {
        // Per Twilio Verify, crea un segnaposto nel database
        await storage.createOtpCode({
          contractId: contract.id,
          phoneNumber: clientPhone,
          code: "TWILIO_VERIFY",
          expiresAt,
        });
      }

      console.log(`[ROUTES] About to send OTP to ${contactInfo}`);
      console.log(`[ROUTES] Contact type: ${clientPhone ? 'phone (SMS)' : 'email (fallback)'}`);
      console.log(`[ROUTES] Method: ${useTwilioVerify ? 'Twilio Verify' : 'Custom OTP'}`);
      if (modifiedPhone) {
        console.log(`[ROUTES] 📱 Numero modificato dal cliente: ${modifiedPhone}`);
      }

      if (useTwilioVerify && clientPhone) {
        // Usa Twilio Verify che gestisce tutto internamente
        const { sendOTPSMS } = await import('./services/twilio-service');
        await sendOTPSMS(clientPhone, otpMethodSettings);
      } else {
        // Usa il metodo tradizionale (email con codice personalizzato)
        // Forza l'uso dell'email se Twilio non è configurato
        const contactForOtp = (useOtpMethod === "email" || !useTwilioVerify) ? clientEmail : contactInfo;

        // Pre-controllo configurazione SMTP per evitare 500 generici
        const emailStatus = await getEmailConfigStatusForCompany(contract.companyId);
        if (!emailStatus.configured) {
          return res.status(400).json({
            message: "Il servizio di invio email non è ancora attivo. Contatta l'amministratore per completare la configurazione.",
            code: "EMAIL_NOT_CONFIGURED",
            missingFields: emailStatus.missingFields,
          });
        }

        try {
          await sendOTP(contactForOtp, otpCode, contract.companyId);
        } catch (emailErr: any) {
          console.error("❌ Errore invio OTP via email:", emailErr?.message || emailErr);
          return res.status(400).json({
            message: `Invio del codice OTP via email non riuscito: ${emailErr?.message || "errore SMTP sconosciuto"}.`,
            code: "EMAIL_SEND_FAILED",
          });
        }
      }

      console.log(`[ROUTES] OTP sending completed`);

      // Log OTP sending con metodo utilizzato e numero telefono effettivo
      await storage.createAuditLog({
        contractId: contract.id,
        action: "otp_sent",
        userAgent: req.get("User-Agent"),
        ipAddress: getRealClientIP(req),
        metadata: {
          contact: contactInfo,
          actualPhoneNumber: clientPhone || "N/A",
          method: clientPhone ? "sms" : "email",
          twilioVerify: useTwilioVerify,
          hasPhone: !!clientPhone,
          hasEmail: !!clientEmail,
          modifiedPhone: modifiedPhone || null
        }
      });

      res.json({ 
        message: "OTP sent successfully",
        method: clientPhone ? "sms" : "email",
        sentTo: clientPhone ? "telefono" : "email",
        twilioVerify: useTwilioVerify
      });
    } catch (error) {
      console.error("Failed to send OTP:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // Verify OTP and sign contract
  app.post("/api/client/contracts/:code/sign", otpRateLimiter, async (req, res) => {
    try {
      const { otpCode, consents, signatures } = req.body;

      const contract = await storage.getContractByCode(req.params.code);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      if (contract.status === "signed") {
        return res.status(400).json({ message: "Contract already signed" });
      }

      // Determine verification method based on company settings
      const otpCompanySettings = await storage.getCompanySettings(contract.companyId);
      const useOtpMethod = otpCompanySettings?.otpMethod || "email";
      
      let validOtp = null;
      let otpValid = false;

      console.log(`[ROUTES] 🔍 Verifica OTP - Metodo configurato: ${useOtpMethod}`);
      console.log(`[ROUTES] 🔢 Codice ricevuto: ${otpCode}`);

      if (useOtpMethod === "twilio") {
        // Check if there's a Twilio Verify placeholder record
        validOtp = await storage.getValidOtpCode(contract.id, "TWILIO_VERIFY");
        
        if (validOtp && validOtp.code === "TWILIO_VERIFY") {
          // Usa Twilio Verify per la verifica
          try {
            const { verifyOTPSMS } = await import('./services/twilio-service');
            // Usa il numero di telefono salvato nel record OTP (che include modifiche del cliente)
            const phoneNumber = validOtp.phoneNumber;

            console.log(`[ROUTES] ✅ Verifica OTP via Twilio Verify per ${phoneNumber}`);
            otpValid = await verifyOTPSMS(phoneNumber, otpCode, otpCompanySettings);
            console.log(`[ROUTES] 🎯 Risultato verifica Twilio: ${otpValid ? 'VALIDO' : 'NON VALIDO'}`);
          } catch (error) {
            console.error('[ROUTES] ❌ Errore nella verifica Twilio:', error);
            otpValid = false;
          }
        } else {
          console.log(`[ROUTES] ⚠️ Metodo Twilio configurato ma nessun record TWILIO_VERIFY trovato, fallback a verifica tradizionale`);
          validOtp = await storage.getValidOtpCode(contract.id, otpCode);
          otpValid = !!validOtp;
          console.log(`[ROUTES] 🎯 Verifica OTP tradizionale (fallback): ${otpValid ? 'VALIDO' : 'NON VALIDO'}`);
        }
      } else {
        // Email method or fallback - use traditional OTP verification
        console.log(`[ROUTES] 📧 Verifica OTP tramite codice personalizzato (metodo: ${useOtpMethod})`);
        validOtp = await storage.getValidOtpCode(contract.id, otpCode);
        otpValid = !!validOtp;
        console.log(`[ROUTES] 🎯 Risultato verifica OTP tradizionale: ${otpValid ? 'VALIDO' : 'NON VALIDO'}`);
        
        if (validOtp) {
          console.log(`[ROUTES] ✅ OTP trovato - ID: ${validOtp.id}, Codice: ${validOtp.code}, Telefono: ${validOtp.phoneNumber}`);
        } else {
          console.log(`[ROUTES] ❌ Nessun OTP valido trovato per il contratto ${contract.id} con codice ${otpCode}`);
        }
      }

      if (!otpValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Get seller's information (needed for company ID in template and contract queries)
      const seller = await storage.getUser(contract.sellerId);

      // Extract proper contact information
      const clientData = contract.clientData as any;
      const phoneNumber = clientData.phone || clientData.telefono || clientData.cellulare;
      const emailAddress = contract.sentToEmail || clientData.email;

      // ---------- ATOMIC SIGNING ----------
      // Generate the sealed PDF BEFORE marking the contract as signed. If Puppeteer fails
      // we bail out with 500 and the contract stays in its previous status so the client
      // can safely retry. The OTP record is *not* consumed until PDF + DB commit succeed,
      // so a client can retry with the same code after a transient Puppeteer failure.
      const now = new Date();
      const effectiveSignatures = signatures || {};
      const template = await storage.getTemplate(contract.templateId, seller?.companyId);
      const pdfCompanySettings = await storage.getCompanySettings(seller?.companyId);

      // Synthesize the "signed" audit entry in memory and include it in the audit trail
      // passed to the PDF generator, so the sealed PDF records the signature event
      // itself — even though the DB audit row is persisted only after the PDF succeeds.
      const existingAuditLogs = await storage.getContractAuditLogs(contract.id);
      const signedAuditEntry = {
        id: -1,
        contractId: contract.id,
        action: "signed",
        userAgent: req.get("User-Agent") ?? null,
        ipAddress: getRealClientIP(req),
        metadata: {
          emailUsedForSigning: emailAddress,
          phoneNumber: phoneNumber || 'Telefono non disponibile',
          signatureMethod: "otp_verification",
          signatures: signatures,
          consents: consents,
          contactUsedForOTP: validOtp?.phoneNumber,
          otpMethod: phoneNumber ? 'SMS' : 'Email'
        },
        timestamp: now,
      };
      const auditLogsForPdf = [...existingAuditLogs, signedAuditEntry];

      const contractForPdf = {
        id: contract.id,
        templateName: template?.name || 'Contratto',
        generatedContent: contract.generatedContent,
        clientData: contract.clientData,
        totalValue: contract.totalValue,
        // Sorgente unica: il generatore PDF usa `template.content` per il
        // corpo del contratto; passiamo qui il `generatedContent` già
        // risolto dal server (placeholder + sezioni modulari iniettate),
        // garantendo parità assoluta con preview e client-view.
        template: template ? { ...template, content: contract.generatedContent } : template,
        status: "signed",
        signatures: effectiveSignatures,
        signedAt: now,
        createdAt: contract.createdAt,
        contractStartDate: contract.contractStartDate,
        contractEndDate: contract.contractEndDate,
        autoRenewal: contract.autoRenewal,
        renewalDuration: contract.renewalDuration,
        isPercentagePartnership: contract.isPercentagePartnership,
        partnershipPercentage: contract.partnershipPercentage,
        selectedSectionIds: contract.selectedSectionIds,
      };

      let finalPdfPath: string;
      try {
        console.log("Generating PDF with signatures:", JSON.stringify(contractForPdf.signatures, null, 2));
        finalPdfPath = await generatePDF(contract.id, contract.generatedContent, auditLogsForPdf, contractForPdf, pdfCompanySettings);
      } catch (pdfError: any) {
        console.error(`❌ PDF generation failed during signing of contract ${contract.id}:`, pdfError?.message || pdfError);
        // OTP was NOT marked as used yet, so the client can safely resubmit.
        return res.status(500).json({
          message: "Errore nella generazione del PDF firmato. Riprova tra qualche istante."
        });
      }

      // PDF is on disk — now commit the signed status atomically together with the PDF path.
      const signedContract = await storage.updateContract(contract.id, {
        status: "signed",
        signedAt: now,
        signatures: effectiveSignatures,
        pdfPath: finalPdfPath,
      });

      // Commit the signature audit log (same payload that was baked into the PDF).
      await storage.createAuditLog({
        contractId: signedAuditEntry.contractId,
        action: signedAuditEntry.action,
        userAgent: signedAuditEntry.userAgent ?? undefined,
        ipAddress: signedAuditEntry.ipAddress,
        metadata: signedAuditEntry.metadata,
      });

      // Only now consume the OTP: both PDF and DB commits succeeded.
      if (validOtp) {
        await storage.markOtpAsUsed(validOtp.id);
      }

      console.log(`✅ Contratto ${contract.id} firmato e sigillato - Status: ${signedContract.status}`);

      // Get the updated contract with the PDF path
      const updatedContract = await storage.getContract(contract.id, seller?.companyId);

      // Invia email di notifica firma al cliente
      const clientEmail = contract.sentToEmail || (contract.clientData as any).email;
      if (clientEmail && updatedContract) {
        try {
          console.log('📧 Invio notifica firma completata a:', clientEmail);
          await sendContractSignedNotification(updatedContract);
          console.log('✅ Notifica firma inviata con successo!');
          console.log('👤 Destinatario:', contract.sentToEmail || clientData.email);
        } catch (emailError: any) {
          console.error('❌ Errore invio notifica firma:', emailError.message);
          // Non bloccare il processo di firma se l'email fallisce
        }

        // Invia messaggio di congratulazioni su WhatsApp
        try {
          const clientPhone = clientData.cellulare || clientData.phone || clientData.telefono;
          const clientName = clientData.cliente_nome || clientData.nome || 'Cliente';

          if (clientPhone) {
            console.log('📱 Invio congratulazioni WhatsApp...');
            const { sendCongratulationsWhatsApp } = await import('./services/twilio-service');
            await sendCongratulationsWhatsApp(clientPhone, clientName, contract.contractCode);
            console.log('✅ Congratulazioni WhatsApp inviate con successo!');
          } else {
            console.log('⚠️ Numero di telefono non trovato, salto invio WhatsApp');
          }
        } catch (whatsappError) {
          console.error('❌ Errore nell\'invio delle congratulazioni WhatsApp:', whatsappError);
          // Non bloccare il processo se WhatsApp fallisce
        }
      }

      res.json({ message: "Contract signed successfully" });
    } catch (error) {
      console.error("Signature error:", error);
      res.status(500).json({ message: "Failed to sign contract" });
    }
  });

  // Download contract PDF
  app.get("/api/contracts/:id/pdf", requireAuth, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContract(contractId, req.user.companyId);

      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Check if user owns this contract (for sellers) or is admin
      if (req.user.role === "seller" && contract.sellerId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!contract.pdfPath) {
        return res.status(404).json({ message: "PDF not found" });
      }

      const pdfRoot = path.resolve(path.join(process.cwd(), 'generated-pdfs'));
      let pdfPath = contract.pdfPath;

      // If the stored path is already absolute, use it directly
      // Otherwise, treat it as relative to the generated-pdfs directory
      if (!path.isAbsolute(pdfPath)) {
        // Check if it's just a filename
        if (!pdfPath.includes('/')) {
          pdfPath = path.join(pdfRoot, pdfPath);
        } else {
          // It's a relative path, make it absolute
          pdfPath = path.resolve(pdfPath);
        }
      }

      // Path-traversal guard: resolved path MUST live under generated-pdfs root.
      const resolvedPdfPath = path.resolve(pdfPath);
      if (resolvedPdfPath !== pdfRoot && !resolvedPdfPath.startsWith(pdfRoot + path.sep)) {
        console.warn(`🚫 Blocked PDF path traversal attempt: ${resolvedPdfPath}`);
        return res.status(403).json({ message: "Forbidden" });
      }
      pdfPath = resolvedPdfPath;

      console.log(`Attempting to serve PDF from: ${pdfPath}`);

      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        console.error(`PDF file not found at: ${pdfPath}`);
        return res.status(404).json({ message: "PDF file not found on disk", path: pdfPath });
      }

      // Send PDF file
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contratto-${contract.contractCode}.pdf"`);
      res.sendFile(pdfPath);
    } catch (error) {
      console.error("PDF download error:", error);
      res.status(500).json({ message: "Failed to download PDF", error: error.message });
    }
  });

  app.post("/api/contracts/:id/regenerate-pdf", requireAuth, async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContract(contractId, req.user.companyId);

      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      if (req.user.role === "seller" && contract.sellerId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (contract.status !== "signed") {
        return res.status(400).json({ message: "Only signed contracts can have their PDF regenerated" });
      }

      const auditLogs = await storage.getContractAuditLogs(contractId);
      const seller = contract.sellerId ? await storage.getUser(contract.sellerId) : null;
      const template = await storage.getTemplate(contract.templateId, req.user.companyId);
      const pdfCompanySettings = await storage.getCompanySettings(req.user.companyId);

      const contractForPdf = {
        id: contract.id,
        templateName: template?.name || 'Contratto',
        generatedContent: contract.generatedContent,
        clientData: contract.clientData,
        totalValue: contract.totalValue,
        template: template ? { ...template, content: contract.generatedContent } : template,
        status: "signed",
        signatures: contract.signatures || {},
        signedAt: contract.signedAt,
        createdAt: contract.createdAt,
        contractStartDate: contract.contractStartDate,
        contractEndDate: contract.contractEndDate,
        autoRenewal: contract.autoRenewal,
        renewalDuration: contract.renewalDuration,
        isPercentagePartnership: contract.isPercentagePartnership,
        partnershipPercentage: contract.partnershipPercentage,
        selectedSectionIds: contract.selectedSectionIds,
      };

      const finalPdfPath = await generatePDF(contractId, contract.generatedContent, auditLogs, contractForPdf, pdfCompanySettings);
      await storage.updateContract(contractId, { pdfPath: finalPdfPath });

      res.json({ message: "PDF rigenerato con successo", pdfPath: finalPdfPath });
    } catch (error: any) {
      console.error("PDF regeneration error:", error);
      res.status(500).json({ message: "Failed to regenerate PDF", error: error.message });
    }
  });

  // Get contract stats (for dashboards)
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const contracts = await storage.getContracts(req.user.companyId, req.user.role === "seller" ? req.user.id : undefined, false);
      const templates = await storage.getTemplates(req.user.companyId);

      const stats = {
        totalContracts: contracts.length,
        signedContracts: contracts.filter(c => c.status === "signed").length,
        pendingContracts: contracts.filter(c => c.status === "sent" || c.status === "viewed").length,
        activeTemplates: templates.filter(t => t.isActive).length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Database error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // User management routes (admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsersByCompany(req.user.companyId);
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        createdAt: user.createdAt
      })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Verify user belongs to same company before deletion
      const userToDelete = await storage.getUser(userId);
      if (!userToDelete || userToDelete.companyId !== req.user.companyId) {
        return res.status(404).json({ message: "User not found in your company" });
      }
      
      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ============ AI ROUTES ============

  const aiChatSchema = z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "model"]),
      content: z.string(),
    })),
    userMessage: z.string().min(1, "Messaggio richiesto"),
  });

  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    try {
      const { messages, userMessage } = aiChatSchema.parse(req.body);
      const response = await chatContratto(messages as ChatMessage[], userMessage);
      res.json({ response });
    } catch (error: any) {
      console.error("AI Chat error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Errore nella comunicazione con l'AI" });
    }
  });

  const aiWizardSchema = z.object({
    conversationHistory: z.array(z.object({
      role: z.enum(["user", "model"]),
      content: z.string(),
    })),
    userMessage: z.string().min(1, "Messaggio richiesto"),
  });

  app.post("/api/ai/wizard/start", requireAuth, async (req, res) => {
    try {
      const result = await guidedContractWizard([], "Ciao, voglio creare un nuovo contratto. Guidami passo passo.");
      res.json(result);
    } catch (error: any) {
      console.error("AI Wizard start error:", error);
      res.status(500).json({ message: error.message || "Errore nell'avvio del wizard AI" });
    }
  });

  app.post("/api/ai/wizard/answer", requireAuth, async (req, res) => {
    try {
      const { conversationHistory, userMessage } = aiWizardSchema.parse(req.body);
      const result = await guidedContractWizard(conversationHistory as ChatMessage[], userMessage);
      res.json(result);
    } catch (error: any) {
      console.error("AI Wizard answer error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Errore nella comunicazione con l'AI" });
    }
  });

  const aiGenerateSchema = z.object({
    summary: z.any(),
    additionalInstructions: z.string().optional(),
  });

  app.post("/api/ai/wizard/generate", requireAuth, async (req, res) => {
    try {
      const { summary, additionalInstructions } = aiGenerateSchema.parse(req.body);
      const result = await generateContractFromAI(summary, additionalInstructions);
      res.json(result);
    } catch (error: any) {
      console.error("AI Generate error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Errore nella generazione del contratto" });
    }
  });

  // ====================================================================
  // Co-fill (compilazione condivisa cliente-venditore in tempo reale)
  // ====================================================================
  const CO_FILL_TTL_HOURS = 24;

  app.post("/api/co-fill/sessions", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const bodySchema = z.object({
        initialData: z.record(z.any()).optional(),
        contractId: z.number().int().positive().optional().nullable(),
        templateId: z.number().int().positive().optional().nullable(),
      });
      const parsed = bodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "Invalid body" });

      // If a contractId is provided, verify it belongs to this seller's company
      // and (for sellers) that they actually own the contract.
      let contractId: number | null = null;
      if (parsed.data.contractId) {
        const contract = await storage.getContract(parsed.data.contractId, user.companyId);
        if (!contract) {
          return res.status(403).json({ message: "Contratto non autorizzato" });
        }
        if (user.role === "seller" && contract.sellerId !== user.id) {
          return res.status(403).json({ message: "Contratto non autorizzato" });
        }
        contractId = contract.id;
      }

      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + CO_FILL_TTL_HOURS * 60 * 60 * 1000);

      // If no contractId, create a draft contract so client work is persisted
      // even if the seller closes the form.
      if (!contractId) {
        let templateId = parsed.data.templateId || null;
        if (!templateId) {
          const tpls = await storage.getTemplates(user.companyId);
          const firstActive = tpls.find(t => t.isActive) || tpls[0];
          if (!firstActive) {
            return res.status(400).json({ message: "Nessun template disponibile per creare la bozza" });
          }
          templateId = firstActive.id;
        }
        const draft = await storage.createContract({
          templateId,
          sellerId: user.id,
          clientData: parsed.data.initialData || {},
          generatedContent: "",
          contractCode: nanoid(16),
          status: "draft",
          coFillToken: token,
        });
        contractId = draft.id;
        await storage.createAuditLog({
          contractId: draft.id,
          action: "co_fill_draft_created",
          userAgent: req.get("User-Agent"),
          ipAddress: getRealClientIP(req),
          metadata: { sellerId: user.id, token },
        });
      } else {
        // Reusing an existing contract: tag it with the new token so list UI can find it
        await storage.updateContract(contractId, { coFillToken: token });
      }

      const insert: InsertCoFillSession = {
        token,
        companyId: user.companyId,
        sellerId: user.id,
        contractId,
        currentData: parsed.data.initialData || {},
        status: "active",
        expiresAt,
      };
      const created = await storage.createCoFillSession(insert);
      coFillAudit("session_created", { token, sellerId: user.id, companyId: user.companyId, contractId });
      res.status(201).json({ token: created.token, expiresAt: created.expiresAt, status: created.status, contractId });
    } catch (error) {
      console.error("Co-fill create error:", error);
      res.status(500).json({ message: "Failed to create co-fill session" });
    }
  });

  app.get("/api/co-fill/sessions/:token", requireAuth, async (req, res) => {
    try {
      const sess = await storage.getCoFillSessionByToken(req.params.token);
      if (!sess || sess.companyId !== req.user.companyId || sess.sellerId !== req.user.id) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json({ token: sess.token, status: sess.status, expiresAt: sess.expiresAt, currentData: sess.currentData });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.delete("/api/co-fill/sessions/:token", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const ok = await storage.terminateCoFillSession(req.params.token, user.companyId, user.id);
      if (!ok) return res.status(404).json({ message: "Session not found" });
      // Notify connected peers
      coFillBroadcast(req.params.token, { type: "terminated" });
      coFillCloseAll(req.params.token);
      coFillAudit("session_terminated", { token: req.params.token, sellerId: user.id });
      res.json({ message: "Session terminated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to terminate session" });
    }
  });

  // Send the co-fill link to the client via the tenant's SMTP pipeline
  app.post("/api/co-fill/sessions/:token/email", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const bodySchema = z.object({
        email: z.string().email("Email non valida"),
      });
      const parsed = bodySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Body non valido" });
      }

      const sess = await storage.getCoFillSessionByToken(req.params.token);
      if (!sess || sess.companyId !== user.companyId || sess.sellerId !== user.id) {
        return res.status(404).json({ message: "Sessione non trovata" });
      }
      if (sess.status !== "active") {
        return res.status(410).json({ message: "Sessione non più attiva" });
      }
      if (sess.expiresAt < new Date()) {
        return res.status(410).json({ message: "Sessione scaduta" });
      }

      const emailStatus = await getEmailConfigStatusForCompany(user.companyId);
      if (!emailStatus.configured) {
        return res.status(412).json({
          message: "Configurazione email aziendale incompleta. Completa le impostazioni SMTP per inviare il link via email.",
          missingFields: emailStatus.missingFields,
        });
      }

      const link = `${getBaseUrl()}/co-fill/${sess.token}`;

      const currentData = (sess.currentData as Record<string, any>) || {};
      const clientName = currentData.cliente_nome || currentData.nome || null;

      try {
        const result = await sendCoFillLinkEmail({
          companyId: user.companyId,
          to: parsed.data.email,
          link,
          clientName,
        });

        if (sess.contractId) {
          try {
            await storage.createAuditLog({
              contractId: sess.contractId,
              action: "co_fill_link_emailed",
              userAgent: req.get("User-Agent"),
              ipAddress: getRealClientIP(req),
              metadata: {
                token: sess.token,
                sentTo: parsed.data.email,
                sellerId: user.id,
                messageId: result.messageId,
                at: new Date().toISOString(),
              },
            });
          } catch (auditErr) {
            console.error("⚠️  Failed to write co-fill email audit log:", auditErr);
          }
        }

        coFillAudit("link_emailed", {
          token: sess.token,
          sellerId: user.id,
          companyId: user.companyId,
          to: parsed.data.email,
        });

        res.json({ message: "Email inviata", to: parsed.data.email });
      } catch (sendErr: any) {
        console.error("Co-fill email send error:", sendErr);
        if (sess.contractId) {
          try {
            await storage.createAuditLog({
              contractId: sess.contractId,
              action: "co_fill_link_email_failed",
              userAgent: req.get("User-Agent"),
              ipAddress: getRealClientIP(req),
              metadata: {
                token: sess.token,
                attemptedTo: parsed.data.email,
                error: sendErr?.message || String(sendErr),
                at: new Date().toISOString(),
              },
            });
          } catch (auditErr) {
            console.error("⚠️  Failed to write co-fill email failure audit log:", auditErr);
          }
        }
        res.status(502).json({ message: sendErr?.message || "Invio email non riuscito" });
      }
    } catch (error) {
      console.error("Co-fill email endpoint error:", error);
      res.status(500).json({ message: "Errore durante l'invio del link via email" });
    }
  });

  // Public endpoint (no auth) — used by the client device to bootstrap
  app.get("/api/co-fill/public/:token", async (req, res) => {
    try {
      const sess = await storage.getCoFillSessionByToken(req.params.token);
      if (!sess) return res.status(404).json({ message: "Sessione non trovata" });
      if (sess.status !== "active") return res.status(410).json({ message: "Sessione non più attiva" });
      if (sess.expiresAt < new Date()) return res.status(410).json({ message: "Sessione scaduta" });
      const company = await storage.getCompanySettings(sess.companyId);
      res.json({
        token: sess.token,
        currentData: sess.currentData || {},
        expiresAt: sess.expiresAt,
        companyName: company?.companyName || "",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to load session" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for /ws/co-fill/:token
  const wss = new WebSocketServer({ noServer: true });
  type CoFillPeerRole = "seller" | "client";
  type CoFillPeer = {
    ws: WebSocket;
    role: CoFillPeerRole;
    clientId: string;
    userId?: number;
    ip: string;
    rate: { windowStart: number; count: number };
  };
  const coFillRooms = new Map<string, Set<CoFillPeer>>();

  // Connection rate limiter: max 5 new connections / 10s per IP
  const coFillConnRate = new Map<string, { windowStart: number; count: number }>();
  const CONN_WINDOW_MS = 10_000;
  const CONN_MAX = 5;
  function checkConnRate(ip: string): boolean {
    const now = Date.now();
    const r = coFillConnRate.get(ip);
    if (!r || now - r.windowStart > CONN_WINDOW_MS) {
      coFillConnRate.set(ip, { windowStart: now, count: 1 });
      return true;
    }
    r.count++;
    return r.count <= CONN_MAX;
  }
  // Per-peer message rate: max 30 messages / 1s
  const MSG_WINDOW_MS = 1000;
  const MSG_MAX = 30;
  function checkMsgRate(peer: CoFillPeer): boolean {
    const now = Date.now();
    if (now - peer.rate.windowStart > MSG_WINDOW_MS) {
      peer.rate.windowStart = now;
      peer.rate.count = 1;
      return true;
    }
    peer.rate.count++;
    return peer.rate.count <= MSG_MAX;
  }

  function coFillAudit(event: string, data: Record<string, unknown>) {
    console.log(`[CO-FILL AUDIT] ${event} ${JSON.stringify({ ts: new Date().toISOString(), ...data })}`);
  }

  type CoFillOutgoing =
    | { type: "init"; clientId: string; currentData: Record<string, unknown> }
    | { type: "presence"; sellers: number; clients: number }
    | { type: "update"; field: string; value: unknown; from: CoFillPeerRole; clientId: string }
    | { type: "terminated" }
    | { type: "pong" };

  function coFillBroadcast(token: string, msg: CoFillOutgoing, exceptClientId?: string) {
    const room = coFillRooms.get(token);
    if (!room) return;
    const data = JSON.stringify(msg);
    for (const peer of room) {
      if (exceptClientId && peer.clientId === exceptClientId) continue;
      if (peer.ws.readyState === WebSocket.OPEN) peer.ws.send(data);
    }
  }
  function coFillCloseAll(token: string) {
    const room = coFillRooms.get(token);
    if (!room) return;
    for (const peer of room) {
      try { peer.ws.close(1000, "session terminated"); } catch {}
    }
    coFillRooms.delete(token);
  }
  function coFillPresence(token: string): CoFillOutgoing {
    const room = coFillRooms.get(token);
    const roles = { seller: 0, client: 0 };
    if (room) for (const p of room) roles[p.role]++;
    return { type: "presence", sellers: roles.seller, clients: roles.client };
  }

  // Read authenticated user from session cookie on a raw upgrade request
  async function getUserFromUpgradeReq(req: { headers: { cookie?: string } }): Promise<User | null> {
    try {
      const raw = req.headers.cookie;
      if (!raw) return null;
      const cookies = cookie.parse(raw) as Record<string, string>;
      const signed = cookies["connect.sid"];
      if (!signed || !signed.startsWith("s:")) return null;
      const unsigned = signature.unsign(signed.slice(2), process.env.SESSION_SECRET || "");
      if (!unsigned) return null;
      const sessionData = await new Promise<Record<string, unknown> | null>((resolve) => {
        storage.sessionStore.get(unsigned, (err, sess) => {
          if (err || !sess) return resolve(null);
          resolve(sess as Record<string, unknown>);
        });
      });
      if (!sessionData) return null;
      const passportData = sessionData.passport as { user?: number } | undefined;
      const userId = passportData?.user;
      if (!userId) return null;
      const user = await storage.getUser(userId);
      return user || null;
    } catch {
      return null;
    }
  }

  // WebSocket server for /ws/client-presence/:contractCode (Task #12).
  // No auth: knowledge of the contractCode IS the token (same trust model as
  // the public /api/client/contracts/:code endpoint and the signing link).
  const presenceWss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);

      // --- Client presence WS (anonymous, contractCode-scoped) ---
      const presM = url.pathname.match(/^\/ws\/client-presence\/([A-Za-z0-9_-]+)$/);
      if (presM) {
        const contractCode = presM[1];
        const ip = (req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
        if (!checkConnRate(ip)) {
          socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
          socket.destroy();
          return;
        }
        let contract: any = null;
        try { contract = await storage.getContractByCode(contractCode); } catch {}
        if (!contract || !contract.id) {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
          socket.destroy();
          return;
        }
        presenceWss.handleUpgrade(req, socket, head, async (ws) => {
          const sessionId = nanoid(12);
          const now = Date.now();
          const sess: PresenceSession = {
            sessionId,
            contractCode,
            contractId: contract.id,
            openedAt: now,
            lastPingAt: now,
            lastDbFlushAt: now,
          };
          presenceAddSession(sess);
          // First open of this session → upsert first_opened_at + last_activity_at
          presenceMarkOpen(contract.id).catch(() => {});

          ws.on("message", (raw) => {
            const s = presenceSessions.get(sessionId);
            if (!s) return;
            let msg: any = null;
            try { msg = JSON.parse(String(raw)); } catch { return; }
            if (msg && msg.type === "ping") {
              const t = Date.now();
              s.lastPingAt = t;
              try { ws.send(JSON.stringify({ type: "pong", t })); } catch {}
              if (t - s.lastDbFlushAt > PRESENCE_DB_FLUSH_MS) {
                s.lastDbFlushAt = t;
                presenceFlushActivity(s.contractId).catch(() => {});
              }
            }
          });
          ws.on("close", () => {
            const s = presenceSessions.get(sessionId);
            if (s) presenceFlushActivity(s.contractId).catch(() => {});
            presenceRemoveSession(sessionId);
          });
          ws.on("error", () => {
            try { ws.close(); } catch {}
            presenceRemoveSession(sessionId);
          });
          // Send hello
          try {
            ws.send(JSON.stringify({
              type: "hello",
              sessionId,
              heartbeatMs: PRESENCE_HEARTBEAT_MS,
            }));
          } catch {}
        });
        return;
      }

      const m = url.pathname.match(/^\/ws\/co-fill\/([A-Za-z0-9_-]+)$/);
      if (!m) return; // let other upgrade handlers (e.g. Vite HMR) handle it
      const token = m[1];
      const ip = (req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");

      if (!checkConnRate(ip)) {
        coFillAudit("rate_limited_connect", { token, ip });
        socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
        socket.destroy();
        return;
      }

      const requestedRole: CoFillPeerRole = url.searchParams.get("role") === "seller" ? "seller" : "client";
      const sess = await storage.getCoFillSessionByToken(token);
      if (!sess || sess.status !== "active" || sess.expiresAt < new Date()) {
        coFillAudit("connect_rejected", { token, ip, reason: "invalid_session" });
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      // Seller role REQUIRES authenticated session + ownership
      let authedUserId: number | undefined;
      if (requestedRole === "seller") {
        const user = await getUserFromUpgradeReq(req);
        if (!user || user.id !== sess.sellerId || user.companyId !== sess.companyId) {
          coFillAudit("connect_rejected", { token, ip, reason: "seller_unauthorized" });
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        authedUserId = user.id;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const clientId = nanoid(12);
        const peer: CoFillPeer = {
          ws,
          role: requestedRole,
          clientId,
          userId: authedUserId,
          ip,
          rate: { windowStart: Date.now(), count: 0 },
        };
        let room = coFillRooms.get(token);
        if (!room) { room = new Set(); coFillRooms.set(token, room); }
        room.add(peer);

        // Bridge: a co-fill CLIENT peer also counts as live presence on the
        // linked draft contract so the seller dashboard pulses green.
        let presenceBridgeId: string | null = null;
        if (peer.role === "client" && sess.contractId) {
          const nowB = Date.now();
          presenceBridgeId = nanoid(12);
          const pSess: PresenceSession = {
            sessionId: presenceBridgeId,
            contractCode: `cofill:${token}`,
            contractId: sess.contractId,
            openedAt: nowB,
            lastPingAt: nowB,
            lastDbFlushAt: nowB,
          };
          presenceAddSession(pSess);
          presenceMarkOpen(sess.contractId).catch(() => {});
        }

        coFillAudit("peer_connected", { token, ip, role: peer.role, userId: authedUserId, clientId });

        // Send initial state and presence
        const currentData = (sess.currentData as Record<string, unknown>) || {};
        ws.send(JSON.stringify({ type: "init", clientId, currentData } satisfies CoFillOutgoing));
        coFillBroadcast(token, coFillPresence(token));

        ws.on("message", async (raw) => {
          if (!checkMsgRate(peer)) {
            coFillAudit("rate_limited_msg", { token, clientId, ip });
            try { ws.close(1008, "rate limit"); } catch {}
            return;
          }
          let msg: { type?: string; field?: string; value?: unknown };
          try { msg = JSON.parse(String(raw)); } catch { return; }
          if (msg?.type === "update" && typeof msg.field === "string") {
            // Persist single-field update merged into currentData
            const current = await storage.getCoFillSessionByToken(token);
            if (!current || current.status !== "active") return;
            const currentMap = (current.currentData as Record<string, unknown>) || {};
            const merged = { ...currentMap, [msg.field]: msg.value };
            await storage.updateCoFillSessionData(token, merged);
            // Mirror into the linked draft contract so the data survives reloads
            if (current.contractId) {
              try {
                await storage.updateContract(current.contractId, { clientData: merged });
              } catch (e) {
                console.error("Failed to mirror co-fill update to contract", e);
              }
            }
            coFillAudit("field_update", {
              token,
              clientId,
              role: peer.role,
              userId: peer.userId,
              field: msg.field,
            });
            coFillBroadcast(token, {
              type: "update",
              field: msg.field,
              value: msg.value,
              from: peer.role,
              clientId: peer.clientId,
            }, peer.clientId);
          } else if (msg?.type === "ping") {
            try { ws.send(JSON.stringify({ type: "pong" } satisfies CoFillOutgoing)); } catch {}
          }
          // Keep the presence bridge alive on ANY traffic from the co-fill
          // client (update / ping / etc.) so it survives past the 30s timeout.
          if (presenceBridgeId) {
            const bs = presenceSessions.get(presenceBridgeId);
            if (bs) {
              const t = Date.now();
              bs.lastPingAt = t;
              if (t - bs.lastDbFlushAt > PRESENCE_DB_FLUSH_MS) {
                bs.lastDbFlushAt = t;
                presenceFlushActivity(bs.contractId).catch(() => {});
              }
            }
          }
        });

        ws.on("close", () => {
          room?.delete(peer);
          if (room && room.size === 0) coFillRooms.delete(token);
          coFillBroadcast(token, coFillPresence(token));
          if (presenceBridgeId) {
            const s = presenceSessions.get(presenceBridgeId);
            if (s) presenceFlushActivity(s.contractId).catch(() => {});
            presenceRemoveSession(presenceBridgeId);
          }
          coFillAudit("peer_disconnected", { token, clientId, role: peer.role, userId: peer.userId });
        });
      });
    } catch (err) {
      try { socket.destroy(); } catch {}
    }
  });

  return httpServer;
}

// Etichette user-friendly delle variabili template che il sistema sa
// risolvere. Quando l'utility findUnresolvedPlaceholders trova un
// segnaposto rimasto, il client le usa per dire al venditore "manca X"
// in italiano invece di mostrare la chiave grezza.
export const PLACEHOLDER_LABELS: Record<string, { label: string; hint?: string }> = {
  livello_accesso: { label: "Livello di accesso", hint: "Sezione Prezzo & Durata → Variabili contratto" },
  canone_mensile: { label: "Canone mensile", hint: "Sezione Prezzo & Durata → Variabili contratto" },
  costo_attivazione: { label: "Costo di attivazione", hint: "Sezione Prezzo & Durata → Variabili contratto" },
};

// Formatta un importo numerico (string|number) come "EUR 297,00".
// Usato per le variabili monetarie iniettate nei placeholder template.
export function formatEur(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return "";
  return `EUR ${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Inietta in clientData le variabili-prodotto (livello_accesso,
// canone_mensile, costo_attivazione) prendendole dalle colonne dedicate
// del contratto/payload. Se il valore non c'è la chiave non viene
// aggiunta: in questo modo `findUnresolvedPlaceholders` può segnalarla
// come mancante anziché sostituirla con stringa vuota silenziosa.
export function withProductPlaceholders(
  clientData: any,
  vars: { accessLevel?: string | null; monthlyFee?: string | number | null; activationFee?: string | number | null },
): any {
  const out: any = { ...(clientData || {}) };
  if (vars.accessLevel && String(vars.accessLevel).trim() !== "" && !out.livello_accesso) {
    out.livello_accesso = String(vars.accessLevel).trim();
  }
  if (vars.monthlyFee !== null && vars.monthlyFee !== undefined && vars.monthlyFee !== "" && !out.canone_mensile) {
    const f = formatEur(vars.monthlyFee);
    if (f) out.canone_mensile = f;
  }
  if (vars.activationFee !== null && vars.activationFee !== undefined && vars.activationFee !== "" && !out.costo_attivazione) {
    const f = formatEur(vars.activationFee);
    if (f) out.costo_attivazione = f;
  }
  return out;
}

// Cerca nel testo finale del contratto eventuali placeholder `{{nome}}`
// rimasti non risolti (es. `{{livello_accesso}}`). Restituisce la lista
// dei nomi unici (in ordine di apparizione). Ignora i marcatori di
// blocco `<!-- BLOCK:NAME -->` che usano una sintassi diversa.
export function findUnresolvedPlaceholders(html: string): string[] {
  if (!html) return [];
  const found = new Set<string>();
  const out: string[] = [];
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[1];
    if (!found.has(name)) {
      found.add(name);
      out.push(name);
    }
  }
  return out;
}

export type ProductPlaceholderVars = {
  accessLevel?: string | null;
  monthlyFee?: string | number | null;
  activationFee?: string | number | null;
};

// Helper function to generate contract content from template
async function generateContractContent(
  templateContent: string, 
  clientData: any, 
  template?: any, 
  autoRenewal?: boolean, 
  renewalDuration?: number,
  totalValue?: number | null,
  isPercentagePartnership?: boolean,
  partnershipPercentage?: number | null,
  contractStartDate?: string,
  contractEndDate?: string,
  selectedSectionIds?: string[] | null,
  productVars?: ProductPlaceholderVars,
): Promise<string> {
  // Inietta in clientData le variabili-prodotto (livello_accesso,
  // canone_mensile, costo_attivazione) lette dalle colonne dedicate del
  // contratto. Avviene prima di qualsiasi sostituzione così i placeholder
  // del template orbitale vengono compilati come tutti gli altri.
  if (productVars) {
    clientData = withProductPlaceholders(clientData, productVars);
  }
  let content = templateContent;

  // Inject modular sections. If template has a <!-- BLOCK:SECTIONS --> marker we
  // replace it in place; otherwise the resolved HTML is appended so legacy
  // placeholder-based templates still include the selected services.
  const resolvedSections = resolveSelectedSections(template?.sections, selectedSectionIds ?? null);
  const sectionsHtml = renderSectionsHtml(resolvedSections);
  if (content.includes(SECTIONS_MARKER)) {
    content = content.replaceAll(SECTIONS_MARKER, sectionsHtml);
  } else if (sectionsHtml) {
    // Fallback: inserisci le sezioni prima dei termini di pagamento.
    // Cerchiamo il primo heading riconducibile al blocco pagamento; se assente,
    // appendiamo in coda per non rompere la struttura del documento.
    const paymentHeadingRegex = /<h[1-6][^>]*>[\s\S]*?(TERMINI\s+DI\s+PAGAMENTO|MODALIT[AÀ]\s+DI\s+PAGAMENTO|PAGAMENTO|CORRISPETTIVO)[\s\S]*?<\/h[1-6]>/i;
    const match = content.match(paymentHeadingRegex);
    if (match && typeof match.index === "number") {
      content = content.slice(0, match.index) + sectionsHtml + "\n" + content.slice(match.index);
    } else {
      content = content + "\n" + sectionsHtml;
    }
  }

  // Combine predefined bonuses from template with manual bonuses from client data
  let combinedBonusList = [];

  // Add predefined bonuses from template
  if (template?.predefinedBonuses && Array.isArray(template.predefinedBonuses)) {
    combinedBonusList = template.predefinedBonuses.map((bonus: any) => ({
      bonus_descrizione: bonus.description + (bonus.value ? ` (${bonus.value}${bonus.type === 'percentage' ? '%' : '€'})` : '')
    }));
  }

  // Add manual bonuses from client data
  if (clientData.bonus_list && Array.isArray(clientData.bonus_list)) {
    combinedBonusList = [...combinedBonusList, ...clientData.bonus_list];
  }

  // Format dates for display.
  // - YYYY-MM-DD (date-only) strings are parsed as local dates to avoid the UTC-midnight
  //   shift that would push the day back by one in positive UTC offsets.
  // - Full timestamps are formatted in Europe/Rome so CET/CEST is correct year-round.
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                      'luglio','agosto','settembre','ottobre','novembre','dicembre'];
      return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
        timeZone: 'Europe/Rome'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  // Detect if using custom installments (rata_list) or automatic payment plan
  const usingCustomInstallments = clientData.rata_list && Array.isArray(clientData.rata_list) && clientData.rata_list.length > 0;
  const paymentPlanData = usingCustomInstallments ? clientData.rata_list : clientData.payment_plan || [];

  // Format payment plan for template. Reuses the shared formatDate helper so the
  // YYYY-MM-DD / UTC-shift and Europe/Rome timezone handling stay consistent.
  const formattedPaymentPlan = paymentPlanData.map((payment: any, index: number) => {
    return {
      rata_numero: index + 1,
      rata_importo: payment.rata_importo || payment.amount || '0.00',
      rata_scadenza: formatDate(payment.rata_scadenza || payment.date || '')
    };
  });

  // Create enhanced client data with combined bonus list
  const enhancedClientData = {
    ...clientData,
    bonus_list: combinedBonusList,
    payment_plan: formattedPaymentPlan, // Use formatted payment plan for template
    auto_renewal: autoRenewal || false,
    renewal_duration: renewalDuration || 12,
    renewal_text: autoRenewal ? 
      `Il presente contratto si rinnoverà automaticamente per ulteriori ${renewalDuration || 12} mesi alle stesse condizioni economiche, salvo disdetta comunicata con preavviso di 30 giorni dalla scadenza.` :
      "Il presente contratto non prevede autorinnovo automatico.",
    // Contract dates
    contract_start_date: contractStartDate ? formatDate(contractStartDate) : '',
    contract_end_date: contractEndDate ? formatDate(contractEndDate) : '',
    contract_duration_text: contractStartDate && contractEndDate ? 
      `Il presente contratto è valido dal ${formatDate(contractStartDate)} al ${formatDate(contractEndDate)}` : '',
    // Partnership percentage data
    is_percentage_partnership: isPercentagePartnership || false,
    partnership_percentage: partnershipPercentage || null,
    prezzo_totale: totalValue ? (totalValue / 100).toFixed(2) : null,
    // Value text based on partnership mode
    valore_text: isPercentagePartnership && partnershipPercentage ? 
      `Partnership al ${partnershipPercentage}% sul fatturato TOTALE` :
      totalValue ? `EUR ${(totalValue / 100).toFixed(2)}` : '',
    // Payment method text for template
    payment_method_text: usingCustomInstallments ? 
      'Rate Personalizzate' : 
      'Calcolo Automatico delle Rate'
  };

  // Add partnership clauses if in percentage mode - insert them before custom content
  if (isPercentagePartnership && partnershipPercentage) {
    const partnershipClauses = `
<div class="partnership-section" style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
<h2 style="color: #92400e; font-size: 24px; margin-bottom: 16px; text-align: center;">🤝 MODELLO DI PARTNERSHIP</h2>

<p style="font-size: 16px; margin-bottom: 16px; font-weight: bold; color: #78350f;">
Il presente accordo prevede un modello di partnership basato su una percentuale del <strong style="background-color: #fbbf24; padding: 4px 8px; border-radius: 4px;">${partnershipPercentage}%</strong> sul fatturato TOTALE dell'attività.
</p>

<h3 style="color: #92400e; font-size: 18px; margin: 20px 0 12px 0;">📊 DEFINIZIONE DI FATTURATO TOTALE</h3>
<p style="font-size: 14px; margin-bottom: 12px;">Per "fatturato TOTALE" si intende la somma di tutti i ricavi lordi generati dall'attività, comprensivi di:</p>
<ul style="font-size: 14px; margin: 12px 0; padding-left: 20px;">
<li>Vendite di cibo e bevande</li>
<li>Servizi di catering e delivery</li>
<li>Eventi privati e prenotazioni speciali</li>
<li>Qualsiasi altro ricavo direttamente collegato all'attività</li>
</ul>

<h3 style="color: #92400e; font-size: 18px; margin: 20px 0 12px 0;">💰 MODALITÀ DI CALCOLO E PAGAMENTO</h3>
<p style="font-size: 14px; margin-bottom: 12px;">Il pagamento della percentuale sarà calcolato mensilmente sul fatturato TOTALE del mese precedente e dovrà essere corrisposto entro il 15 del mese successivo tramite bonifico bancario.</p>

<h3 style="color: #92400e; font-size: 18px; margin: 20px 0 12px 0;">📋 TRASPARENZA E RENDICONTAZIONE</h3>
<p style="font-size: 14px; margin-bottom: 12px;">Il Cliente si impegna a fornire mensilmente la documentazione contabile necessaria per il calcolo della percentuale dovuta, inclusi:</p>
<ul style="font-size: 14px; margin: 12px 0; padding-left: 20px;">
<li>Estratti conto del registratore di cassa o POS</li>
<li>Fatture emesse nel periodo di riferimento</li>
<li>Dichiarazioni IVA periodiche</li>
<li>Report di fatturato certificati dal commercialista</li>
</ul>

<h3 style="color: #92400e; font-size: 18px; margin: 20px 0 12px 0;">⚠️ PENALI PER RITARDATO PAGAMENTO</h3>
<p style="font-size: 14px; margin-bottom: 12px;">In caso di ritardo nel pagamento della percentuale dovuta, saranno applicate penali pari al 2% dell'importo dovuto per ogni mese di ritardo, oltre agli interessi legali.</p>

<div style="background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px; margin-top: 16px;">
<p style="font-size: 13px; color: #991b1b; margin: 0; font-weight: bold;">
⚡ IMPORTANTE: Questo modello di partnership sostituisce qualsiasi piano di pagamento fisso. Il compenso sarà calcolato esclusivamente come percentuale del fatturato totale.
</p>
</div>
</div>
`;

    // Insert partnership clauses using the explicit HTML comment marker defined by the
    // template author. The previous "whitespace-exact match" fallback on "</table>\n              </div>"
    // was too fragile: any change in the template's indentation silently dropped the clauses.
    // NOTE: this legacy HTML-template path only runs for templates that contain
    // `{{placeholder}}`-style tokens. The main PDF path (generateClientViewIdenticalHtml)
    // already renders the partnership section natively and does not need this injection.
    const clientDataMarker = '<!-- Client Data End -->';
    if (content.includes(clientDataMarker)) {
      content = content.replaceAll(
        clientDataMarker,
        clientDataMarker + '\n\n' + partnershipClauses
      );
    } else {
      // No marker in the template → append partnership clauses at the very top of the
      // template content so they are still visible (and the template author can choose
      // where to place them explicitly by adding the marker).
      content = partnershipClauses + '\n\n' + content;
    }
  }

  // Replace placeholders with actual data. Using `replaceAll` with a literal string
  // avoids the RegExp pitfalls of special characters like `{}` (which act as
  // quantifiers in regex mode) and removes the need for manual escaping.
  Object.keys(enhancedClientData).forEach(key => {
    const placeholder = `{{${key}}}`;
    content = content.replaceAll(placeholder, String(enhancedClientData[key] ?? ''));
  });

  // Remove any remaining payment plan placeholders if in partnership mode
  if (isPercentagePartnership) {
    content = content.replace(/{{payment_plan}}.*?{{\/payment_plan}}/gs, '');
    content = content.replace(/{{prezzo_totale}}/g, '');
  }

  // Process repeatable blocks
  const blockRegex = /<!-- BLOCK:(\w+) -->(.*?)<!-- END_BLOCK:\1 -->/gs;
  content = content.replace(blockRegex, (match, blockName, blockContent) => {
    const dataKey = blockName.toLowerCase();
    const data = enhancedClientData[dataKey];

    if (Array.isArray(data)) {
      return data.map((item, index) => {
        let blockHtml = blockContent;
        // Use literal-string replaceAll to avoid regex-meta pitfalls in placeholder keys.
        Object.keys(item).forEach(key => {
          blockHtml = blockHtml.replaceAll(`{{${key}}}`, String(item[key] ?? ''));
        });
        // Add index-based replacements
        blockHtml = blockHtml.replaceAll('{{rata_numero}}', String(index + 1));
        return blockHtml;
      }).join('');
    }

    return '';
  });

  return content;
}