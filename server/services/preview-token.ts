import crypto from "crypto";

const PREVIEW_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minuti

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET non configurato: impossibile firmare il token di anteprima.");
  }
  return s;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export type PreviewScope =
  | "create-contract"
  | `update-contract:${number}`
  | `bulk-send`;

interface TokenPayload {
  h: string;
  s: PreviewScope;
  u: number;
  iat: number;
  exp: number;
}

/**
 * Calcola un hash canonico del contenuto del contratto: include tutti i
 * campi che entrano nel documento o nell'email. Qualunque modifica su uno
 * di questi dopo l'apertura dell'anteprima invalida il token.
 */
export function hashContractPayload(input: any): string {
  const cd = input?.clientData ?? {};
  // Ordino le chiavi del clientData per stabilità
  const cdSorted: Record<string, unknown> = {};
  for (const k of Object.keys(cd).sort()) cdSorted[k] = cd[k];
  const canonical = JSON.stringify({
    t: input?.templateId ?? null,
    cd: cdSorted,
    tv: input?.totalValue ?? null,
    pp: !!input?.isPercentagePartnership,
    pc: input?.partnershipPercentage ?? null,
    ar: !!input?.autoRenewal,
    rd: input?.renewalDuration ?? null,
    cs: input?.contractStartDate ?? null,
    ce: input?.contractEndDate ?? null,
    ss: Array.isArray(input?.selectedSectionIds) ? [...input.selectedSectionIds].sort() : null,
    fm: input?.fillMode ?? "seller",
    se: input?.sendToEmail ?? null,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/** Hash per bulk-send: lista ordinata di ID. */
export function hashBulkIds(ids: number[]): string {
  const sorted = [...ids].sort((a, b) => a - b).join(",");
  return crypto.createHash("sha256").update(`bulk:${sorted}`).digest("hex");
}

export function signPreviewToken(opts: { hash: string; scope: PreviewScope; userId: number }): string {
  const now = Date.now();
  const payload: TokenPayload = {
    h: opts.hash,
    s: opts.scope,
    u: opts.userId,
    iat: now,
    exp: now + PREVIEW_TOKEN_TTL_MS,
  };
  const payload64 = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getSecret()).update(payload64).digest("base64url");
  return `${payload64}.${sig}`;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string; code: "MISSING" | "BAD_SIG" | "BAD_PAYLOAD" | "EXPIRED" | "USER_MISMATCH" | "SCOPE_MISMATCH" | "PAYLOAD_CHANGED" };

export function verifyPreviewToken(
  token: string | undefined | null,
  expected: { hash: string; scope: PreviewScope; userId: number },
): VerifyResult {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "Anteprima non confermata: token mancante.", code: "MISSING" };
  }
  const [payload64, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(payload64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "Anteprima non confermata: firma del token non valida.", code: "BAD_SIG" };
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromB64url(payload64).toString("utf8")) as TokenPayload;
  } catch {
    return { ok: false, reason: "Anteprima non confermata: token illeggibile.", code: "BAD_PAYLOAD" };
  }
  if (payload.exp < Date.now()) {
    return { ok: false, reason: "Anteprima scaduta. Riapri l'anteprima per confermare.", code: "EXPIRED" };
  }
  if (payload.u !== expected.userId) {
    return { ok: false, reason: "Token non valido per questo utente.", code: "USER_MISMATCH" };
  }
  if (payload.s !== expected.scope) {
    return { ok: false, reason: "Token non valido per questa operazione.", code: "SCOPE_MISMATCH" };
  }
  if (payload.h !== expected.hash) {
    return {
      ok: false,
      reason: "Il contratto è cambiato dopo l'anteprima. Riapri l'anteprima e ricontrolla prima di inviare.",
      code: "PAYLOAD_CHANGED",
    };
  }
  return { ok: true };
}
