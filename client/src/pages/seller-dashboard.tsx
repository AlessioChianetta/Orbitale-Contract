import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  FileText,
  TrendingUp,
  Users,
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
  LogOut,
  Shield
} from "lucide-react";
import ContractForm from "@/components/contract-form";
import { Link } from "wouter";

export default function SellerDashboard() {
  const { user, logoutMutation } = useAuth();
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "value">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const downloadPDF = async (contractId: number, contractCode: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/pdf`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contratto-${contractCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF scaricato",
        description: "Il file PDF è stato scaricato con successo"
      });
    } catch (error) {
      toast({
        title: "Errore download",
        description: "Impossibile scaricare il PDF",
        variant: "destructive"
      });
    }
  };

  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const regeneratePDF = async (contractId: number) => {
    setRegeneratingId(contractId);
    try {
      const response = await fetch(`/api/contracts/${contractId}/regenerate-pdf`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to regenerate PDF');
      }

      toast({
        title: "PDF rigenerato",
        description: "Il PDF è stato rigenerato con successo. Puoi scaricarlo ora."
      });

      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    } catch (error: any) {
      toast({
        title: "Errore rigenerazione",
        description: error.message || "Impossibile rigenerare il PDF",
        variant: "destructive"
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  const copyContractLink = (contractCode: string) => {
    const link = `${window.location.origin}/client/${contractCode}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({
        title: "Link copiato",
        description: "Il link del contratto è stato copiato negli appunti"
      });
    }).catch(() => {
      toast({
        title: "Errore",
        description: "Impossibile copiare il link",
        variant: "destructive"
      });
    });
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ["/api/contracts"],
  });

  const getStatusBadge = (status: string) => {
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

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency', 
      currency: 'EUR'
    }).format(cents / 100);
  };

  const editContract = (contract: any) => {
    setEditingContract(contract);
    setShowContractForm(true);
  };

  const signedThisMonth = useMemo(() => contracts.filter((c: any) => {
    const signedDate = c.signedAt ? new Date(c.signedAt) : null;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    return signedDate && signedDate >= thisMonth && c.status === 'signed';
  }).length, [contracts]);

  const signatureRate = contracts.length > 0 
    ? Math.round((stats?.signedContracts / contracts.length) * 100) 
    : 0;

  const pendingContracts = useMemo(() => contracts.filter((c: any) => c.status === 'sent' || c.status === 'viewed').length, [contracts]);

  const filteredContracts = useMemo(() => {
    let result = [...contracts];

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
      result = result.filter((c: any) => c.status === statusFilter);
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
  }, [contracts, searchQuery, statusFilter, sortBy, sortOrder]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/20 backdrop-blur-sm" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
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

              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200">
                    <Shield className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
                    Admin
                  </Button>
                </Link>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowContractForm(true)}
                className="text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Plus className="h-5 w-5 mr-2" strokeWidth={1.5} />
                Nuovo Contratto
              </Button>

              <div className="flex items-center space-x-2 ml-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm bg-white/90 shadow-sm">
                  {user?.fullName?.charAt(0) || "V"}
                </div>
                <span className="text-sm font-medium text-white/90 hidden sm:inline">
                  {user?.fullName}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => logoutMutation.mutate()}
                className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Contratti Questo Mese</p>
                <p className="text-4xl font-bold text-slate-900">{signedThisMonth}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-indigo-600" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Tasso di Firma</p>
                <p className="text-4xl font-bold text-slate-900">{signatureRate}%</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <Percent className="h-6 w-6 text-emerald-600" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Contratti in Attesa</p>
                <p className="text-4xl font-bold text-slate-900">{pendingContracts}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200">
          <div className="p-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Cerca per nome o email cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white transition-all duration-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="appearance-none pl-9 pr-8 py-3 rounded-xl border border-gray-200 text-sm text-slate-700 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all duration-200 cursor-pointer"
                  >
                    <option value="all">Tutti</option>
                    <option value="sent">Inviato</option>
                    <option value="viewed">Visualizzato</option>
                    <option value="signed">Firmato</option>
                    <option value="draft">Bozza</option>
                    <option value="expired">Scaduto</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                </div>

                <button
                  onClick={() => {
                    if (sortBy === "date") {
                      setSortBy("value");
                    } else {
                      setSortBy("date");
                    }
                    setSortOrder(prev => prev === "desc" ? "asc" : "desc");
                  }}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm text-slate-700 bg-gray-50/50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                >
                  <ArrowUpDown className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <span>{sortBy === "date" ? "Data" : "Valore"}</span>
                </button>
              </div>
            </div>
          </div>

          {filteredContracts.length === 0 && contracts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-indigo-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                Nessun contratto creato
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                Inizia creando il tuo primo contratto per un cliente. È semplice e veloce.
              </p>
              <Button
                onClick={() => setShowContractForm(true)}
                className="rounded-xl px-6 py-2.5 font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
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
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                Nessun risultato
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Nessun contratto corrisponde ai filtri selezionati. Prova a modificare la ricerca.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              <div className="hidden sm:grid sm:grid-cols-[1fr_120px_110px_100px_80px] items-center px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <span>Cliente</span>
                <span className="text-right">Valore</span>
                <span className="text-center">Stato</span>
                <span className="text-right">Data</span>
                <span></span>
              </div>
              {filteredContracts.map((contract: any) => {
                const clientData = contract.clientData || {};
                const clientName = clientData.cliente_nome || clientData.nome || "Cliente";
                const clientEmail = clientData.email || "";
                const isUnsigned = contract.status === "sent" || contract.status === "viewed";

                return (
                  <div
                    key={contract.id}
                    className={`group grid grid-cols-1 sm:grid-cols-[1fr_120px_110px_100px_80px] items-center py-3.5 px-5 hover:bg-gray-50/60 transition-all duration-150 ${isUnsigned ? 'bg-amber-50/20' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate text-[15px] leading-tight">{clientName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {clientEmail && (
                          <p className="text-xs text-slate-400 truncate">{clientEmail}</p>
                        )}
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
                      {getStatusBadge(contract.status)}
                    </div>

                    <div className="hidden sm:block text-right">
                      <span className="text-xs text-slate-400">
                        {new Date(contract.createdAt).toLocaleDateString('it-IT')}
                      </span>
                    </div>

                    <div className="flex items-center justify-end space-x-0.5">
                      <button
                        onClick={() => window.open(`/client/${contract.contractCode}`, '_blank')}
                        title="Visualizza contratto"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-150"
                      >
                        <Eye className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      {contract.status !== "signed" && (
                        <button
                          onClick={() => editContract(contract)}
                          title="Modifica contratto"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-150"
                        >
                          <Edit className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      )}
                      {contract.status === "signed" && (
                        <button
                          onClick={() => regeneratePDF(contract.id)}
                          disabled={regeneratingId === contract.id}
                          title="Rigenera PDF"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-150 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${regeneratingId === contract.id ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                        </button>
                      )}
                      {contract.status === "signed" && contract.pdfPath && (
                        <button
                          onClick={() => downloadPDF(contract.id, contract.contractCode)}
                          title="Scarica PDF"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-150"
                        >
                          <Download className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      )}
                      {(contract.status === "sent" || contract.status === "viewed") && (
                        <button
                          onClick={() => copyContractLink(contract.contractCode)}
                          title="Copia link contratto"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-150"
                        >
                          <Copy className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
    </div>
  );
}