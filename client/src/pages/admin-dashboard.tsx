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
  Building2
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

  // Redirect non-admin users
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

  if (statsLoading || templatesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <File className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Turbo Contract</h1>
              <Badge variant="secondary" className="ml-3">Admin</Badge>
            </div>

            <div className="flex items-center space-x-4">
              <Link href="/user-management">
                <Button variant="ghost" size="sm" className="flex items-center" data-testid="link-user-management">
                  <Users className="h-4 w-4 mr-2" />
                  Gestione Utenti
                </Button>
              </Link>
              <Link href="/company-settings">
                <Button variant="ghost" size="sm" className="flex items-center" data-testid="link-company-settings">
                  <Building2 className="h-4 w-4 mr-2" />
                  Impostazioni
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.fullName?.charAt(0) || "A"}
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
            <Settings className="mr-3" />
            Dashboard Amministratore
          </h2>
          <p className="mt-2 text-gray-600">
            Gestisci template di contratti e configurazioni sistema
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <File className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Template Attivi</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.activeTemplates || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Contratti Firmati</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.signedContracts || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">In Attesa</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.pendingContracts || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Totale Contratti</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.totalContracts || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center">
              <File className="mr-2" />
              Gestione Template
            </CardTitle>
            <div className="flex space-x-2">
            <Button onClick={() => setShowTemplateEditor(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Template
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/company-settings"}
            >
              <Settings className="h-4 w-4 mr-2" />
              Impostazioni Azienda
            </Button>
          </div>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <File className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nessun template disponibile
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Inizia creando il tuo primo template di contratto.
                </p>
                <div className="mt-6">
                  <Button onClick={() => setShowTemplateEditor(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Template
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome Template</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Creato</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template: any) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <File className="h-4 w-4 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {template.name}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {template.description || "Nessuna descrizione"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(template.createdAt).toLocaleDateString('it-IT')}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={template.isActive ? "default" : "secondary"}
                          >
                            {template.isActive ? "Attivo" : "Inattivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template.id, template.name)}
                              disabled={deleteTemplateMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}