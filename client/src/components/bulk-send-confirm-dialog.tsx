import { useEffect, useState } from "react";
import { Loader2, Mail, ShieldCheck, AlertTriangle, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

type Recipient = {
  id: number;
  contractCode: string;
  templateName: string | null;
  clientLabel: string;
  email: string | null;
  eligible: boolean;
  reason?: string;
};

type BulkPreviewResponse = {
  recipients: Recipient[];
  eligibleIds: number[];
  previewToken: string | null;
  previewTokenExpiresAt: number | null;
  emailConfig: { configured: boolean };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractIds: number[];
  onConfirm: (previewToken: string, eligibleIds: number[]) => Promise<void> | void;
  sending: boolean;
}

export function BulkSendConfirmDialog({ open, onOpenChange, contractIds, onConfirm, sending }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BulkPreviewResponse | null>(null);
  const [consent, setConsent] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) {
      setData(null);
      setConsent(false);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest("POST", "/api/contracts/bulk-send/preview", { ids: contractIds });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Impossibile preparare l'anteprima.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contractIds]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const expiresAt = data?.previewTokenExpiresAt ?? 0;
  const remainingMs = expiresAt > 0 ? Math.max(0, expiresAt - now) : 0;
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);
  const expired = !!data && expiresAt > 0 && remainingMs <= 0;
  const eligibleCount = data?.eligibleIds.length ?? 0;
  const ineligible = data?.recipients.filter((r) => !r.eligible) ?? [];
  const canConfirm =
    !!data &&
    !!data.previewToken &&
    eligibleCount > 0 &&
    consent &&
    !expired &&
    !sending &&
    !loading &&
    data.emailConfig?.configured !== false;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Conferma invio multiplo al cliente
          </DialogTitle>
          <DialogDescription>
            Stai per inviare un link sicuro di compilazione a <strong>{contractIds.length}</strong> contratti.
            Verifica i destinatari prima di confermare. Niente parte finché non confermi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="flex-1 flex items-center justify-center text-slate-500 gap-2 py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparazione anteprima…
            </div>
          )}
          {error && !loading && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
          {data && !loading && !error && (
            <>
              <div className="px-6 py-4 border-b bg-slate-50/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Pronti all'invio</p>
                  <p className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> {eligibleCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Esclusi</p>
                  <p className="font-semibold text-rose-700 flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> {ineligible.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Configurazione email</p>
                  <p className={`font-semibold ${data.emailConfig?.configured ? "text-emerald-700" : "text-rose-700"}`}>
                    {data.emailConfig?.configured ? "Attiva" : "Mancante"}
                  </p>
                </div>
              </div>

              {!data.emailConfig?.configured && (
                <div className="px-6 pt-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Email aziendale non configurata. Configurala dalle impostazioni prima di inviare.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="px-6 py-3 border-b">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-indigo-600" /> Cosa riceverà ciascun cliente
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Un'email personalizzata con un link sicuro <strong>diverso</strong>, valido solo per il proprio contratto,
                  per compilare i dati mancanti e firmare.
                </p>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                <h4 className="text-sm font-semibold text-slate-900 px-6 pt-4 pb-2">
                  Destinatari ({data.recipients.length})
                </h4>
                <ScrollArea className="flex-1 px-6 pb-3 max-h-[280px]">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="text-left font-medium pb-2">Stato</th>
                        <th className="text-left font-medium pb-2">Codice</th>
                        <th className="text-left font-medium pb-2">Cliente</th>
                        <th className="text-left font-medium pb-2">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recipients.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100" data-testid={`bulk-recipient-${r.id}`}>
                          <td className="py-2 align-top">
                            {r.eligible ? (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700" title={r.reason}>
                                <XCircle className="h-3 w-3 mr-1" /> Esclusa
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 font-mono text-xs text-slate-600 align-top">{r.contractCode}</td>
                          <td className="py-2 text-slate-800 align-top">
                            {r.clientLabel || "—"}
                            {r.templateName && <div className="text-xs text-slate-500">{r.templateName}</div>}
                            {!r.eligible && r.reason && (
                              <div className="text-xs text-rose-600">{r.reason}</div>
                            )}
                          </td>
                          <td className="py-2 text-slate-700 break-all align-top">
                            {r.email || <span className="text-rose-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              <div className="px-6 py-3 border-t bg-amber-50/60 flex flex-wrap items-center justify-between gap-3">
                <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-100">
                  <Clock className="h-3 w-3 mr-1" />
                  {expiresAt === 0
                    ? "Nessun contratto eleggibile"
                    : expired
                    ? "Anteprima scaduta — riapri il dialogo"
                    : `Conferma valida ancora ${remainingMin}m ${remainingSec.toString().padStart(2, "0")}s`}
                </Badge>
                <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(c) => setConsent(!!c)}
                    disabled={expired || eligibleCount === 0}
                    data-testid="checkbox-bulk-consent"
                  />
                  Confermo di aver verificato i destinatari
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-white flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            data-testid="button-bulk-cancel"
          >
            Annulla
          </Button>
          <Button
            onClick={() => data?.previewToken && onConfirm(data.previewToken, data.eligibleIds)}
            disabled={!canConfirm}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
            data-testid="button-bulk-confirm-send"
          >
            {sending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Invio in corso…</>
              : <><Send className="h-4 w-4 mr-2" />Invia ora a {eligibleCount} clienti</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
