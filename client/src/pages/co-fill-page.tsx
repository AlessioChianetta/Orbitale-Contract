import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wifi, WifiOff, ShieldCheck, AlertTriangle } from "lucide-react";
import { SYNCED_FIELD_KEYS, type ClientType } from "@/lib/required-client-fields";
import {
  validateItalianMobile,
  looksLikeAddress,
  ITALIAN_PROVINCES,
  validateCodiceFiscale,
  detectVATorCF,
  validatePartitaIva,
} from "@/lib/validation-utils";

type SessionInfo = {
  token: string;
  currentData: Record<string, any>;
  expiresAt: string;
  companyName: string;
};

export default function CoFillPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any>>({});
  const [highlight, setHighlight] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [sellerOnline, setSellerOnline] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>("");
  const debouncersRef = useRef<Record<string, any>>({});
  const reconnectTimerRef = useRef<any>(null);

  // Bootstrap
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/co-fill/public/${token}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || "Sessione non disponibile");
        }
        const json = (await res.json()) as SessionInfo;
        if (cancelled) return;
        setInfo(json);
        setData(normalizeData(json.currentData));
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || "Errore caricamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // WebSocket
  useEffect(() => {
    if (!token || !info || terminated) return;

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/co-fill/${token}?role=client`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setSellerOnline(false);
        wsRef.current = null;
        if (!terminated) {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(connect, 2000);
        }
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (evt) => {
        let msg: any;
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg.type === "init") {
          clientIdRef.current = msg.clientId;
          setData((prev) => ({ ...prev, ...normalizeData(msg.currentData || {}) }));
        } else if (msg.type === "update" && msg.field) {
          if (msg.clientId && msg.clientId === clientIdRef.current) return;
          setData((prev) => ({ ...prev, [msg.field]: msg.value ?? "" }));
          flashHighlight(msg.field);
        } else if (msg.type === "presence") {
          setSellerOnline((msg.sellers || 0) > 0);
        } else if (msg.type === "terminated") {
          setTerminated(true);
          try { ws.close(); } catch {}
        }
      };
    };
    connect();

    // Heartbeat: invia un ping ogni 15s così il bridge di presenza lato server
    // (vedi /ws/co-fill in routes.ts) tiene viva la sessione anche su pagine
    // aperte ma idle (oltre il timeout di 30s).
    const heartbeat = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }, 15000);

    return () => {
      clearInterval(heartbeat);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) try { wsRef.current.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, info, terminated]);

  const flashHighlight = (field: string) => {
    setHighlight((prev) => ({ ...prev, [field]: Date.now() }));
    setTimeout(() => {
      setHighlight((prev) => {
        const cp = { ...prev };
        delete cp[field];
        return cp;
      });
    }, 2000);
  };

  const sendUpdate = (field: string, value: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "update", field, value }));
  };

  const onChange = (field: string, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (debouncersRef.current[field]) clearTimeout(debouncersRef.current[field]);
    debouncersRef.current[field] = setTimeout(() => sendUpdate(field, value), 350);
  };

  // Effetto: stesso indirizzo → ribalta sede→residenza
  const stessoIndirizzo = !!data.stesso_indirizzo;
  useEffect(() => {
    if (!stessoIndirizzo) return;
    const updates: Record<string, any> = {};
    if ((data.residente_a ?? "") !== (data.sede ?? "")) updates.residente_a = data.sede ?? "";
    if ((data.provincia_residenza ?? "") !== (data.provincia_sede ?? "")) updates.provincia_residenza = data.provincia_sede ?? "";
    if ((data.indirizzo_residenza ?? "") !== (data.indirizzo ?? "")) updates.indirizzo_residenza = data.indirizzo ?? "";
    if (Object.keys(updates).length > 0) {
      setData((prev) => ({ ...prev, ...updates }));
      for (const k of Object.keys(updates)) sendUpdate(k, updates[k]);
    }
  }, [stessoIndirizzo, data.sede, data.provincia_sede, data.indirizzo]);

  const expiresLabel = useMemo(() => {
    if (!info?.expiresAt) return "";
    try { return new Date(info.expiresAt).toLocaleString("it-IT"); } catch { return ""; }
  }, [info?.expiresAt]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-3" />
        <span className="text-slate-700">Caricamento sessione…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Sessione non disponibile</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">{loadError}</p>
            <p className="text-sm text-slate-500 mt-3">Chiedi al venditore di rigenerare il link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (terminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Sessione chiusa</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              Il venditore ha chiuso la sessione di compilazione condivisa. I dati che hai inserito
              sono stati salvati e il venditore li ha già nel suo modulo. Puoi chiudere questa pagina.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tipoCliente: ClientType = data.tipo_cliente === "privato" ? "privato" : "azienda";
  const isPrivato = tipoCliente === "privato";

  // Calcola validità inline (non bloccanti — il venditore vede e conferma)
  const cellulareVal = (data.cellulare || "") as string;
  const cellulareInvalid = cellulareVal.length > 0 && !validateItalianMobile(cellulareVal);

  const pivaVal = ((data.p_iva || "") as string).toUpperCase().replace(/\s/g, "");
  let pivaWarning = "";
  if (pivaVal.length > 0) {
    if (isPrivato) {
      if (!validateCodiceFiscale(pivaVal)) pivaWarning = "Codice Fiscale non valido (16 caratteri).";
    } else {
      const t = detectVATorCF(pivaVal);
      if (t === "vat" && !validatePartitaIva(pivaVal)) pivaWarning = "Partita IVA non valida.";
      else if (t === "cf" && !validateCodiceFiscale(pivaVal)) pivaWarning = "Codice Fiscale non valido.";
      else if (t === "unknown") pivaWarning = "Formato non riconosciuto.";
    }
  }

  const inputCls = (field: string) =>
    `h-11 rounded-xl transition-all duration-300 ${
      highlight[field]
        ? "border-2 border-violet-500 ring-2 ring-violet-200 bg-violet-50"
        : "border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm opacity-90">{info?.companyName}</div>
              <h1 className="text-xl sm:text-2xl font-bold">Compila i tuoi dati con il venditore</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {connected ? <><Wifi className="h-3 w-3 mr-1" /> connesso</> : <><WifiOff className="h-3 w-3 mr-1" /> riconnessione…</>}
              </Badge>
              {sellerOnline && (
                <Badge variant="secondary" className="bg-emerald-500/30 text-white border-0">
                  Venditore online
                </Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-white/80 mt-3">
            Quello che scrivi qui appare in tempo reale nel modulo del venditore. Sarà lui a confermare e inviare il contratto finale.
          </p>
          {expiresLabel && (
            <p className="text-xs text-white/70 mt-1">Sessione valida fino al {expiresLabel}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Toggle tipo cliente */}
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardContent className="pt-6">
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Sei un'azienda o un privato?</Label>
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl w-fit" data-testid="toggle-tipo-cliente-cofill">
              {(["azienda", "privato"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange("tipo_cliente", opt)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    tipoCliente === opt
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                  data-testid={`button-tipo-${opt}-cofill`}
                >
                  {opt === "azienda" ? "Azienda" : "Privato"}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dati azienda / privato */}
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">{isPrivato ? "Dati cliente privato" : "Dati Azienda/Società"}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {isPrivato
                ? "Servono per identificare il firmatario del contratto."
                : "Dati fiscali dell'azienda intestataria del contratto."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                {isPrivato ? "Cognome e Nome" : "Nome società"}
              </Label>
              <Input
                value={data.societa ?? ""}
                onChange={(e) => onChange("societa", e.target.value)}
                placeholder={isPrivato ? "Es. Mario Rossi" : "Nome della società"}
                className={inputCls("societa")}
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                {isPrivato ? "Città" : "Città sede legale"}
              </Label>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <Input
                  value={data.sede ?? ""}
                  onChange={(e) => onChange("sede", e.target.value)}
                  placeholder="Es. Milano"
                  className={inputCls("sede")}
                />
                <Select value={(data.provincia_sede || "") as string} onValueChange={(v) => onChange("provincia_sede", v)}>
                  <SelectTrigger className={inputCls("provincia_sede")}><SelectValue placeholder="PR" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ITALIAN_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {looksLikeAddress((data.sede || "") as string) && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Sembra un indirizzo. Inserisci solo la città (es. "Milano"), l'indirizzo va sotto.
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Indirizzo</Label>
              <Input
                value={data.indirizzo ?? ""}
                onChange={(e) => onChange("indirizzo", e.target.value)}
                placeholder="Via, numero civico, CAP"
                className={inputCls("indirizzo")}
              />
              {(data.indirizzo || "").length > 0 && !looksLikeAddress((data.indirizzo || "") as string) && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Inserisci via e numero civico (es. "Via Roma 12, 20100").
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                {isPrivato ? "Codice Fiscale" : "Codice Fiscale / P.IVA"}
              </Label>
              <Input
                value={data.p_iva ?? ""}
                onChange={(e) => onChange("p_iva", e.target.value.toUpperCase().replace(/\s/g, ""))}
                placeholder={isPrivato ? "16 caratteri" : "Codice Fiscale o Partita IVA"}
                className={inputCls("p_iva")}
              />
              {pivaWarning && <p className="text-xs text-red-600 mt-1">{pivaWarning}</p>}
            </div>

            {!isPrivato && (
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Codice Univoco / SDI (opzionale)</Label>
                <Input
                  value={data.codice_univoco ?? ""}
                  onChange={(e) => onChange("codice_univoco", e.target.value)}
                  placeholder="7 caratteri"
                  className={inputCls("codice_univoco")}
                />
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</Label>
              <Input
                type="email" inputMode="email" autoComplete="email"
                value={data.email ?? ""}
                onChange={(e) => onChange("email", e.target.value)}
                placeholder="email@esempio.com"
                className={inputCls("email")}
              />
              <p className="text-xs text-slate-500 mt-1">
                Usiamo questa email per inviarti il contratto da firmare.
              </p>
            </div>

            {!isPrivato && (
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">PEC (opzionale)</Label>
                <Input
                  value={data.pec ?? ""}
                  onChange={(e) => onChange("pec", e.target.value)}
                  placeholder="pec@esempio.com"
                  className={inputCls("pec")}
                />
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Cellulare</Label>
              <Input
                type="tel" inputMode="tel" autoComplete="tel"
                value={data.cellulare ?? ""}
                onChange={(e) => onChange("cellulare", e.target.value)}
                placeholder="+39 333 123 4567"
                className={inputCls("cellulare")}
              />
              {cellulareInvalid ? (
                <p className="text-xs text-red-600 mt-1">Inserisci un cellulare italiano valido.</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">Es. 333 123 4567 o +39 333 123 4567.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dati anagrafici */}
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">{isPrivato ? "Dati anagrafici" : "Dati del referente"}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {isPrivato
                ? "Servono per la firma del contratto."
                : "Dati di chi firmerà il contratto a nome dell'azienda."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="checkbox-stesso-indirizzo-cofill">
              <input
                type="checkbox"
                checked={stessoIndirizzo}
                onChange={(e) => onChange("stesso_indirizzo", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">
                {isPrivato
                  ? "La residenza coincide con l'indirizzo sopra"
                  : "La residenza del referente coincide con l'indirizzo dell'azienda"}
              </span>
            </label>

            {!isPrivato && (
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Nome e cognome del referente</Label>
                <Input
                  value={data.cliente_nome ?? ""}
                  onChange={(e) => onChange("cliente_nome", e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className={inputCls("cliente_nome")}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Nato a</Label>
                <Input
                  value={data.nato_a ?? ""}
                  onChange={(e) => onChange("nato_a", e.target.value)}
                  placeholder="Luogo di nascita"
                  className={inputCls("nato_a")}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Data di nascita</Label>
                <Input
                  type="date"
                  value={data.data_nascita ?? ""}
                  onChange={(e) => onChange("data_nascita", e.target.value)}
                  className={inputCls("data_nascita")}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Città di residenza</Label>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <Input
                  value={data.residente_a ?? ""}
                  onChange={(e) => onChange("residente_a", e.target.value)}
                  placeholder="Es. Milano"
                  disabled={stessoIndirizzo}
                  className={`${inputCls("residente_a")} ${stessoIndirizzo ? "bg-slate-50" : ""}`}
                />
                <Select
                  value={(data.provincia_residenza || "") as string}
                  onValueChange={(v) => onChange("provincia_residenza", v)}
                  disabled={stessoIndirizzo}
                >
                  <SelectTrigger className={`${inputCls("provincia_residenza")} ${stessoIndirizzo ? "bg-slate-50" : ""}`}>
                    <SelectValue placeholder="PR" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ITALIAN_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!stessoIndirizzo && looksLikeAddress((data.residente_a || "") as string) && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Sembra un indirizzo. Inserisci solo la città.
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Indirizzo di residenza</Label>
              <Input
                value={data.indirizzo_residenza ?? ""}
                onChange={(e) => onChange("indirizzo_residenza", e.target.value)}
                placeholder="Via, numero civico, CAP"
                disabled={stessoIndirizzo}
                className={`${inputCls("indirizzo_residenza")} ${stessoIndirizzo ? "bg-slate-50" : ""}`}
              />
              {!stessoIndirizzo && (data.indirizzo_residenza || "").length > 0 && !looksLikeAddress((data.indirizzo_residenza || "") as string) && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Inserisci via e numero civico.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          I dati restano riservati: visibili solo al venditore con cui stai parlando.
        </div>
      </div>
    </div>
  );
}

function normalizeData(d: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of SYNCED_FIELD_KEYS) {
    const v = d?.[key];
    if (v === undefined || v === null) continue;
    out[key] = v;
  }
  return out;
}
