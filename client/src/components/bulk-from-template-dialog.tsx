import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Settings2, Mail, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, Plus, Trash2, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { parseSections, defaultSelectedIds, type ModularSection } from "@shared/sections";

type Template = {
  id: number;
  name: string;
  category?: string;
  sections?: unknown;
  predefinedBonuses?: Array<{ description?: string; value?: string | number; type?: "percentage" | "fixed" }>;
};

type BonusRow = { description: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (batchId: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[\s,;]+/g)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (EMAIL_RE.test(t)) valid.push(t);
    else invalid.push(t);
  }
  return { valid, invalid };
}

export default function BulkFromTemplateDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const { data: templates = [], isLoading: tplLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: open,
  });
  const [templateId, setTemplateId] = useState<number | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId],
  );
  const templateSections: ModularSection[] = useMemo(
    () => (selectedTemplate ? parseSections(selectedTemplate.sections) : []),
    [selectedTemplate],
  );

  // Step 2 — condizioni
  const [batchLabel, setBatchLabel] = useState<string>("");
  const [totalValue, setTotalValue] = useState<string>(""); // €
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [renewalDuration, setRenewalDuration] = useState<number>(12);
  const [contractStartDate, setContractStartDate] = useState<string>("");
  const [contractEndDate, setContractEndDate] = useState<string>("");
  const [isPercentagePartnership, setIsPercentagePartnership] = useState(false);
  const [partnershipPercentage, setPartnershipPercentage] = useState<string>("");
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[] | null>(null);
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);

  // Quando il template cambia, reinizializza sezioni e bonus alle scelte di default.
  useEffect(() => {
    if (!selectedTemplate) {
      setSelectedSectionIds(null);
      setBonuses([]);
      return;
    }
    setSelectedSectionIds(defaultSelectedIds(templateSections));
    setBonuses([]);
  }, [selectedTemplate, templateSections]);

  // Step 3 — emails
  const [emailsRaw, setEmailsRaw] = useState<string>("");
  const parsed = useMemo(() => parseEmails(emailsRaw), [emailsRaw]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setTemplateId(null);
      setBatchLabel("");
      setTotalValue("");
      setAutoRenewal(false);
      setRenewalDuration(12);
      setContractStartDate("");
      setContractEndDate("");
      setIsPercentagePartnership(false);
      setPartnershipPercentage("");
      setSelectedSectionIds(null);
      setBonuses([]);
      setEmailsRaw("");
      setSubmitting(false);
    }
  }, [open]);

  const canStep1 = !!templateId;
  const canStep2 = true; // condizioni sono tutte opzionali a questo livello
  const canStep3 = parsed.valid.length > 0 && parsed.valid.length <= 100;

  const submit = async () => {
    if (!canStep1 || !canStep3) return;
    setSubmitting(true);
    try {
      const totalCents = totalValue ? Math.round(Number(totalValue.replace(",", ".")) * 100) : null;
      const cleanedBonuses = bonuses
        .map((b) => ({ bonus_descrizione: b.description.trim() }))
        .filter((b) => b.bonus_descrizione.length > 0);
      const body: any = {
        templateId,
        emails: parsed.valid,
        batchLabel: batchLabel.trim() || undefined,
        totalValue: totalCents,
        autoRenewal,
        renewalDuration,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        isPercentagePartnership,
        partnershipPercentage: isPercentagePartnership && partnershipPercentage
          ? Number(partnershipPercentage.replace(",", "."))
          : null,
        selectedSectionIds: selectedSectionIds ?? undefined,
        bonusList: cleanedBonuses.length > 0 ? cleanedBonuses : undefined,
      };
      const res = await fetch("/api/contracts/bulk-from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Creazione non riuscita");
      toast({
        title: "Lotto creato",
        description: `${json.created?.length ?? 0} bozze create${json.failed?.length ? `, ${json.failed.length} errori` : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      onCreated?.(json.batchId);
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Errore", description: e?.message || "Riprova tra poco." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Crea contratti in blocco da template
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
          {[
            { n: 1, label: "Template", icon: FileText },
            { n: 2, label: "Condizioni", icon: Settings2 },
            { n: 3, label: "Destinatari", icon: Mail },
          ].map(({ n, label, icon: Icon }) => (
            <div key={n} className={`flex items-center gap-1.5 ${step === n ? "text-indigo-700" : ""}`}>
              <span className={`h-7 w-7 inline-flex items-center justify-center rounded-full border ${step === n ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3 py-2">
            <Label>Scegli il template</Label>
            {tplLoading ? (
              <div className="flex items-center text-sm text-slate-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Caricamento…</div>
            ) : templates.length === 0 ? (
              <div className="text-sm text-slate-500">Nessun template disponibile. Creane uno nella sezione Admin.</div>
            ) : (
              <Select value={templateId ? String(templateId) : ""} onValueChange={(v) => setTemplateId(Number(v))}>
                <SelectTrigger data-testid="bulk-template-select"><SelectValue placeholder="Seleziona un template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.category ? ` — ${t.category}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-slate-500">
              I contratti generati saranno bozze in modalità "compila il cliente": ogni destinatario riceverà
              il link e completerà i propri dati prima di firmare.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div>
              <Label>Etichetta del lotto</Label>
              <Input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Es. Campagna Aprile" />
              <p className="text-xs text-slate-500 mt-1">Se vuota, useremo "Lotto del…" con la data corrente.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Importo totale (€)</Label>
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Durata (mesi)</Label>
                <Input type="number" min="1" max="120" value={renewalDuration} onChange={(e) => setRenewalDuration(Number(e.target.value) || 12)} />
              </div>
              <div>
                <Label>Data inizio</Label>
                <Input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Data fine</Label>
                <Input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={autoRenewal} onCheckedChange={(v) => setAutoRenewal(!!v)} />
              <span>Rinnovo automatico</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPercentagePartnership} onCheckedChange={(v) => setIsPercentagePartnership(!!v)} />
              <span>Partnership a percentuale</span>
            </label>
            {isPercentagePartnership && (
              <div>
                <Label>Percentuale (%)</Label>
                <Input type="number" min="0" max="100" step="0.01" value={partnershipPercentage} onChange={(e) => setPartnershipPercentage(e.target.value)} placeholder="Es. 10" />
              </div>
            )}
            {/* Sezioni modulari del template */}
            {templateSections.length > 0 && (
              <div className="border-t pt-4">
                <Label className="mb-2 block">Sezioni del contratto</Label>
                <p className="text-xs text-slate-500 mb-3">
                  Scegli quali sezioni modulari del template includere in tutti i contratti del lotto. Le sezioni obbligatorie sono sempre attive.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {templateSections.map((sec) => {
                    const ids = selectedSectionIds ?? defaultSelectedIds(templateSections);
                    const checked = sec.required || ids.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                          checked ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        data-testid={`bulk-section-${sec.id}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          disabled={!!sec.required}
                          onChange={(e) => {
                            const current = selectedSectionIds ?? defaultSelectedIds(templateSections);
                            const next = e.target.checked
                              ? Array.from(new Set([...current, sec.id]))
                              : current.filter((id) => id !== sec.id);
                            setSelectedSectionIds(next);
                          }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{sec.title}</span>
                            {sec.required && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">Obbl.</span>
                            )}
                          </div>
                          {sec.description && <p className="text-xs text-slate-500 mt-0.5">{sec.description}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bonus aggiuntivi */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2"><Gift className="h-4 w-4 text-indigo-600" /> Bonus aggiuntivi</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBonuses((arr) => [...arr, { description: "" }])}
                  data-testid="bulk-add-bonus"
                >
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi
                </Button>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Bonus opzionali che verranno aggiunti a tutti i contratti del lotto. I bonus predefiniti del template sono comunque inclusi.
              </p>
              {bonuses.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nessun bonus aggiuntivo.</p>
              ) : (
                <div className="space-y-2">
                  {bonuses.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={b.description}
                        onChange={(e) => setBonuses((arr) => arr.map((x, i) => (i === idx ? { description: e.target.value } : x)))}
                        placeholder="Es. 1 mese gratuito di assistenza"
                        data-testid={`bulk-bonus-${idx}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setBonuses((arr) => arr.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 border-t pt-3">
              Tutti i contratti del lotto avranno le stesse condizioni economiche, le stesse sezioni e gli stessi bonus. I dati anagrafici li compilerà il cliente.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 py-2">
            <Label>Email destinatari</Label>
            <Textarea
              rows={8}
              value={emailsRaw}
              onChange={(e) => setEmailsRaw(e.target.value)}
              placeholder={"mario@esempio.com\nlucia@altrazienda.it,giovanni@esempio.com"}
              data-testid="bulk-emails-textarea"
            />
            <div className="text-xs text-slate-500">
              Separa con virgole, punti e virgola, spazi o nuove righe. Massimo 100 destinatari per lotto.
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {parsed.valid.length} validi
              </span>
              {parsed.invalid.length > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700" title={parsed.invalid.join(", ")}>
                  <AlertTriangle className="h-4 w-4" /> {parsed.invalid.length} ignorati
                </span>
              )}
            </div>
            {parsed.valid.length > 100 && (
              <div className="text-xs text-red-600">Hai superato il limite di 100 email per lotto. Rimuovine alcune.</div>
            )}
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => (s - 1) as 1 | 2 | 3))}>
            {step === 1 ? "Annulla" : (<><ChevronLeft className="h-4 w-4 mr-1" />Indietro</>)}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={(step === 1 && !canStep1) || (step === 2 && !canStep2)}
              data-testid={`bulk-next-step${step}`}
            >
              Avanti<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canStep3 || submitting} data-testid="bulk-create-submit">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creo {parsed.valid.length} bozze…</> : `Crea ${parsed.valid.length} bozze`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
