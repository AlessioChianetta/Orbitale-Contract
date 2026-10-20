import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, type Request } from "express";
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

declare module "express-session" {
  interface SessionData {
    /** admin che sta usando l'account di un suo venditore ("Entra come venditore") */
    impersonatorId?: number;
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

/**
 * Admin che sta usando l'account di un venditore, se ancora valido (attivo,
 * admin, stessa azienda). Se non lo è più, la sessione viene chiusa.
 */
async function currentImpersonator(req: Request): Promise<SelectUser | null | "invalid"> {
  const id = req.session.impersonatorId;
  if (!id) return null;
  const admin = await storage.getUser(id);
  if (!admin || !admin.isActive || admin.role !== "admin" || admin.companyId !== req.user?.companyId) return "invalid";
  return admin;
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
  // Admin che usa l'account di un venditore: a ogni richiesta si controlla
  // che sia ancora un admin attivo della stessa azienda, altrimenti la
  // sessione si chiude.
  app.use("/api", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.session.impersonatorId) return next();
    try {
      if ((await currentImpersonator(req)) === "invalid") {
        return req.logout((err) => (err ? next(err) : res.status(401).json({ message: "Sessione scaduta: accedi di nuovo" })));
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use("/api", (req, res, next) => {
    // Un admin che usa l'account di un venditore non deve cambiarne la
    // password: lo farà il venditore al suo primo accesso.
    if (req.isAuthenticated() && req.user.mustChangePassword && !req.session.impersonatorId && !ALLOWED_WITH_TEMP_PASSWORD.has(req.originalUrl.split("?")[0])) {
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

  function userPayload(user: SelectUser, impersonator: SelectUser | null) {
    return {
      ...sanitizeUser(user),
      impersonator: impersonator ? { id: impersonator.id, fullName: impersonator.fullName } : null,
    };
  }

  app.get("/api/user", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const impersonator = await currentImpersonator(req);
      if (impersonator === "invalid") {
        return req.logout((err) => (err ? next(err) : res.sendStatus(401)));
      }
      res.json(userPayload(req.user, impersonator));
    } catch (err) {
      next(err);
    }
  });

  // "Entra come venditore": l'admin usa l'account di un venditore della sua
  // azienda (stessi contratti, stesse schermate) e torna al suo con un click.
  app.post("/api/admin/impersonate/:id", async (req, res, next) => {
    if (!req.isAuthenticated() || req.user.role !== "admin" || req.session.impersonatorId) {
      return res.status(403).json({ message: "Accesso riservato agli amministratori" });
    }
    try {
      const targetId = parseInt(req.params.id, 10);
      const target = Number.isInteger(targetId) ? await storage.getUser(targetId) : undefined;
      if (!target || target.companyId !== req.user.companyId || target.role !== "seller") {
        return res.status(404).json({ message: "Venditore non trovato nella tua azienda" });
      }
      if (!target.isActive) {
        return res.status(400).json({ message: "Il venditore è disattivato: riattivalo prima di entrare nel suo account" });
      }
      const admin = req.user;
      req.logIn(target, (err) => {
        if (err) return next(err);
        // logIn rigenera la sessione: l'admin si salva dopo.
        req.session.impersonatorId = admin.id;
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          console.log(`[AUTH] Admin ${admin.id} entra come venditore ${target.id} (azienda ${target.companyId})`);
          res.json(userPayload(target, admin));
        });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/stop-impersonation", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.session.impersonatorId) {
      return res.status(400).json({ message: "Non stai usando l'account di un venditore" });
    }
    try {
      const admin = await currentImpersonator(req);
      if (!admin || admin === "invalid") {
        return req.logout((err) => (err ? next(err) : res.status(401).json({ message: "Sessione scaduta: accedi di nuovo" })));
      }
      const sellerId = req.user.id;
      req.logIn(admin, (err) => {
        if (err) return next(err);
        console.log(`[AUTH] Admin ${admin.id} torna al suo account (era nel venditore ${sellerId})`);
        res.json(userPayload(admin, null));
      });
    } catch (err) {
      next(err);
    }
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
