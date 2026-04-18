import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getRequiredClientFields, getClientType, getMissingClientFields } from "@/lib/required-client-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  TrendingUp,
  Clock,
  Percent,
  Plus,
  Eye,
  Download,
  Copy,
  Edit,
  LayoutDashboard,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Files,
  Sparkles,
  Trash2,
  Wifi,
} from "lucide-react";
import ContractForm from "@/components/contract-form";
import EmailConfigBanner from "@/components/email-config-banner";
import { Link } from "wouter";

const PAGE_SIZE = 10;

export default function SellerDashboard() {
  const { user, logoutMutation } = useAuth();
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "value">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [regenContract, setRegenContract] = useState<any>(null);
  const [regenReason, setRegenReason] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const downloadPDF = async (contractId: number, contractCode: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/pdf`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to download PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contratto-${contractCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "PDF scaricato", description: "Il file PDF è stato scaricato con successo" });
    } catch {
      toast({ title: "Errore download", description: "Impossibile scaricare il PDF", variant: "destructive" });
    }
  };

  const regeneratePDF = async (contractId: number) => {
    setBusyId(contractId);
    try {
      const response = await fetch(`/api/contracts/${contractId}/regenerate-pdf`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to regenerate PDF");
      }
      toast({ title: "PDF rigenerato", description: "Il PDF è stato rigenerato con successo." });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    } catch (error: any) {
      toast({ title: "Errore rigenerazione", description: error.message || "Impossibile rigenerare il PDF", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const copyContractLink = (contractCode: string) => {
    const link = `${window.location.origin}/client/${contractCode}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Link copiato", description: "Il link del contratto è stato copiato negli appunti" });
    }).catch(() => {
      toast({ title: "Errore", description: "Impossibile copiare il link", variant: "destructive" });
    });
  };

  const archiveContract = async (contractId: number, archive: boolean) => {
    setBusyId(contractId);
    try {
      const res = await apiRequest("POST", `/api/contracts/${contractId}/${archive ? "archive" : "unarchive"}`);
      if (!res.ok) throw new Error("Errore");
      toast({ title: archive ? "Contratto archiviato" : "Contratto ripristinato" });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    } catch {
      toast({ title: "Errore", description: "Operazione fallita", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const duplicateContract = async (contractId: number) => {
    setBusyId(contractId);
    try {
      const res = await apiRequest("POST", `/api/contracts/${contractId}/duplicate`);
      if (!res.ok) throw new Error("Errore");
      toast({ title: "Contratto duplicato", description: "Creata una nuova bozza con gli stessi dati" });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    } catch {
      toast({ title: "Errore", description: "Duplicazione fallita", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const bulkArchive = async (archive: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await apiRequest("POST", "/api/contracts/bulk-archive", { ids, archive });
      const data = await res.json();
      toast({ title: data.message || "Operazione completata" });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    } catch {
      toast({ title: "Errore", description: "Operazione bulk fallita", variant: "destructive" });
    }
  };

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await apiRequest("POST", "/api/contracts/bulk-delete", { ids });
      const data = await res.json();
      toast({ title: data.message || "Eliminati definitivamente" });
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    } catch {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  const runRegenerateContent = async () => {
    if (!regenContract) return;
    setRegenLoading(true);
    try {
      const res = await apiRequest("POST", `/api/contracts/${regenContract.id}/regenerate-content`, {
        reason: regenReason || undefined,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Errore");
      }
      toast({
        title: "Contenuto rigenerato",
        description: "Il contratto è stato rigenerato dal template corrente. Firme e data di firma preservate.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setRegenContract(null);
      setRegenReason("");
    } catch (error: any) {
      toast({ title: "Errore", description: error.message || "Impossibile rigenerare", variant: "destructive" });
    } finally {
      setRegenLoading(false);
    }
  };

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/stats"],
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts", { includeArchived: showArchived }],
    queryFn: async () => {
      const res = await fetch(`/api/contracts?includeArchived=${showArchived}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load contracts");
      return res.json();
    },
  });

  const getStatusBadge = (status: string, isArchived?: boolean) => {
    if (isArchived) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase bg-gray-100 text-gray-500">
          Archiviato
        </span>
      );
    }
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: "Bozza", className: "bg-gray-50 text-gray-500" },
      sent: { label: "Inviato", className: "bg-slate-100 text-slate-600" },
      viewed: { label: "Visualizzato", className: "bg-orange-50 text-orange-600" },
      signed: { label: "Firmato", className: "bg-emerald-50 text-emerald-600" },
      expired: { label: "Scaduto", className: "bg-red-50 text-red-500" },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

  const editContract = (contract: any) => {
    setEditingContract(contract);
    setShowContractForm(true);
  };

  const signedThisMonth = useMemo(
    () =>
      contracts.filter((c: any) => {
        const signedDate = c.signedAt ? new Date(c.signedAt) : null;
        const thisMonth = new Date();
        thisMonth.setDate(1);
        return signedDate && signedDate >= thisMonth && c.status === "signed" && !c.isArchived;
      }).length,
    [contracts]
  );

  const visibleContracts = useMemo(
    () => contracts.filter((c: any) => (showArchived ? true : !c.isArchived)),
    [contracts, showArchived]
  );

  const signatureRate =
    visibleContracts.length > 0 && stats?.signedContracts !== undefined
      ? Math.round((stats.signedContracts / Math.max(visibleContracts.filter((c: any) => !c.isArchived).length, 1)) * 100)
      : 0;

  const pendingContracts = useMemo(
    () => visibleContracts.filter((c: any) => !c.isArchived && (c.status === "sent" || c.status === "viewed")).length,
    [visibleContracts]
  );

  const filteredContracts = useMemo(() => {
    let result = [...visibleContracts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) => {
        const clientData = c.clientData || {};
        const clientName = (clientData.cliente_nome || clientData.nome || "").toLowerCase();
        const clientEmail = (clientData.email || "").toLowerCase();
        return clientName.includes(q) || clientEmail.includes(q);
      });
    }
    if (statusFilter !== "all") {
      if (statusFilter === "archived") {
        result = result.filter((c: any) => c.isArchived);
      } else {
        result = result.filter((c: any) => c.status === statusFilter);
      }
    }
    result.sort((a: any, b: any) => {
      if (sortBy === "date") {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      } else {
        const valA = a.totalValue || 0;
        const valB = b.totalValue || 0;
        return sortOrder === "desc" ? valB - valA : valA - valB;
      }
    });
    return result;
  }, [visibleContracts, searchQuery, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedContracts = useMemo(
    () => filteredContracts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredContracts, currentPage]
  );

  const allOnPageSelected =
    pagedContracts.length > 0 && pagedContracts.every((c: any) => selectedIds.has(c.id));
  const togglePageSelection = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) {
      pagedContracts.forEach((c: any) => next.delete(c.id));
    } else {
      pagedContracts.forEach((c: any) => next.add(c.id));
    }
    setSelectedIds(next);
  };
  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  if (statsLoading || contractsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-500">Caricamento dashboard...</p>
        </div>
      </div>
    );
  }

  const selectedCount = selectedIds.size;
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/20 backdrop-blur-sm" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <LayoutDashboard className="h-7 w-7 text-white/90 mr-2.5" strokeWidth={1.5} />
                <div>
                  <h1 className="text-lg font-bold text-white leading-tight">Dashboard</h1>
                  <p className="text-xs text-white/70 leading-tight">Performance e gestione contratti</p>
                </div>
              </div>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Shield className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
                    Admin
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowContractForm(true)}
                className="text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl"
                style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <Plus className="h-5 w-5 mr-2" strokeWidth={1.5} />
                Nuovo Contratto
              </Button>
              <div className="flex items-center space-x-2 ml-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm bg-white/90 shadow-sm">
                  {user?.fullName?.charAt(0) || "V"}
                </div>
                <span className="text-sm font-medium text-white/90 hidden sm:inline">{user?.fullName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <EmailConfigBanner className="mb-4" />
        {/* Compact KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Contratti Totali" value={stats?.totalContracts ?? 0} icon={<FileText className="h-4 w-4 text-indigo-600" />} tint="bg-indigo-50" />
          <KpiCard label="Firmati Questo Mese" value={signedThisMonth} icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} tint="bg-emerald-50" />
          <KpiCard label="Tasso di Firma" value={`${signatureRate}%`} icon={<Percent className="h-4 w-4 text-violet-600" />} tint="bg-violet-50" />
          <KpiCard label="In Attesa" value={pendingContracts} icon={<Clock className="h-4 w-4 text-amber-600" />} tint="bg-amber-50" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Cerca per nome o email cliente..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-700 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="all">Tutti</option>
                    <option value="draft">Bozza</option>
                    <option value="sent">Inviato</option>
                    <option value="viewed">Visualizzato</option>
                    <option value="signed">Firmato</option>
                    <option value="expired">Scaduto</option>
                    {showArchived && <option value="archived">Archiviati</option>}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                </div>

                <button
                  onClick={() => {
                    if (sortBy === "date") setSortBy("value");
                    else setSortBy("date");
                    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-700 bg-gray-50/50 hover:bg-gray-100"
                >
                  <ArrowUpDown className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <span>{sortBy === "date" ? "Data" : "Valore"}</span>
                </button>

                <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-700 bg-gray-50/50 cursor-pointer hover:bg-gray-100">
                  <Checkbox
                    checked={showArchived}
                    onCheckedChange={(v) => { setShowArchived(!!v); setPage(1); }}
                  />
                  <span>Mostra archiviati</span>
                </label>
              </div>
            </div>

            {selectedCount > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-2.5">
                <span className="text-sm text-indigo-800 font-medium">
                  {selectedCount} contratti selezionati
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => bulkArchive(true)}>
                    <Archive className="h-4 w-4 mr-1.5" /> Archivia
                  </Button>
                  {showArchived && (
                    <Button size="sm" variant="outline" onClick={() => bulkArchive(false)}>
                      <ArchiveRestore className="h-4 w-4 mr-1.5" /> Ripristina
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmBulkDelete(true)}>
                      <Trash2 className="h-4 w-4 mr-1.5" /> Elimina
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}
          </div>

          {filteredContracts.length === 0 && contracts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-indigo-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Nessun contratto creato</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                Inizia creando il tuo primo contratto per un cliente.
              </p>
              <Button
                onClick={() => setShowContractForm(true)}
                className="rounded-xl px-6 py-2.5 font-semibold shadow-md"
                style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
              >
                <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Crea Contratto
              </Button>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Nessun risultato</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Nessun contratto corrisponde ai filtri selezionati.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                <div className="hidden sm:grid sm:grid-cols-[40px_1fr_120px_110px_100px_60px] items-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  <span>
                    <Checkbox checked={allOnPageSelected} onCheckedChange={togglePageSelection} />
                  </span>
                  <span>Cliente</span>
                  <span className="text-right">Valore</span>
                  <span className="text-center">Stato</span>
                  <span className="text-right">Data</span>
                  <span></span>
                </div>
                {pagedContracts.map((contract: any) => {
                  const clientData = contract.clientData || {};
                  const clientName = clientData.cliente_nome || clientData.nome || "Cliente";
                  const clientEmail = clientData.email || "";
                  const isUnsigned = contract.status === "sent" || contract.status === "viewed";
                  const isSelected = selectedIds.has(contract.id);

                  return (
                    <div
                      key={contract.id}
                      className={`group grid grid-cols-1 sm:grid-cols-[40px_1fr_120px_110px_100px_60px] items-center py-3 px-4 hover:bg-gray-50/60 transition-colors ${
                        contract.isArchived ? "opacity-70" : ""
                      } ${isUnsigned && !contract.isArchived ? "bg-amber-50/20" : ""} ${isSelected ? "bg-indigo-50/50" : ""}`}
                    >
                      <div>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(contract.id)} />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate text-[15px] leading-tight">{clientName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {clientEmail && <p className="text-xs text-slate-400 truncate">{clientEmail}</p>}
                          <span className="hidden md:inline font-mono text-[10px] text-gray-300 truncate" title={contract.contractCode}>
                            {contract.contractCode?.slice(0, 8)}…
                          </span>
                        </div>
                      </div>

                      <div className="hidden sm:block text-right">
                        <span className="text-sm font-bold text-slate-700">
                          {contract.totalValue ? formatCurrency(contract.totalValue) : "—"}
                        </span>
                      </div>

                      <div className="hidden sm:flex justify-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(contract.status, contract.isArchived)}
                          {contract.coFillToken && contract.status === "draft" && !contract.isArchived && (() => {
                            const cd = (contract.clientData || {}) as Record<string, unknown>;
                            const totalRequired = getRequiredClientFields(getClientType(cd as Record<string, any>)).length;
                            const missing = getMissingClientFields(cd as Record<string, any>).length;
                            const filled = totalRequired - missing;
                            let label = "In attesa cliente";
                            let cls = "bg-amber-50 text-amber-700 border-amber-100";
                            let title = "Link co-fill generato, in attesa che il cliente compili";
                            if (missing === 0) {
                              label = "Pronto da inviare";
                              cls = "bg-emerald-50 text-emerald-700 border-emerald-100";
                              title = "Tutti i dati cliente sono compilati: puoi rivedere e inviare";
                            } else if (filled > 0) {
                              label = "Cliente sta compilando";
                              cls = "bg-indigo-50 text-indigo-700 border-indigo-100";
                              title = `Compilati ${filled} su ${totalRequired} campi richiesti`;
                            }
                            return (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${cls}`}
                                title={title}
                                data-testid={`badge-cofill-${contract.id}`}
                              >
                                <Wifi className="h-3 w-3" />
                                {label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="hidden sm:block text-right">
                        <span className="text-xs text-slate-400">
                          {new Date(contract.createdAt).toLocaleDateString("it-IT")}
                        </span>
                      </div>

                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                              disabled={busyId === contract.id}
                            >
                              <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => window.open(`/client/${contract.contractCode}`, "_blank")}>
                              <Eye className="h-4 w-4 mr-2" /> Visualizza
                            </DropdownMenuItem>
                            {contract.status !== "signed" && !contract.isArchived && (
                              <DropdownMenuItem onClick={() => editContract(contract)}>
                                <Edit className="h-4 w-4 mr-2" /> Modifica
                              </DropdownMenuItem>
                            )}
                            {(contract.status === "sent" || contract.status === "viewed") && (
                              <DropdownMenuItem onClick={() => copyContractLink(contract.contractCode)}>
                                <Copy className="h-4 w-4 mr-2" /> Copia link
                              </DropdownMenuItem>
                            )}
                            {contract.status === "signed" && contract.pdfPath && (
                              <DropdownMenuItem onClick={() => downloadPDF(contract.id, contract.contractCode)}>
                                <Download className="h-4 w-4 mr-2" /> Scarica PDF
                              </DropdownMenuItem>
                            )}
                            {contract.status === "signed" && (
                              <DropdownMenuItem onClick={() => regeneratePDF(contract.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" /> Rigenera PDF
                              </DropdownMenuItem>
                            )}
                            {isAdmin && contract.status === "signed" && (
                              <DropdownMenuItem onClick={() => { setRegenContract(contract); setRegenReason(""); }}>
                                <Sparkles className="h-4 w-4 mr-2" /> Rigenera contenuto
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => duplicateContract(contract.id)}>
                              <Files className="h-4 w-4 mr-2" /> Duplica
                            </DropdownMenuItem>
                            {contract.isArchived ? (
                              <DropdownMenuItem onClick={() => archiveContract(contract.id, false)}>
                                <ArchiveRestore className="h-4 w-4 mr-2" /> Ripristina
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => archiveContract(contract.id, true)}>
                                <Archive className="h-4 w-4 mr-2" /> Archivia
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-slate-500">
                    Pagina {currentPage} di {totalPages} — {filteredContracts.length} contratti
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showContractForm && (
        <ContractForm
          onClose={() => {
            setShowContractForm(false);
            setEditingContract(null);
          }}
          contract={editingContract}
        />
      )}

      <AlertDialog open={!!regenContract} onOpenChange={(open) => { if (!open) { setRegenContract(null); setRegenReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rigenera contenuto contratto</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  Il contenuto del contratto verrà rigenerato dal <strong>template corrente</strong> usando i dati del cliente e i valori già salvati.
                </p>
                {regenContract?.status === "signed" && (
                  <p className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-900">
                    <strong>Attenzione:</strong> questo contratto è già firmato. Le firme e la data di firma saranno preservate; il PDF verrà rigenerato con una nota di rigenerazione. Tutta l'operazione è tracciata nell'audit log.
                  </p>
                )}
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Motivo (opzionale)</span>
                  <textarea
                    value={regenReason}
                    onChange={(e) => setRegenReason(e.target.value)}
                    placeholder="Es. Aggiornamento contenuti template dopo correzione"
                    className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    rows={3}
                  />
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={runRegenerateContent} disabled={regenLoading}>
              {regenLoading ? "Rigenerazione..." : "Rigenera"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare definitivamente {selectedIds.size} contratti, inclusi i relativi log di audit e codici OTP. L'operazione è <strong>irreversibile</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-red-600 hover:bg-red-700">
              Elimina definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      </div>
      <div className={`w-9 h-9 rounded-full ${tint} flex items-center justify-center shrink-0`}>{icon}</div>
    </div>
  );
}
