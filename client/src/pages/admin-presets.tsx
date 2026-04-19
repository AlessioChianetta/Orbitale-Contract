import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Copy, FileText, Layers, Gift, Euro, Calendar, Users, Lock, AlertCircle, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PresetEditor from "@/components/preset-editor";
import { Link } from "wouter";
import type { ContractPreset, ContractTemplate } from "@shared/schema";

export default function AdminPresetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContractPreset | null>(null);
  const isAdmin = user?.role === "admin";
  // I venditori accedono comunque alla pagina: vedono e gestiscono i propri
  // preset personali e usano in lettura quelli condivisi dall'azienda.
  const backHref = isAdmin ? "/admin" : "/seller";

  const { data: presets = [], isLoading } = useQuery<ContractPreset[]>({
    queryKey: ["/api/presets"],
  });
  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/presets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presets"] });
      toast({ title: "Preset eliminato" });
    },
    onError: () => toast({ title: "Errore eliminazione", variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (p: ContractPreset) => {
      // Crea una copia con visibilità "personal" (così funziona anche per
      // i venditori) e nome "<originale> (copia)".
      const payload = {
        name: `${p.name} (copia)`,
        description: p.description ?? null,
        visibility: "personal" as const,
        templateId: p.templateId,
        selectedSectionIds: Array.isArray(p.selectedSectionIds) ? p.selectedSectionIds : [],
        bonusList: Array.isArray(p.bonusList) ? p.bonusList : [],
        paymentPlan: Array.isArray(p.paymentPlan) ? p.paymentPlan : [],
        rataList: Array.isArray(p.rataList) ? p.rataList : [],
        totalValue: p.totalValue,
        isPercentagePartnership: p.isPercentagePartnership,
        partnershipPercentage: p.partnershipPercentage,
        autoRenewal: p.autoRenewal,
        renewalDuration: p.renewalDuration,
        defaultDurationMonths: p.defaultDurationMonths,
        fillMode: p.fillMode,
      };
      const res = await apiRequest("POST", "/api/presets", payload);
      return await res.json() as ContractPreset;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/presets"] });
      toast({ title: "Preset duplicato", description: `Aperto "${created.name}" per la modifica.` });
      setEditing(created);
      setEditorOpen(true);
    },
    onError: () => toast({ title: "Errore duplicazione", variant: "destructive" }),
  });

  const handleEdit = (p: ContractPreset) => { setEditing(p); setEditorOpen(true); };
  const handleNew = () => { setEditing(null); setEditorOpen(true); };
  const handleClose = () => { setEditorOpen(false); setEditing(null); };
  const handleDelete = (p: ContractPreset) => {
    if (confirm(`Eliminare il preset "${p.name}"?`)) deleteMutation.mutate(p.id);
  };

  const templateName = (id: number | null | undefined) =>
    id ? templates.find((t) => t.id === id)?.name : null;

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <header className="bg-white/80 backdrop-blur-md border-b border-black/[0.04] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={backHref}>
              <Button variant="ghost" size="sm" data-testid="link-back-admin">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <div className="w-px h-6 bg-slate-200" />
            <h1 className="text-lg font-semibold text-slate-900">Preset Offerta</h1>
          </div>
          <Button onClick={handleNew} className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white" data-testid="button-new-preset">
            <Plus className="h-4 w-4 mr-2" />
            Nuovo preset
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">I tuoi preset offerta</h2>
          <p className="text-sm text-slate-500 mt-1">
            Salva configurazioni complete (template, pacchetti, bonus, prezzi, durata) e riusale per nuovi contratti compilando solo i dati cliente.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-slate-400">Caricamento…</div>
        ) : presets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Nessun preset ancora</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Crea il primo preset per riutilizzare un'offerta completa quando generi un nuovo contratto.
            </p>
            <Button onClick={handleNew} className="mt-5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white">
              <Plus className="h-4 w-4 mr-2" /> Crea il primo preset
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {presets.map((p) => {
              const tName = templateName(p.templateId);
              const sectionsCount = Array.isArray(p.selectedSectionIds) ? p.selectedSectionIds.length : 0;
              const bonusesCount = Array.isArray(p.bonusList) ? p.bonusList.length : 0;
              const ratesCount = Array.isArray(p.rataList) ? p.rataList.length : 0;
              const isMine = p.createdBy === user?.id;
              const templateMissing = p.templateId != null && !tName;
              return (
                <div
                  key={p.id}
                  className="group flex items-stretch gap-4 p-5 bg-white border border-slate-200/70 rounded-2xl hover:border-indigo-300 hover:shadow-[0_4px_16px_rgba(79,70,229,0.08)] transition-all"
                  data-testid={`card-preset-${p.id}`}
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15px] font-semibold text-slate-900 truncate">{p.name}</h3>
                      {p.visibility === "shared" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          <Users className="h-2.5 w-2.5 mr-1" /> Condiviso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          <Lock className="h-2.5 w-2.5 mr-1" /> Personale
                        </Badge>
                      )}
                      {templateMissing && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                          <AlertCircle className="h-2.5 w-2.5 mr-1" /> Template mancante
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-[13px] text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 flex-wrap">
                      {tName && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {tName}
                        </span>
                      )}
                      {sectionsCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3 w-3" /> {sectionsCount} moduli
                        </span>
                      )}
                      {bonusesCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Gift className="h-3 w-3" /> {bonusesCount} bonus
                        </span>
                      )}
                      {p.totalValue && (
                        <span className="inline-flex items-center gap-1">
                          <Euro className="h-3 w-3" /> {p.totalValue}
                        </span>
                      )}
                      {p.isPercentagePartnership && p.partnershipPercentage && (
                        <span className="inline-flex items-center gap-1">% {p.partnershipPercentage}</span>
                      )}
                      {ratesCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Euro className="h-3 w-3" /> {ratesCount} rate
                        </span>
                      )}
                      {p.defaultDurationMonths && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {p.defaultDurationMonths} mesi
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 self-center">
                    <button
                      type="button"
                      onClick={() => duplicateMutation.mutate(p)}
                      disabled={duplicateMutation.isPending}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
                      title="Duplica preset"
                      aria-label={`Duplica preset ${p.name}`}
                      data-testid={`button-duplicate-preset-${p.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    {(isMine || isAdmin) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Modifica"
                          aria-label={`Modifica preset ${p.name}`}
                          data-testid={`button-edit-preset-${p.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          title="Elimina"
                          aria-label={`Elimina preset ${p.name}`}
                          data-testid={`button-delete-preset-${p.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editorOpen && <PresetEditor preset={editing} onClose={handleClose} />}
    </div>
  );
}
