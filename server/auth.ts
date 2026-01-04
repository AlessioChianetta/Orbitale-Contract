import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Helper to sanitize user data (remove password)
function sanitizeUser(user: SelectUser) {
  const { password, ...safeUser } = user;
  return safeUser;
}

// Validation schema for admin user creation
const createUserSchema = insertUserSchema
  .omit({ id: true, createdAt: true, companyId: true })
  .extend({ role: z.enum(["admin", "seller"]).default("seller") });

// Validation schema for public admin registration (new companies)
const registerAdminSchema = insertUserSchema
  .omit({ id: true, createdAt: true, companyId: true, role: true })
  .extend({ 
    companyName: z.string().min(2, "Nome azienda richiesto"),
    address: z.string().min(5, "Indirizzo richiesto"),
    city: z.string().min(2, "Città richiesta"),
    postalCode: z.string().min(5, "CAP richiesto"),
    taxId: z.string().min(11, "Codice fiscale richiesto"),
    vatId: z.string().min(11, "Partita IVA richiesta"),
    uniqueCode: z.string().min(7, "Codice univoco richiesto"),
    pec: z.string().email("Email PEC non valida")
  });

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(error, null);
    }
  });

  // Public registration endpoint for new companies (admin only)
  app.post("/api/register", async (req, res) => {
    // Validate request body
    const validationResult = registerAdminSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid input", 
        errors: validationResult.error.issues 
      });
    }

    const { username, password, email, fullName, companyName, address, city, postalCode, taxId, vatId, uniqueCode, pec } = validationResult.data;
    
    // Check if username/email already exists globally
    const existingUserByUsername = await storage.getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ message: "Username già in uso" });
    }

    const existingUserByEmail = await storage.getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ message: "Email già in uso" });
    }

    try {
      // Create new company first
      const newCompany = await storage.createCompany({
        companyName,
        address,
        city,
        postalCode,
        taxId,
        vatId,
        uniqueCode,
        pec,
        contractTitle: "Contratto FAST TRACK VENDITE"
      });

      // Create admin user for the new company
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email,
        fullName,
        role: "admin",
        companyId: newCompany.id,
      });

      res.status(201).json({
        message: "Azienda e amministratore creati con successo",
        user: sanitizeUser(user),
        company: newCompany
      });
    } catch (error) {
      console.error("Error creating company and admin:", error);
      res.status(500).json({ message: "Errore nella creazione dell'azienda" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(sanitizeUser(req.user));
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(sanitizeUser(req.user));
  });

  // Admin-only endpoint to create users for their company
  app.post("/api/admin/create-user", async (req, res, next) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Validate request body
    const validationResult = createUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid input", 
        errors: validationResult.error.issues 
      });
    }

    const { username, password, email, fullName, role } = validationResult.data;
    
    // Check if username/email already exists in this company
    const existingUserByUsername = await storage.getUsersByCompanyAndUsername(req.user.companyId, username);
    if (existingUserByUsername) {
      return res.status(400).json({ message: "Username already exists in your company" });
    }

    const existingUserByEmail = await storage.getUsersByCompanyAndEmail(req.user.companyId, email);
    if (existingUserByEmail) {
      return res.status(400).json({ message: "Email already exists in your company" });
    }

    try {
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email,
        fullName,
        role: role || "seller",
        companyId: req.user.companyId, // Use admin's company
      });

      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });
}
