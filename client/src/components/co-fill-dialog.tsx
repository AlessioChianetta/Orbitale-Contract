import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Link as LinkIcon, X, Loader2, MessageCircle, QrCode, Wifi } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CoFillDialogProps {
  open: boolean;
  onClose: () => void;
  initialData: Record<string, any>;
  contractId?: number | null;
  templateId?: number | null;
  onSessionStart: (token: string, contractId?: number | null) => void;
  onSessionEnd: () => void;
  activeToken: string | null;
  clientConnected: boolean;
}

export default function CoFillDialog({
  open, onClose, initialData, contractId, templateId, onSessionStart, onSessionEnd, activeToken, clientConnected,
}: CoFillDialogProps) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    if (!activeToken) return "";
    return `${window.location.origin}/co-fill/${activeToken}`;
  }, [activeToken]);

  const qrUrl = useMemo(() => {
    if (!link) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(link)}`;
  }, [link]);

  const whatsappUrl = useMemo(() => {
    if (!link) return "";
    const text = `Ciao! Compila qui i tuoi dati per il contratto: ${link}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [link]);

  useEffect(() => { if (!open) setCopied(false); }, [open]);

  const startSession = async () => {
    setCreating(true);
    try {
      const res = await apiRequest("POST", "/api/co-fill/sessions", {
        initialData,
        contractId: contractId ?? undefined,
        templateId: templateId ?? undefined,
      });
      const json = await res.json();
      onSessionStart(json.token, json.contractId ?? null);
      toast({
        title: "Link generato",
        description: "Bozza salvata. Condividi il link con il cliente per iniziare.",
      });
    } catch (e: any) {
      toast({ title: "Impossibile generare il link", description: e?.message || "Riprova.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const endSession = async () => {
    if (!activeToken) return;
    setTerminating(true);
    try {
      await apiRequest("DELETE", `/api/co-fill/sessions/${activeToken}`);
      onSessionEnd();
      toast({ title: "Sessione terminata", description: "Il link non è più valido." });
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message || "Impossibile terminare la sessione", variant: "destructive" });
    } finally {
      setTerminating(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copia non riuscita", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-600" />
            Compila con il cliente
          </DialogTitle>
          <DialogDescription>
            Genera un link da inviare al cliente. Mentre lo compila dal suo dispositivo, vedrai i dati apparire in tempo reale qui.
          </DialogDescription>
        </DialogHeader>

        {!activeToken ? (
          <div className="py-2">
            <Button onClick={startSession} disabled={creating} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generazione…</> : "Genera link condiviso"}
            </Button>
            <p className="text-xs text-slate-500 mt-3">
              Il link è valido 24 ore. Solo chi conosce il link può accedere.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={clientConnected ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}>
                <Wifi className="h-3 w-3 mr-1" />
                {clientConnected ? "Cliente connesso" : "In attesa del cliente…"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="h-11 rounded-xl text-sm" />
              <Button type="button" variant="outline" onClick={copyLink} className="h-11 rounded-xl">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center justify-center bg-slate-50 rounded-xl p-4">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="QR code link cliente" width={220} height={220} className="rounded-md bg-white p-2" />
              ) : (
                <div className="text-slate-400 text-sm flex items-center"><QrCode className="h-4 w-4 mr-2" /> QR non disponibile</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-700">
                <MessageCircle className="h-4 w-4 mr-2 text-emerald-600" /> Invia su WhatsApp
              </a>
              <Button variant="outline" onClick={endSession} disabled={terminating} className="h-10 rounded-xl text-red-600 hover:text-red-700">
                {terminating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                Termina sessione
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
