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
  FileText
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TemplateEditor from "@/components/template-editor";
import { Redirect, Link } from "wouter";

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");

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

  const filteredTemplates = (templates as any[])
    .filter((t: any) => {
      const matchesSearch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && t.isActive) || 
        (statusFilter === "inactive" && !t.isActive);
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
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
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none pl-10 pr-8 py-2.5 text-sm bg-white border border-black/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]/30 transition-all duration-200 cursor-pointer text-slate-600"
                >
                  <option value="name">Ordina per nome</option>
                  <option value="date">Ordina per data</option>
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
              <div>
                <div className="grid grid-cols-[1fr_1.5fr_120px_100px_80px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                  <span>Nome</span>
                  <span>Descrizione</span>
                  <span>Creato</span>
                  <span>Stato</span>
                  <span className="text-right">Azioni</span>
                </div>
                <div>
                  {filteredTemplates.map((template: any) => (
                    <div
                      key={template.id}
                      className="group grid grid-cols-[1fr_1.5fr_120px_100px_80px] gap-4 items-center px-4 py-[18px] border-b border-black/[0.04] last:border-b-0 hover:bg-black/[0.02] transition-all duration-200 cursor-pointer rounded-xl"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <File className="h-4 w-4 text-slate-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {template.name}
                        </span>
                      </div>
                      <span className="text-sm text-slate-500 truncate">
                        {template.description || "Nessuna descrizione"}
                      </span>
                      <span className="text-sm text-slate-500">
                        {new Date(template.createdAt).toLocaleDateString('it-IT')}
                      </span>
                      <div>
                        {template.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">
                            Attivo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
                            Inattivo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                          className="p-1.5 text-slate-400 hover:text-[#4F46E5] hover:bg-[#4F46E5]/5 rounded-lg transition-all duration-200"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id, template.name); }}
                          disabled={deleteTemplateMutation.isPending}
                          className="p-1.5 text-slate-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-all duration-200 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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