import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import zlib from "zlib";

/**
 * File del sito già compilati (cartella dist/public).
 *
 * - I file in /assets hanno l'impronta nel nome (es. index-AbC123.js): se
 *   cambiano, cambia il nome. Il browser può quindi tenerli per un anno.
 * - index.html invece va sempre ricontrollato, così dopo un aggiornamento
 *   il browser scarica subito i file nuovi.
 * - JavaScript, CSS e SVG vengono inviati compressi (gzip): il file
 *   principale passa da circa 1,6 MB a circa 0,5 MB. La versione compressa
 *   si prepara una volta sola e resta in memoria.
 */

const LONG_CACHE = "public, max-age=31536000, immutable";
const COMPRESSIBLE = /\.(js|mjs|css|svg|json|txt|map)$/i;

export function setStaticCacheHeaders(res: Response, filePath: string): void {
  if (filePath.split(path.sep).includes("assets")) {
    res.setHeader("Cache-Control", LONG_CACHE);
  } else {
    res.setHeader("Cache-Control", "no-cache");
  }
}

export function compressedAssets(distPath: string) {
  const assetsDir = path.join(distPath, "assets");
  const cache = new Map<string, { gz: Buffer; mtimeMs: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    let rel: string;
    try {
      rel = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    const file = path.join(assetsDir, rel);
    if (!file.startsWith(assetsDir + path.sep)) return next();

    // Un file di /assets che non esiste (es. pagina aperta prima di un
    // aggiornamento) deve dare 404, non la pagina index.html.
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return res.status(404).end();
    }
    if (!stat.isFile()) return res.status(404).end();

    const acceptsGzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
    if (!COMPRESSIBLE.test(file) || !acceptsGzip) return next();

    let entry = cache.get(file);
    if (!entry || entry.mtimeMs !== stat.mtimeMs) {
      try {
        entry = { gz: zlib.gzipSync(fs.readFileSync(file), { level: 9 }), mtimeMs: stat.mtimeMs };
      } catch {
        return next();
      }
      cache.set(file, entry);
    }

    res.type(path.extname(file));
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Length", String(entry.gz.length));
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("Cache-Control", LONG_CACHE);
    if (req.method === "HEAD") return res.end();
    res.end(entry.gz);
  };
}
