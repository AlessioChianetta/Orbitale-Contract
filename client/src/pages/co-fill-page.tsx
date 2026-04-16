import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, WifiOff, ShieldCheck } from "lucide-react";
import { REQUIRED_CLIENT_FIELDS } from "@/lib/required-client-fields";

type SessionInfo = {
  token: string;
  currentData: Record<string, any>;
  expiresAt: string;
  companyName: string;
};

const FIELD_TYPE: Record<string, string> = {
  email: "email",
  cellulare: "tel",
  data_nascita: "date",
};

export default function CoFillPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, string>>({});
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

    return () => {
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

  const onChange = (field: string, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (debouncersRef.current[field]) clearTimeout(debouncersRef.current[field]);
    debouncersRef.current[field] = setTimeout(() => sendUpdate(field, value), 350);
  };

  const expiresLabel = useMemo(() => {
    if (!info?.expiresAt) return "";
    try {
      return new Date(info.expiresAt).toLocaleString("it-IT");
    } catch { return ""; }
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

      <div className="max-w-2xl mx-auto px-6 py-8">
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Dati anagrafici</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {REQUIRED_CLIENT_FIELDS.map((f) => {
              const isHl = !!highlight[f.key];
              return (
                <div key={f.key}>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    {f.label}
                  </Label>
                  <Input
                    type={FIELD_TYPE[f.key] || "text"}
                    value={data[f.key] ?? ""}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    className={`h-11 rounded-xl transition-all duration-300 ${
                      isHl
                        ? "border-2 border-violet-500 ring-2 ring-violet-200 bg-violet-50"
                        : "border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    }`}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          I dati restano riservati: visibili solo al venditore con cui stai parlando.
        </div>
      </div>
    </div>
  );
}

function normalizeData(d: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of REQUIRED_CLIENT_FIELDS) {
    const v = d?.[f.key];
    out[f.key] = v == null ? "" : String(v);
  }
  return out;
}
