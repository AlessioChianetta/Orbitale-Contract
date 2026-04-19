import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, Link as LinkIcon, AtSign, FileText, AlertCircle, ShieldCheck, Send, Eye } from "lucide-react";
import ProfessionalContractDocument from "./professional-contract-document";

export interface SendGateRecipient {
  email: string;
  /** Etichetta umana, es. "Mario Rossi (Acme Srl)" */
  label?: string;
}

export interface SendGatePreviewData {
  template: any;
  generatedContent: string;
  companySettings: any;
  previewToken: string;
  previewTokenExpiresAt?: number;
}

export interface SendGateEmailData {
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
  to: string;
  signLink: string;
  contractCode: string;
  clientName: string;
}

export interface SendConfirmationGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Caricamento in corso di preview/email (gestito dal chiamante). */
  loading?: boolean;
  /** Errore caricamento preview o invio. */
  error?: string | null;
  /** Dati della preview documento + token HMAC. */
  previewData: SendGatePreviewData | null;
  /** Dati della preview email che il cliente riceverà. */
  emailData: SendGateEmailData | null;
  /** Dati per il rendering del documento (clientData, paymentPlan, ecc.) */
  documentProps: {
    clientData: any;
    paymentPlan?: Array<{ rata_numero: number; rata_importo: string; rata_scadenza: string }>;
    bonusList?: Array<{ bonus_descrizione: string }>;
    usingCustomInstallments?: boolean;
    contract: {
      isPercentagePartnership?: boolean;
      partnershipPercentage?: number | null;
      renewalDuration?: number | null;
      contractStartDate?: string;
      contractEndDate?: string;
    };
  };
  /** Etichetta secondaria sotto il pulsante (es. nome contratto). */
  contextLabel?: string;
  /** Callback chiamato quando l'utente conferma l'invio. */
  onConfirm: () => void;
  /** Stato dell'invio in corso. */
  sending?: boolean;
}

/**
 * Gate finale prima dell'invio reale al cliente. Mostra side-by-side
 * l'email che il cliente riceverà e il documento allegato/linkato,
 * con riepilogo destinatario + checkbox di consenso esplicito.
 */
