import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { insertContractTemplateSchema, insertContractSchema, insertCompanySettingsSchema } from "@shared/schema";
import { generatePDF } from "./services/pdf-generator-new";
import { sendContractEmail, sendContractSignedNotification } from "./services/email-service";
import { generateOTP, sendOTP } from "./services/otp-service";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import { chatContratto, guidedContractWizard, generateContractFromAI, type ChatMessage } from "./services/provider-factory";

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

  // Company settings routes
  app.get("/api/company-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getCompanySettings(req.user.companyId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company settings" });
    }
  });

  app.put("/api/company-settings", requireAdmin, async (req, res) => {
    try {
      const settingsData = insertCompanySettingsSchema.parse(req.body);
      const settings = await storage.updateCompanySettings(settingsData, req.user.companyId);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update company settings" });
    }
  });

  // Contract routes
  app.get("/api/contracts", requireAuth, async (req, res) => {
    try {
      const sellerId = req.user.role === "seller" ? req.user.id : undefined;
      const contracts = await storage.getContracts(req.user.companyId, sellerId);
      res.json(contracts);
    } catch (error) {
      console.error("Database error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
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
        req.body.contractEndDate
      );

      // Validate the updated contract data
      const contractData = insertContractSchema.partial().parse({
        ...req.body,
        generatedContent,
      });

      const updatedContract = await storage.updateContract(contractId, contractData);

      // Send email if contract is being sent immediately
      if (req.body.sendImmediately) {
        const emailToSend = req.body.sendToEmail || contractData.clientData?.email;
        console.log('🔄 Richiesta invio immediato contratto modificato');
        console.log('📧 Email di destinazione:', emailToSend);
        console.log('📋 ID contratto:', contractId);
        console.log('🔗 Codice contratto:', existingContract.contractCode);

        try {
          await sendContractEmail(updatedContract, existingContract.contractCode, emailToSend);
          await storage.updateContract(contractId, { 
            status: "sent",
            sentToEmail: emailToSend 
          });
          console.log('✅ Contratto aggiornato con status "sent"');

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
        }
      }

      // Log the update action
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
        req.body.contractEndDate
      );

      // Now validate the complete contract data including generated content
      const contractData = insertContractSchema.parse({
        ...req.body,
        sellerId: req.user.id,
        contractCode,
        status: "draft",
        generatedContent,
      });

      const contract = await storage.createContract(contractData);

      // Send email if contract is being sent immediately
      if (req.body.sendImmediately) {
        const emailToSend = req.body.sendToEmail || contractData.clientData.email;
        console.log('🚀 Richiesta invio immediato contratto');
        console.log('📧 Email di destinazione:', emailToSend);
        console.log('📋 ID contratto:', contract.id);
        console.log('🔗 Codice contratto:', contractCode);

        try {
          await sendContractEmail(contract, contractCode, emailToSend);
          await storage.updateContract(contract.id, { 
            status: "sent",
            sentToEmail: emailToSend 
          });
          console.log('✅ Contratto aggiornato con status "sent"');

          // Log audit trail
          await storage.createAuditLog({
            contractId: contract.id,
            action: "sent",
            userAgent: req.get("User-Agent"),
            ipAddress: getRealClientIP(req),
            metadata: { 
              sentBy: req.user.id,
              sentToEmail: emailToSend,
              method: "email"
            },
          });
        } catch (emailError: any) {
          console.error("❌ ERRORE nell'invio email durante creazione contratto:");
          console.error("  - Errore:", emailError.message);
          console.error("  - Stack:", emailError.stack);
          // Don't fail the entire contract creation if email fails
          // Mark as draft instead of sent
          await storage.updateContract(contract.id, { status: "draft" });
          console.log('📝 Contratto mantenuto come "draft" a causa dell\'errore email');
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
          message: "Contratto creato con successo. Email non inviata (configurare credenziali SMTP).",
          warning: "Email non configurata"
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

      // Update status if first view
      if (contract.status === "sent") {
        await storage.updateContract(contract.id, { status: "viewed" });
      }

      res.json({
        ...contract,
        companySettings: contractCompanySettings
      });
    } catch (error) {
      console.error("Database error fetching client contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  // Send OTP for contract signing
  app.post("/api/client/contracts/:code/send-otp", async (req, res) => {
    try {
      const contract = await storage.getContractByCode(req.params.code);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      if (contract.status === "signed") {
        return res.status(400).json({ message: "Contract already signed" });
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

      // Ottieni le impostazioni azienda per determinare il metodo OTP
      const otpMethodSettings = await storage.getCompanySettings();
      
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
        await sendOTP(contactForOtp, otpCode);
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
  app.post("/api/client/contracts/:code/sign", async (req, res) => {
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

      // Se abbiamo trovato un OTP valido, marcalo come usato
      if (validOtp) {
        await storage.markOtpAsUsed(validOtp.id);
      }

      // Get seller's information (needed for company ID in template and contract queries)
      const seller = await storage.getUser(contract.sellerId);

      // Update contract status and save signatures
      const signedContract = await storage.updateContract(contract.id, { 
        status: "signed",
        signedAt: new Date(),
        signatures: signatures || {}
      });

      console.log(`✅ Contratto ${contract.id} aggiornato con successo - Status: ${signedContract.status}`);
      console.log(`📋 Dettagli aggiornamento:`, {
        contractId: contract.id,
        previousStatus: contract.status,
        newStatus: signedContract.status,
        signedAt: signedContract.signedAt,
        hasSignatures: !!signedContract.signatures
      });

      // Extract proper contact information
      const clientData = contract.clientData as any;
      const phoneNumber = clientData.phone || clientData.telefono || clientData.cellulare;
      const emailAddress = contract.sentToEmail || clientData.email;

      // Log signature with detailed information
      await storage.createAuditLog({
        contractId: contract.id,
        action: "signed",
        userAgent: req.get("User-Agent"),
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
      });

      // Get updated contract with signatures AFTER saving them
      // Use the seller's company ID from the original contract for the query
      const finalContract = await storage.getContract(contract.id, seller?.companyId);

      if (!finalContract || finalContract.status !== "signed") {
        console.error(`❌ ERRORE: Contratto ${contract.id} non risulta firmato dopo l'aggiornamento`);
        return res.status(500).json({ message: "Failed to update contract status" });
      }

      // Generate final sealed PDF with audit trail
      const auditLogs = await storage.getContractAuditLogs(contract.id);

      // Get template for professional PDF layout
      const template = await storage.getTemplate(contract.templateId, seller?.companyId);

      // Get company settings for PDF - use the seller's company ID
      const pdfCompanySettings = await storage.getCompanySettings(seller?.companyId);

      const contractForPdf = {
        id: contract.id,
        templateName: template?.name || 'Contratto',
        generatedContent: contract.generatedContent,
        clientData: contract.clientData,
        totalValue: contract.totalValue,
        template: template,
        status: "signed",
        signatures: finalContract?.signatures || signatures || {},
        signedAt: new Date(),
        autoRenewal: contract.autoRenewal,
        renewalDuration: contract.renewalDuration,
        isPercentagePartnership: contract.isPercentagePartnership,
        partnershipPercentage: contract.partnershipPercentage
      };

      console.log("Generating PDF with signatures:", JSON.stringify(contractForPdf.signatures, null, 2));

      const finalPdfPath = await generatePDF(contract.id, contract.generatedContent, auditLogs, contractForPdf, pdfCompanySettings);

      // Update contract with final PDF path
      await storage.updateContract(contract.id, { pdfPath: finalPdfPath });

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

      let pdfPath = contract.pdfPath;

      // If the stored path is already absolute, use it directly
      // Otherwise, treat it as relative to the generated-pdfs directory
      if (!path.isAbsolute(pdfPath)) {
        // Check if it's just a filename
        if (!pdfPath.includes('/')) {
          pdfPath = path.join(process.cwd(), 'generated-pdfs', pdfPath);
        } else {
          // It's a relative path, make it absolute
          pdfPath = path.resolve(pdfPath);
        }
      }

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

  // Get contract stats (for dashboards)
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const contracts = await storage.getContracts(req.user.companyId, req.user.role === "seller" ? req.user.id : undefined);
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

  const httpServer = createServer(app);
  return httpServer;
}

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
  contractEndDate?: string
): Promise<string> {
  let content = templateContent;

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

  // Format dates for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  // Detect if using custom installments (rata_list) or automatic payment plan
  const usingCustomInstallments = clientData.rata_list && Array.isArray(clientData.rata_list) && clientData.rata_list.length > 0;
  const paymentPlanData = usingCustomInstallments ? clientData.rata_list : clientData.payment_plan || [];

  // Format payment plan for template
  const formattedPaymentPlan = paymentPlanData.map((payment: any, index: number) => {
    const formatPaymentDate = (dateString: string) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        });
      } catch {
        return dateString;
      }
    };

    return {
      rata_numero: index + 1,
      rata_importo: payment.rata_importo || payment.amount || '0.00',
      rata_scadenza: formatPaymentDate(payment.rata_scadenza || payment.date || '')
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

    // Insert partnership clauses after the client data table but before custom content
    const clientDataEndMarker = '</table>\n              </div>';
    if (content.includes(clientDataEndMarker)) {
      content = content.replace(clientDataEndMarker, clientDataEndMarker + '\n\n' + partnershipClauses);
    } else {
      // Fallback: add after client data section
      content = content.replace(/<!-- Client Data End -->/g, '<!-- Client Data End -->\n\n' + partnershipClauses);
    }
  }

  // Replace placeholders with actual data
  Object.keys(enhancedClientData).forEach(key => {
    const placeholder = `{{${key}}}`;
    content = content.replace(new RegExp(placeholder, 'g'), String(enhancedClientData[key] || ''));
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
        Object.keys(item).forEach(key => {
          blockHtml = blockHtml.replace(new RegExp(`{{${key}}}`, 'g'), String(item[key]));
        });
        // Add index-based replacements
        blockHtml = blockHtml.replace(/{{rata_numero}}/g, String(index + 1));
        return blockHtml;
      }).join('');
    }

    return '';
  });

  return content;
}