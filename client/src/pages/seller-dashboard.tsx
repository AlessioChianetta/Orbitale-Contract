import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
  Bus,
  RefreshCw
} from "lucide-react";
import ContractForm from "@/components/contract-form";
import { Link } from "wouter";

export default function SellerDashboard() {
  const { user, logoutMutation } = useAuth();
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const { toast } = useToast();

  // Function to download PDF
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

  // Function to copy contract link
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
    const statusConfig = {
      draft: { label: "Bozza", variant: "secondary" as const },
      sent: { label: "Inviato", variant: "default" as const },
      viewed: { label: "Visualizzato", variant: "outline" as const },
      signed: { label: "Firmato", variant: "default" as const },
      expired: { label: "Scaduto", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className={
        status === "signed" ? "bg-green-100 text-green-800 hover:bg-green-100" :
        status === "viewed" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" : ""
      }>
        {config.label}
      </Badge>
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

  if (statsLoading || contractsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dashboard...</p>
        </div>
      </div>
    );
  }

  const signedThisMonth = contracts.filter((c: any) => {
    const signedDate = c.signedAt ? new Date(c.signedAt) : null;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    return signedDate && signedDate >= thisMonth && c.status === 'signed';
  }).length;

  const signatureRate = contracts.length > 0 
    ? Math.round((stats?.signedContracts / contracts.length) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-primary mr-3" />
                <h1 className="text-xl font-bold text-gray-900">Turbo Contract</h1>
                <Badge variant="secondary" className="ml-3">Venditore</Badge>
              </div>

              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    <Bus className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.fullName?.charAt(0) || "V"}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user?.fullName}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => logoutMutation.mutate()}
              >
                Esci
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center">
            <Bus className="mr-3" />
            Dashboard Venditore
          </h2>
          <p className="mt-2 text-gray-600">
            Crea e gestisci contratti per i tuoi clienti
          </p>
        </div>

        {/* Quick Actions & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Contratti Questo Mese</p>
                  <p className="text-2xl font-bold text-gray-900">{signedThisMonth}</p>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasso di Firma</p>
                  <p className="text-2xl font-bold text-gray-900">{signatureRate}%</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <Percent className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Button 
                onClick={() => setShowContractForm(true)}
                className="w-full h-full flex items-center justify-center bg-primary hover:bg-primary/90 text-white py-8"
              >
                <Plus className="h-6 w-6 mr-3" />
                <span className="text-lg font-medium">Nuovo Contratto</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2" />
              I Tuoi Contratti
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nessun contratto creato
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Inizia creando il tuo primo contratto per un cliente.
                </p>
                <div className="mt-6">
                  <Button onClick={() => setShowContractForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Contratto
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Codice</TableHead>
                      <TableHead>Valore</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract: any) => {
                      const clientData = contract.clientData || {};
                      const clientName = clientData.cliente_nome || clientData.nome || "Cliente";
                      const clientEmail = clientData.email || "";

                      return (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {clientName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {clientEmail}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 font-mono">
                            {contract.contractCode}
                          </TableCell>
                          <TableCell className="text-sm text-gray-900">
                            {contract.totalValue ? formatCurrency(contract.totalValue) : "-"}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(contract.status)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(contract.createdAt).toLocaleDateString('it-IT')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => window.open(`/client/${contract.contractCode}`, '_blank')}
                                title="Visualizza contratto"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {contract.status !== "signed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => editContract(contract)}
                                  title="Modifica contratto"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {contract.status === "signed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => regeneratePDF(contract.id)}
                                  disabled={regeneratingId === contract.id}
                                  title="Rigenera PDF"
                                >
                                  <RefreshCw className={`h-4 w-4 ${regeneratingId === contract.id ? 'animate-spin' : ''}`} />
                                </Button>
                              )}
                              {contract.status === "signed" && contract.pdfPath && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => downloadPDF(contract.id, contract.contractCode)}
                                  title="Scarica PDF"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {(contract.status === "sent" || contract.status === "viewed") && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => copyContractLink(contract.contractCode)}
                                  title="Copia link contratto"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contract Form Modal */}
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