export default function SendConfirmationGate(props: SendConfirmationGateProps) {
  const { open, onOpenChange, loading, error, previewData, emailData, documentProps, contextLabel, onConfirm, sending } = props;
  const [confirmed, setConfirmed] = useState(false);
  const [view, setView] = useState<"email" | "document">("email");

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setView("email");
    }
  }, [open]);

  const ready = !loading && !error && previewData && emailData;
  const expiresIn = useMemo(() => {
    if (!previewData?.previewTokenExpiresAt) return null;
    const ms = previewData.previewTokenExpiresAt - Date.now();
    if (ms <= 0) return "scaduta";
    const min = Math.floor(ms / 60000);
    return `${min} min`;
  }, [previewData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[96vw] max-h-[95vh] p-0 rounded-[20px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] border-0 overflow-hidden bg-slate-50 flex flex-col">
        <div className="p-6 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl font-bold text-white">
              <ShieldCheck className="h-5 w-5 mr-2" />
              Conferma invio contratto al cliente
            </DialogTitle>
            <DialogDescription className="text-white/80 mt-1">
              Controlla esattamente cosa riceverà il cliente. L'invio reale avviene solo dopo la tua conferma.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600 p-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-sm">Sto preparando l'anteprima esatta dell'email e del documento…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 max-w-2xl">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div className="text-sm">{error}</div>
              </div>
            </div>
          )}

          {ready && previewData && emailData && (
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[420px_1fr]">
              {/* Riepilogo destinatario */}
              <aside className="border-r border-slate-200 bg-white p-6 overflow-y-auto space-y-5">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Destinatario</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <AtSign className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-slate-900">{emailData.to}</div>
                        {emailData.clientName && (
                          <div className="text-xs text-slate-500">{emailData.clientName}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Mittente</h4>
                  <div className="text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{emailData.fromName}</div>
                    <div className="text-xs text-slate-500">{emailData.fromEmail}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Oggetto email</h4>
                  <div className="text-sm text-slate-900 break-words">{emailData.subject}</div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Codice contratto</h4>
                  <div className="text-sm font-mono text-slate-900">{emailData.contractCode}</div>
                  {emailData.contractCode === "ANTEPRIMA" && (
                    <div className="text-[11px] text-amber-700 mt-1 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Il codice definitivo verrà generato all'invio (formato identico, es. <code>ORB-2026-0123</code>).</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5" /> Link di firma
                  </h4>
                  <a
                    href={emailData.signLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-700 hover:text-indigo-900 underline break-all"
                    data-testid="link-preview-sign"
                  >
                    {emailData.signLink}
                  </a>
                  {emailData.contractCode === "ANTEPRIMA" && (
                    <div className="text-[11px] text-amber-700 mt-1">
                      Anteprima del formato: il link reale viene firmato e attivato al momento dell'invio.
                    </div>
                  )}
                </div>

                {contextLabel && (
                  <div className="text-xs text-slate-500 italic border-t border-slate-100 pt-4">{contextLabel}</div>
                )}
                {expiresIn && (
                  <div className="text-xs text-slate-400">Anteprima valida per ancora {expiresIn}.</div>
                )}
              </aside>

              {/* Vista email/documento */}
              <section className="flex-1 overflow-hidden flex flex-col bg-slate-100">
                <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-200 bg-white">
                  <Button
                    type="button"
                    size="sm"
                    variant={view === "email" ? "default" : "ghost"}
                    onClick={() => setView("email")}
                    className={view === "email" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-600"}
                    data-testid="tab-preview-email"
                  >
                    <Mail className="h-4 w-4 mr-1.5" />
                    Email che il cliente riceverà
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={view === "document" ? "default" : "ghost"}
                    onClick={() => setView("document")}
                    className={view === "document" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-600"}
                    data-testid="tab-preview-document"
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Documento contratto
                  </Button>
                </div>

                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  {view === "email" ? (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-full min-h-[500px]">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5" />
                        Anteprima HTML — identica a quella che riceverà il destinatario.
                      </div>
                      <iframe
                        title="Anteprima email"
                        srcDoc={emailData.html}
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        className="w-full h-[600px] bg-white"
                        data-testid="iframe-preview-email"
                      />
                    </div>
                  ) : (
                    <ProfessionalContractDocument
                      mode="preview"
                      hidePlaceholders
                      companySettings={previewData.companySettings || {}}
                      clientData={documentProps.clientData}
                      template={{
                        ...previewData.template,
                        content: previewData.generatedContent,
                      }}
                      contract={{
                        createdAt: new Date().toISOString(),
                        status: "draft",
                        isPercentagePartnership: !!documentProps.contract.isPercentagePartnership,
                        partnershipPercentage: documentProps.contract.partnershipPercentage ?? undefined,
                        renewalDuration: documentProps.contract.renewalDuration ?? undefined,
                        contractStartDate: documentProps.contract.contractStartDate,
                        contractEndDate: documentProps.contract.contractEndDate,
                      }}
                      paymentPlan={documentProps.paymentPlan}
                      bonusList={documentProps.bonusList}
                      usingCustomInstallments={documentProps.usingCustomInstallments}
                    />
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between flex-shrink-0">
          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              disabled={!ready || sending}
              className="mt-0.5"
              data-testid="checkbox-confirm-send"
            />
            <span>
              Confermo di aver controllato email, link e documento.
              <span className="block text-xs text-slate-500">L'invio al cliente è un'azione definitiva.</span>
            </span>
          </label>
          <div className="flex gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
              className="h-11 min-w-[140px] rounded-xl"
              data-testid="button-cancel-send"
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={!ready || !confirmed || sending}
              className="h-11 min-w-[200px] rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-md hover:shadow-lg disabled:opacity-50"
              data-testid="button-confirm-send"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Invio in corso…</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Invia ora al cliente</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
