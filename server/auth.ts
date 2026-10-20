import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { hashPassword, comparePasswords, registerPasswordRoutes } from "./password";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Helper to sanitize user data (remove password)
function sanitizeUser(user: SelectUser) {
  const { password, ...safeUser } = user;
  return safeUser;
}

// Validation schema for admin user creation
const createUserSchema = insertUserSchema
  .omit({ companyId: true })
  .extend({
    role: z.enum(["admin", "seller"]).default("seller"),
    password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  });

const INVALID_CREDENTIALS = "Username o password non corretti";
const ACCOUNT_DISABLED = "Account disattivato: contatta l'amministratore della tua azienda";

function isUniqueViolation(error: any): boolean {
  return Boolean(error && (error.code === "23505" || error?.cause?.code === "23505"));
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

  // Password temporanea: finché non viene cambiata, l'utente collegato può
  // solo leggere il proprio profilo, cambiare password o uscire.
  const ALLOWED_WITH_TEMP_PASSWORD = new Set(["/api/user", "/api/user/change-password", "/api/logout"]);
  app.use("/api", (req, res, next) => {
    if (req.isAuthenticated() && req.user.mustChangePassword && !ALLOWED_WITH_TEMP_PASSWORD.has(req.originalUrl.split("?")[0])) {
      return res.status(403).json({ message: "Devi cambiare la password temporanea prima di continuare.", code: "MUST_CHANGE_PASSWORD" });
    }
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: INVALID_CREDENTIALS });
        }
        if (!user.isActive) {
          return done(null, false, { message: ACCOUNT_DISABLED });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      // Utente eliminato o disattivato: la sessione decade.
      done(null, user && user.isActive ? user : false);
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(error, null);
    }
  });

  registerPasswordRoutes(app);

  // Nessuna registrazione pubblica: le aziende e il loro primo
  // amministratore li crea il proprietario della piattaforma (script sul VPS).

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser | false, info?: { message?: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || INVALID_CREDENTIALS });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.status(200).json(sanitizeUser(user));
      });
    })(req, res, next);
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
      return res.status(403).json({ message: "Accesso riservato agli amministratori" });
    }

    // Validate request body
    const validationResult = createUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Dati non validi", 
        errors: validationResult.error.issues 
      });
    }

    const { username, password, email, fullName, role } = validationResult.data;
    
    // Username ed email sono unici su TUTTA la piattaforma (vincolo DB):
    // il controllo è globale, con un messaggio che non rivela a quale
    // azienda appartiene l'account esistente.
    if (await storage.getUserByUsername(username)) {
      return res.status(409).json({ message: "Username già in uso: scegline un altro" });
    }
    if (await storage.getUserByEmail(email)) {
      return res.status(409).json({ message: "Email già associata a un altro account" });
    }

    try {
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email,
        fullName,
        role: role || "seller",
        companyId: req.user.companyId, // Use admin's company
        // La password la sceglie l'admin: l'utente la cambia al primo accesso.
        mustChangePassword: true,
      });

      res.status(201).json(sanitizeUser(user));
    } catch (error: any) {
      // Doppione creato tra il controllo e l'INSERT (richieste concorrenti).
      if (isUniqueViolation(error)) {
        const detail: string = error.detail || error?.cause?.detail || "";
        const message = /email/i.test(detail)
          ? "Email già associata a un altro account"
          : "Username già in uso: scegline un altro";
        return res.status(409).json({ message });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Errore nella creazione dell'utente" });
    }
  });
}
