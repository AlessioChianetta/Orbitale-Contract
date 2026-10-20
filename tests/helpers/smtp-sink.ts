// Server SMTP finto per i test: accetta tutto (AUTH compresa) e conserva i
// messaggi ricevuti. Nessuna email esce davvero.
import net from "net";
import type { AddressInfo } from "net";

export interface SinkMessage {
  mailFrom: string;
  rcptTo: string[];
  data: string;
  /** corpo decodificato (quoted-printable/base64 semplificati) per le ricerche */
  text: string;
}

function decodeBody(raw: string): string {
  // Unione delle righe quoted-printable e decodifica base64 delle parti.
  let out = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const b64Parts = raw.split(/Content-Transfer-Encoding:\s*base64\s*\r?\n(?:[^\r\n]+\r?\n)*\r?\n/i).slice(1);
  for (const part of b64Parts) {
    const chunk = part.split(/\r?\n--/)[0].replace(/\s+/g, "");
    try { out += "\n" + Buffer.from(chunk, "base64").toString("utf8"); } catch { /* ignora */ }
  }
  try { out = Buffer.from(out, "latin1").toString("utf8"); } catch { /* ignora */ }
  return out;
}

export class SmtpSink {
  messages: SinkMessage[] = [];
  private server = net.createServer((socket) => this.handle(socket));
  private sockets = new Set<net.Socket>();
  port = 0;

  async start(): Promise<number> {
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    this.port = (this.server.address() as AddressInfo).port;
    return this.port;
  }

  async stop(): Promise<void> {
    for (const s of this.sockets) s.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  to(address: string): SinkMessage[] {
    return this.messages.filter((m) => m.rcptTo.some((r) => r.toLowerCase() === address.toLowerCase()));
  }

  /** Attende che arrivino almeno `count` messaggi per l'indirizzo. */
  async waitFor(address: string, count = 1, timeoutMs = 15000): Promise<SinkMessage[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = this.to(address);
      if (found.length >= count) return found;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Nessuna email (${count}) per ${address} entro ${timeoutMs}ms; ricevute: ${this.messages.map((m) => m.rcptTo.join(",")).join(" | ")}`);
  }

  private handle(socket: net.Socket) {
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("error", () => {});
    let buffer = "";
    let inData = false;
    let current: { mailFrom: string; rcptTo: string[]; lines: string[] } = { mailFrom: "", rcptTo: [], lines: [] };
    const reply = (s: string) => socket.write(s + "\r\n");
    reply("220 sink ESMTP");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            const data = current.lines.join("\r\n");
            this.messages.push({ mailFrom: current.mailFrom, rcptTo: current.rcptTo, data, text: decodeBody(data) });
            current = { mailFrom: "", rcptTo: [], lines: [] };
            reply("250 OK queued");
          } else {
            current.lines.push(line.startsWith("..") ? line.slice(1) : line);
          }
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO") { socket.write("250-sink\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n"); }
        else if (cmd === "HELO") reply("250 sink");
        else if (cmd === "AUTH") reply("235 OK"); // AUTH PLAIN in una riga
        else if (cmd === "MAIL") { current.mailFrom = (line.match(/<([^>]*)>/) || [])[1] || ""; reply("250 OK"); }
        else if (cmd === "RCPT") { current.rcptTo.push((line.match(/<([^>]*)>/) || [])[1] || ""); reply("250 OK"); }
        else if (cmd === "DATA") { inData = true; reply("354 go"); }
        else if (cmd === "RSET") { current = { mailFrom: "", rcptTo: [], lines: [] }; reply("250 OK"); }
        else if (cmd === "NOOP") reply("250 OK");
        else if (cmd === "QUIT") { reply("221 bye"); socket.end(); }
        else reply("250 OK");
      }
    });
  }
}
