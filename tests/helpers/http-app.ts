// App HTTP completa (stesse rotte del server) su una porta libera, per i
// test a livello di rotta. Gira sul DB collegato: i test creano e ripuliscono
// i propri dati di prova.
import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { registerRoutes } from "../../server/routes";

export interface TestApp {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestApp(): Promise<TestApp> {
  if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = "test-session-secret";
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));
  const server: Server = await registerRoutes(app);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || err.statusCode || 500).json({ message: err.message || "Errore" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

/** Client HTTP con il proprio cookie di sessione (un "browser" per utente). */
export class Agent {
  private cookie = "";
  /** `ip`: indirizzo simulato (X-Forwarded-For) per non condividere i limiti per IP. */
  constructor(private baseUrl: string, private ip?: string) {}

  async request(method: string, path: string, body?: unknown): Promise<{ status: number; json: any; text: string; headers: Headers }> {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(this.ip ? { "x-forwarded-for": this.ip } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  }

  get(path: string) { return this.request("GET", path); }
  post(path: string, body?: unknown) { return this.request("POST", path, body ?? {}); }
  put(path: string, body?: unknown) { return this.request("PUT", path, body ?? {}); }
  patch(path: string, body?: unknown) { return this.request("PATCH", path, body ?? {}); }
  delete(path: string) { return this.request("DELETE", path); }

  async login(username: string, password: string) {
    const r = await this.post("/api/login", { username, password });
    if (r.status !== 200) throw new Error(`login ${username} fallito: ${r.status} ${r.text}`);
    return r.json;
  }
}
