import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, FileText, Gift, Euro, Layers, Calendar, Users, Lock, AlertCircle, Eye } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { parseSections, type ModularSection } from "@shared/sections";
import type { ContractPreset, ContractTemplate, InsertContractPreset } from "@shared/schema";
import SectionPreviewDialog from "./section-preview-dialog";

interface PresetEditorProps {
  preset?: ContractPreset | null;
  onClose: () => void;
}

type PresetForm = {
  name: string;
  description: string;
  visibility: "personal" | "shared";
  templateId: number | null;
  selectedSectionIds: string[];
  bonusList: Array<{ bonus_descrizione: string }>;
  paymentPlan: Array<{ rata_importo?: string; rata_scadenza?: string }>;
  rataList: Array<{ rata_importo?: number | string; rata_scadenza?: string }>;
  totalValue: string;
  isPercentagePartnership: boolean;
  partnershipPercentage: string;
  autoRenewal: boolean;
  renewalDuration: number;
  defaultDurationMonths: string;
};

export default function PresetEditor({ preset, onClose }: PresetEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!preset;
  const isAdmin = user?.role === "admin";

  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const [form, setForm] = useState<PresetForm>(() => ({
    name: preset?.name || "",
    description: preset?.description || "",
    visibility: (preset?.visibility as "personal" | "shared") || "personal",
    templateId: preset?.templateId ?? null,
    selectedSectionIds: Array.isArray(preset?.selectedSectionIds) ? preset!.selectedSectionIds : [],
    bonusList: Array.isArray(preset?.bonusList) ? preset!.bonusList : [],
    paymentPlan: Array.isArray(preset?.paymentPlan)
      ? preset!.paymentPlan.map((p) => ({
          rata_importo: p.rata_importo != null ? String(p.rata_importo) : undefined,
          rata_scadenza: p.rata_scadenza,
        }))
      : [],
    rataList: Array.isArray(preset?.rataList) ? preset!.rataList : [],
    totalValue: preset?.totalValue != null ? String(preset.totalValue) : "",
    isPercentagePartnership: !!preset?.isPercentagePartnership,
    partnershipPercentage: preset?.partnershipPercentage != null ? String(preset.partnershipPercentage) : "",
    autoRenewal: !!preset?.autoRenewal,
    renewalDuration: preset?.renewalDuration ?? 12,
    defaultDurationMonths: preset?.defaultDurationMonths != null ? String(preset.defaultDurationMonths) : "",
  }));

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === form.templateId) || null,
    [templates, form.templateId],
  );
  const sections: ModularSection[] = useMemo(
    () => parseSections(selectedTemplate?.sections),
    [selectedTemplate],
  );
  const templateMissing = isEditing && form.templateId != null && templates.length > 0 && !selectedTemplate;

  const [previewSectionId, setPreviewSectionId] = useState<string | null>(null);
  const previewSection = useMemo(
    () => sections.find((s) => s.id === previewSectionId) || null,
    [sections, previewSectionId],
  );

  // Quando cambia template, rimuovi gli ID di sezione che non esistono più
  useEffect(() => {
    if (!selectedTemplate) return;
    const validIds = new Set(sections.map((s) => s.id));
    setForm((f) => {
      const filtered = f.selectedSectionIds.filter((id) => validIds.has(id));
      return filtered.length === f.selectedSectionIds.length ? f : { ...f, selectedSectionIds: filtered };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.id]);

  const saveMutation = useMutation<unknown, Error, Partial<InsertContractPreset>>({
    mutationFn: async (payload) => {
      const url = isEditing ? `/api/presets/${preset!.id}` : "/api/presets";
      const method = isEditing ? "PUT" : "POST";
      return await apiRequest(method, url, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presets"] });
      toast({ title: isEditing ? "Preset aggiornato" : "Preset creato", description: "Le modifiche sono state salvate." });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Errore nel salvataggio", description: err.message || "Riprova", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Nome richiesto", description: "Dai un nome al preset", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      visibility: form.visibility,
      templateId: form.templateId,
      selectedSectionIds: form.selectedSectionIds,
      bonusList: form.bonusList.filter((b) => b.bonus_descrizione?.trim()),
      paymentPlan: form.paymentPlan.filter((p) => p.rata_importo || p.rata_scadenza),
      rataList: form.rataList.filter((r) => r.rata_importo || r.rata_scadenza),
      totalValue: form.totalValue.trim() || null,
      isPercentagePartnership: form.isPercentagePartnership,
      partnershipPercentage: form.isPercentagePartnership ? (form.partnershipPercentage.trim() || null) : null,
      autoRenewal: form.autoRenewal,
      renewalDuration: Number(form.renewalDuration) || 12,
      defaultDurationMonths: form.defaultDurationMonths.trim() ? Number(form.defaultDurationMonths) : null,
    };
    saveMutation.mutate(payload);
  };

  const toggleSection = (id: string) => {
    // I moduli "required" del template non possono essere disattivati: il
    // server li include comunque. Manteniamoli sempre presenti nella lista.
    const sec = sections.find((s) => s.id === id);
    if (sec?.required) {
      setForm((f) =>
        f.selectedSectionIds.includes(id) ? f : { ...f, selectedSectionIds: [...f.selectedSectionIds, id] },
      );
      return;
    }
    setForm((f) => ({
      ...f,
      selectedSectionIds: f.selectedSectionIds.includes(id)
        ? f.selectedSectionIds.filter((x) => x !== id)
        : [...f.selectedSectionIds, id],
    }));
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            {isEditing ? "Modifica Preset Offerta" : "Nuovo Preset Offerta"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Salva una configurazione completa di contratto (template, pacchetti, bonus, prezzi e durata) da riutilizzare.
            Quando creerai un nuovo contratto basterà caricare il preset e compilare solo i dati cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Sezione 1: Info base */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
              Informazioni preset
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Nome preset *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Es. Offerta Standard 12 mesi"
                  className="mt-1"
                  data-testid="input-preset-name"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Visibilità
                </Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) => setForm({ ...form, visibility: v as "personal" | "shared" })}
                  disabled={!isAdmin && form.visibility !== "shared"}
                >
                  <SelectTrigger className="mt-1" data-testid="select-preset-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Solo io (personale)</SelectItem>
                    <SelectItem value="shared" disabled={!isAdmin}>
                      Tutta l'azienda (condiviso) {!isAdmin && "— solo admin"}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!isAdmin && (
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Solo gli admin possono creare preset condivisi.
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Descrizione (opzionale)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A cosa serve questo preset, quando usarlo..."
                rows={2}
                className="mt-1"
              />
            </div>
          </section>

          {/* Sezione 2: Template + Sezioni */}
          <section className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
              Template e pacchetti
            </h3>
            {templateMissing && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Template originale non più disponibile</p>
                  <p className="text-xs mt-0.5">Seleziona un nuovo template per riattivare questo preset.</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-slate-700">Template di contratto</Label>
              <Select
                value={form.templateId?.toString() || "none"}
                onValueChange={(v) => setForm({ ...form, templateId: v === "none" ? null : parseInt(v) })}
              >
                <SelectTrigger className="mt-1" data-testid="select-preset-template">
                  <SelectValue placeholder="Seleziona un template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nessun template —</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sections.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-2">
                  <Layers className="h-3 w-3" />
                  Pacchetti / moduli inclusi
                </Label>
                <div className="space-y-1.5 border border-slate-200 rounded-lg p-3 bg-slate-50">
                  {sections.map((s) => {
                    const checked = form.selectedSectionIds.includes(s.id);
                    return (
                      <div key={s.id} className="flex items-start gap-1 hover:bg-white p-2 rounded-md transition-colors">
                        <label className="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSection(s.id)}
                            className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-slate-300"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{s.title}</p>
                            {s.required && <Badge variant="outline" className="text-[10px] mt-0.5">Obbligatoria</Badge>}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => setPreviewSectionId(s.id)}
                          className="shrink-0 p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Anteprima contenuto del modulo"
                          data-testid={`preset-section-preview-${s.id}`}
                          aria-label={`Anteprima ${s.title}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {form.selectedSectionIds.length} di {sections.length} pacchetti selezionati
                </p>
              </div>
            )}
          </section>

          {/* Sezione 3: Bonus */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">3</span>
              <Gift className="h-4 w-4" /> Bonus inclusi
            </h3>
            {form.bonusList.map((b, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={b.bonus_descrizione}
                  onChange={(e) => {
                    const next = [...form.bonusList];
                    next[i] = { bonus_descrizione: e.target.value };
                    setForm({ ...form, bonusList: next });
                  }}
                  placeholder="Es. 1 ora di consulenza strategica"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, bonusList: form.bonusList.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, bonusList: [...form.bonusList, { bonus_descrizione: "" }] })}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi bonus
            </Button>
          </section>

          {/* Sezione 4: Prezzo e pagamento */}
          <section className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">4</span>
              <Euro className="h-4 w-4" /> Prezzo e pagamento
            </h3>
            <div className="flex items-center gap-3">
              <Switch checked={form.isPercentagePartnership} onCheckedChange={(v) => setForm({ ...form, isPercentagePartnership: v })} />
              <span className="text-sm text-slate-700">Partnership a percentuale</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {form.isPercentagePartnership ? (
                <div>
                  <Label className="text-xs font-medium text-slate-700">Percentuale partnership (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.partnershipPercentage}
                    onChange={(e) => setForm({ ...form, partnershipPercentage: e.target.value })}
                    placeholder="Es. 15"
                    className="mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs font-medium text-slate-700">Prezzo totale (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.totalValue}
                    onChange={(e) => setForm({ ...form, totalValue: e.target.value })}
                    placeholder="Es. 5000"
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {!form.isPercentagePartnership && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Rate (manuali)</Label>
                <p className="text-[11px] text-slate-400 mb-2">Lascia vuoto per usare il piano automatico al momento del contratto.</p>
                {form.rataList.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Importo €"
                      value={r.rata_importo != null ? String(r.rata_importo) : ""}
                      onChange={(e) => {
                        const next = [...form.rataList];
                        next[i] = { ...next[i], rata_importo: e.target.value ? Number(e.target.value) : undefined };
                        setForm({ ...form, rataList: next });
                      }}
                    />
                    <Input
                      type="date"
                      value={r.rata_scadenza || ""}
                      onChange={(e) => {
                        const next = [...form.rataList];
                        next[i] = { ...next[i], rata_scadenza: e.target.value };
                        setForm({ ...form, rataList: next });
                      }}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, rataList: form.rataList.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, rataList: [...form.rataList, {}] })}>
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi rata
                </Button>
              </div>
            )}
          </section>

          {/* Sezione 5: Durata */}
          <section className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">5</span>
              <Calendar className="h-4 w-4" /> Durata e rinnovo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Durata standard (mesi)</Label>
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={form.defaultDurationMonths}
                  onChange={(e) => setForm({ ...form, defaultDurationMonths: e.target.value })}
                  placeholder="Es. 12"
                  className="mt-1"
                />
                <p className="text-[11px] text-slate-400 mt-1">Quando il preset viene caricato, la data di fine sarà calcolata automaticamente.</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Durata rinnovo (mesi)</Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={form.renewalDuration}
                  onChange={(e) => setForm({ ...form, renewalDuration: parseInt(e.target.value) || 12 })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.autoRenewal} onCheckedChange={(v) => setForm({ ...form, autoRenewal: v })} />
              <span className="text-sm text-slate-700">Rinnovo automatico</span>
            </div>
          </section>
        </form>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button type="button" variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-preset">
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Salvataggio…" : isEditing ? "Salva modifiche" : "Crea preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <SectionPreviewDialog
        section={previewSection}
        open={!!previewSection}
        isSelected={
          previewSection
            ? previewSection.required || form.selectedSectionIds.includes(previewSection.id)
            : false
        }
        onClose={() => setPreviewSectionId(null)}
        onToggle={(id) => toggleSection(id)}
      />
    </Dialog>
  );
}
