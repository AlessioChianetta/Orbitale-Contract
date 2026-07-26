import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  File, 
  CheckCircle, 
  Clock, 
  Users, 
  Plus, 
  Edit, 
  Trash2,
  Settings,
  BarChart3,
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  LogOut,
  TrendingUp,
  FileText,
  Calendar,
  Layers,
  Gift,
  ChevronRight,
  Tag,
  Archive,
  ArchiveRestore,
  Check,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TemplateEditor from "@/components/template-editor";
import { Redirect, Link } from "wouter";

// Suggerimenti predefiniti; l'admin può crearne di nuove dal popover categoria
const PRESET_CATEGORIES = ["Clienti", "Team", "Test/Archivio"];

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [categoryPopoverId, setCategoryPopoverId] = useState<number | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");

  if (user && user.role !== "admin") {
    return <Redirect to="/seller" />;
  }

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/templates"],
  });

  const { data: companySettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/company-settings"],
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template eliminato con successo" });
    },
    onError: () => {
      toast({ 
        title: "Errore", 
        description: "Impossibile eliminare il template",
        variant: "destructive" 
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      await apiRequest("PUT", `/api/templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il template",
        variant: "destructive",
      });
    },
  });

  const handleSetCategory = (id: number, category: string | null) => {
    updateTemplateMutation.mutate(
      { id, data: { category } },
      {
        onSuccess: () => {
          toast({ title: category ? `Categoria "${category}" assegnata` : "Categoria rimossa" });
        },
      },
    );
    setCategoryPopoverId(null);
    setCategoryDraft("");
  };

  const handleToggleArchive = (template: any) => {
    const activating = !template.isActive;
    const total = template.usage?.totalContracts || 0;
    const msg = activating
      ? `Riattivare il template "${template.name}"? Tornerà selezionabile per i nuovi contratti.`
      : `Archiviare il template "${template.name}"?\n\nNon sarà più proponibile per nuovi contratti; ${total > 0 ? `i ${total} contratti esistenti` : "i contratti esistenti"} non vengono toccati. Potrai riattivarlo in qualsiasi momento.`;
    if (!confirm(msg)) return;
    updateTemplateMutation.mutate(
      { id: template.id, data: { isActive: activating } },
      {
        onSuccess: () => {
          toast({ title: activating ? "Template riattivato" : "Template archiviato" });
        },
      },
    );
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setShowTemplateEditor(true);
  };

  const handleDeleteTemplate = (id: number, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare il template "${name}"?`)) {
      deleteTemplateMutation.mutate(id);
    }
  };

  const handleCloseEditor = () => {
    setShowTemplateEditor(false);
    setEditingTemplate(null);
  };

  // Categorie disponibili: suggerimenti predefiniti + quelle già in uso
  const existingCategories = Array.from(
    new Set((templates as any[]).map((t: any) => t.category).filter(Boolean)),
  ) as string[];
  const categoryOptions = Array.from(new Set([...PRESET_CATEGORIES, ...existingCategories]));

  // Ordine dei gruppi: categorie operative prima, Test/Archivio poi, senza categoria in fondo
  const categoryRank = (c: string | null | undefined) => {
    if (!c) return 3;
    if (c === "Test/Archivio") return 2;
    return 1;
  };

  const baseSort = (a: any, b: any) => {
    if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
    if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === "usage") return (b.usage?.totalContracts || 0) - (a.usage?.totalContracts || 0);
    return 0;
  };

  // Con "Tutte le categorie" la lista è raggruppata per categoria
  const groupByCategory = categoryFilter === "all";

  const filteredTemplates = (templates as any[])
    .filter((t: any) => {
      const matchesSearch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && t.isActive) || 
        (statusFilter === "inactive" && !t.isActive);
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "none" ? !t.category : t.category === categoryFilter);
      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a: any, b: any) => {
      if (groupByCategory) {
        const diff =
          categoryRank(a.category) - categoryRank(b.category) ||
          (a.category || "").localeCompare(b.category || "");
        if (diff !== 0) return diff;
      }
      return baseSort(a, b);
    });

  if (statsLoading || templatesLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto"></div>
          <p className="mt-4 text-slate-500">Caricamento dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <header className="bg-white/80 backdrop-blur-md border-b border-black/[0.04] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-xl flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">Turbo Contract</span>
              <span className="px-2.5 py-1 text-[11px] font-medium tracking-wider uppercase bg-slate-100 text-slate-500 rounded-lg">Admin</span>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/admin/presets">
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 hover:bg-black/[0.03] transition-all duration-200" data-testid="link-presets">
                  <Layers className="h-4 w-4 mr-2" />
                  Preset Offerta
                </Button>
              </Link>
              <Link href="/user-management">
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 hover:bg-black/[0.03] transition-all duration-200" data-testid="link-user-management">
                  <Users className="h-4 w-4 mr-2" />
                  Gestione Utenti
                </Button>
              </Link>
              <Link href="/company-settings">
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 hover:bg-black/[0.03] transition-all duration-200" data-testid="link-company-settings">
                  <Building2 className="h-4 w-4 mr-2" />
                  Impostazioni
                </Button>
              </Link>
              <div className="w-px h-6 bg-black/[0.06] mx-1"></div>
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-8 h-8 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.fullName?.charAt(0) || "A"}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {user?.fullName}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-tight">Dashboard</h2>
            <p className="mt-1 text-slate-500 text-[15px]">
              Gestione avanzata template e contratti
            </p>
          </div>
          <button
            onClick={() => setShowTemplateEditor(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-[2px] transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Nuovo Template
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Template Attivi</p>
                <p className="text-[32px] font-bold text-slate-900 leading-none">
                  {(stats as any)?.activeTemplates || 0}
                </p>
                <p className="text-xs text-[#059669] mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +12% questo mese
                </p>
              </div>
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
                <File className="h-5 w-5 text-[#4F46E5]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Contratti Firmati</p>
                <p className="text-[32px] font-bold text-slate-900 leading-none">
                  {(stats as any)?.signedContracts || 0}
                </p>
                <p className="text-xs text-[#059669] mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +8% questo mese
                </p>
              </div>
              <div className="w-11 h-11 bg-[#ECFDF5] rounded-xl flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-[#059669]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">In Attesa</p>
                <p className="text-[32px] font-bold text-slate-900 leading-none">
                  {(stats as any)?.pendingContracts || 0}
                </p>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Da completare
                </p>
              </div>
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Totale Contratti</p>
                <p className="text-[32px] font-bold text-slate-900 leading-none">
                  {(stats as any)?.totalContracts || 0}
                </p>
                <p className="text-xs text-[#059669] mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +15% questo mese
                </p>
              </div>
              <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-[#7C3AED]" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Gestione Template</h3>
                <p className="text-sm text-slate-500 mt-0.5">{(templates as any[]).length} template totali</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pb-5">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-black/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]/30 transition-all duration-200 placeholder:text-slate-400"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pl-10 pr-8 py-2.5 text-sm bg-white border border-black/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]/30 transition-all duration-200 cursor-pointer text-slate-600"
                >
                  <option value="all">Tutti gli stati</option>
                  <option value="active">Attivo</option>
                  <option value="inactive">Inattivo</option>
                </select>
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="appearance-none pl-10 pr-8 py-2.5 text-sm bg-white border border-black/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]/30 transition-all duration-200 cursor-pointer text-slate-600"
                  data-testid="select-category-filter"
                >
                  <option value="all">Tutte le categorie</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="none">Senza categoria</option>
                </select>
              </div>
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none pl-10 pr-8 py-2.5 text-sm bg-white border border-black/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]/30 transition-all duration-200 cursor-pointer text-slate-600"
                >
                  <option value="name">Ordina per nome</option>
                  <option value="date">Ordina per data</option>
                  <option value="usage">Ordina per utilizzo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <File className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Nessun template disponibile
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Inizia creando il tuo primo template di contratto.
                </p>
                <button
                  onClick={() => setShowTemplateEditor(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-[2px] transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  Crea Template
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1 pb-1">
                  <p className="text-xs text-slate-400">
                    {filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "template"}
                  </p>
                </div>

                {filteredTemplates.map((template: any, idx: number) => {
                  const sectionsCount = Array.isArray(template.sections) ? template.sections.length : 0;
                  const bonusesCount = Array.isArray(template.predefinedBonuses) ? template.predefinedBonuses.length : 0;
                  const dateLabel = new Date(template.createdAt).toLocaleDateString('it-IT', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  });
                  const usage = template.usage || { totalContracts: 0, activeContracts: 0, lastContractAt: null };
                  const lastContractLabel = usage.lastContractAt
                    ? new Date(usage.lastContractAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                    : null;
                  const prevCategory = idx > 0 ? (filteredTemplates[idx - 1].category ?? null) : undefined;
                  const showGroupHeader = groupByCategory && (idx === 0 || prevCategory !== (template.category ?? null));
                  const groupSize = filteredTemplates.filter((t: any) => (t.category ?? null) === (template.category ?? null)).length;

                  return (
                    <div key={template.id}>
                      {showGroupHeader && (
                        <div className={`flex items-center gap-2 px-1 pb-1.5 ${idx === 0 ? "" : "pt-4"}`}>
                          <Tag className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {template.category || "Senza categoria"}
                          </span>
                          <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
                            {groupSize}
                          </span>
                        </div>
                      )}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Modifica template ${template.name}`}
                      onClick={() => handleEditTemplate(template)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleEditTemplate(template);
                        }
                      }}
                      className="group relative flex items-stretch gap-4 p-4 bg-white border border-slate-200/70 rounded-2xl hover:border-indigo-300 hover:shadow-[0_4px_16px_rgba(79,70,229,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 transition-all duration-200 cursor-pointer"
                    >
                      {/* Status accent strip */}
                      <div
                        className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${
                          template.isActive ? "bg-emerald-400" : "bg-slate-200"
                        }`}
                      />

                      {/* Icon */}
                      <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ml-2 ${
                        template.isActive
                          ? "bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600"
                          : "bg-slate-50 text-slate-400"
                      }`}>
                        <FileText className="h-5 w-5" />
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                            {template.name}
                          </h3>
                          {template.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Attivo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 rounded-full uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Inattivo
                            </span>
                          )}
                          {usage.totalContracts === 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-full uppercase tracking-wide"
                              title="Nessun contratto è mai stato generato da questo template"
                              data-testid={`badge-never-used-${template.id}`}
                            >
                              Mai usato
                            </span>
                          )}
                          <Popover
                            open={categoryPopoverId === template.id}
                            onOpenChange={(open) => {
                              setCategoryPopoverId(open ? template.id : null);
                              if (!open) setCategoryDraft("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                title="Assegna categoria"
                                aria-label={`Categoria di ${template.name}`}
                                data-testid={`button-category-${template.id}`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wide border transition-colors ${
                                  template.category
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100"
                                    : "bg-white text-slate-400 border-dashed border-slate-300 hover:text-slate-600 hover:border-slate-400"
                                }`}
                              >
                                <Tag className="h-3 w-3" />
                                {template.category || "Categoria"}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-60 p-2"
                              align="start"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="text-xs font-medium text-slate-500 px-1 pb-2">Categoria del template</p>
                              <div className="space-y-0.5">
                                {categoryOptions.map((cat) => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => handleSetCategory(template.id, cat)}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-lg hover:bg-slate-50 transition-colors ${
                                      template.category === cat ? "text-indigo-700 font-medium" : "text-slate-700"
                                    }`}
                                  >
                                    {cat}
                                    {template.category === cat && <Check className="h-3.5 w-3.5" />}
                                  </button>
                                ))}
                              </div>
                              <form
                                className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const v = categoryDraft.trim();
                                  if (v) handleSetCategory(template.id, v);
                                }}
                              >
                                <Input
                                  value={categoryDraft}
                                  onChange={(e) => setCategoryDraft(e.target.value)}
                                  placeholder="Nuova categoria…"
                                  maxLength={60}
                                  className="h-8 text-sm"
                                />
                                <Button type="submit" size="sm" className="h-8 px-2.5" disabled={!categoryDraft.trim()}>
                                  Ok
                                </Button>
                              </form>
                              {template.category && (
                                <button
                                  type="button"
                                  onClick={() => handleSetCategory(template.id, null)}
                                  className="w-full mt-1.5 px-2 py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-left"
                                >
                                  Rimuovi categoria
                                </button>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>

                        <p className="text-[13px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {template.description || (
                            <span className="italic text-slate-400">Nessuna descrizione</span>
                          )}
                        </p>

                        <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {dateLabel}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 ${usage.totalContracts > 0 ? "text-slate-500 font-medium" : ""}`}
                            title="Contratti generati da questo template (attivi = non archiviati)"
                            data-testid={`text-usage-${template.id}`}
                          >
                            <BarChart3 className="h-3 w-3" />
                            {usage.totalContracts > 0
                              ? `${usage.totalContracts} ${usage.totalContracts === 1 ? "contratto" : "contratti"} · ${usage.activeContracts} attivi`
                              : "0 contratti"}
                          </span>
                          {lastContractLabel && (
                            <span className="inline-flex items-center gap-1" title="Data dell'ultimo contratto generato">
                              <Clock className="h-3 w-3" />
                              ultimo: {lastContractLabel}
                            </span>
                          )}
                          {sectionsCount > 0 && (
                            <span className="inline-flex items-center gap-1" title="Pacchetti / moduli opzionali">
                              <Layers className="h-3 w-3" />
                              {sectionsCount} moduli
                            </span>
                          )}
                          {bonusesCount > 0 && (
                            <span className="inline-flex items-center gap-1" title="Bonus predefiniti">
                              <Gift className="h-3 w-3" />
                              {bonusesCount} bonus
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex items-center gap-1 self-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                          title="Modifica"
                          aria-label={`Modifica ${template.name}`}
                          className="p-2 text-slate-400 hover:text-[#4F46E5] hover:bg-indigo-50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all duration-200"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleArchive(template); }}
                          disabled={updateTemplateMutation.isPending}
                          title={template.isActive ? "Archivia (disattiva)" : "Riattiva"}
                          aria-label={`${template.isActive ? "Archivia" : "Riattiva"} ${template.name}`}
                          data-testid={`button-archive-${template.id}`}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-all duration-200 disabled:opacity-50"
                        >
                          {template.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id, template.name); }}
                          disabled={deleteTemplateMutation.isPending}
                          title="Elimina"
                          aria-label={`Elimina ${template.name}`}
                          className="p-2 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-all duration-200 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all duration-200 ml-1" />
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTemplateEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}