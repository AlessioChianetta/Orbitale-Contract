import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, 
  Plus, 
  Trash2,
  ArrowLeft,
  UserPlus
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createUserSchema = z.object({
  username: z.string().min(3, "Username deve essere di almeno 3 caratteri"),
  email: z.string().email("Email non valida"),
  password: z.string().min(6, "Password deve essere di almeno 6 caratteri"),
  fullName: z.string().min(2, "Nome completo deve essere di almeno 2 caratteri"),
  role: z.enum(["admin", "seller"]).default("seller"),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function UserManagement() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      role: "seller",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      return await apiRequest("POST", "/api/admin/create-user", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utente creato con successo" });
      setShowCreateDialog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile creare l'utente",
        variant: "destructive" 
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utente eliminato con successo" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile eliminare l'utente",
        variant: "destructive" 
      });
    },
  });

  const handleDeleteUser = (userId: number, username: string) => {
    if (confirm(`Sei sicuro di voler eliminare l'utente "${username}"?`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const onSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento utenti...</p>
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
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="mr-3">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Users className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Gestione Utenti</h1>
              <Badge variant="secondary" className="ml-3">Admin</Badge>
            </div>

            <div className="flex items-center space-x-4">
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
                data-testid="button-logout"
              >
                Esci
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center">
              <Users className="mr-3" />
              Gestione Utenti Azienda
            </h2>
            <p className="mt-2 text-gray-600">
              Crea e gestisci gli utenti della tua azienda
            </p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center" data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Utente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <UserPlus className="h-5 w-5 mr-2" />
                  Crea Nuovo Utente
                </DialogTitle>
                <DialogDescription>
                  Crea un nuovo utente per la tua azienda. I dati saranno associati automaticamente alla tua organizzazione.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    {...form.register("fullName")}
                    placeholder="Es: Mario Rossi"
                    data-testid="input-fullname"
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.fullName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    {...form.register("username")}
                    placeholder="Es: mario.rossi"
                    data-testid="input-username"
                  />
                  {form.formState.errors.username && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="Es: mario.rossi@esempio.it"
                    data-testid="input-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    {...form.register("password")}
                    placeholder="Minimo 6 caratteri"
                    data-testid="input-password"
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="role">Ruolo</Label>
                  <Select
                    onValueChange={(value) => form.setValue("role", value as "admin" | "seller")}
                    defaultValue="seller"
                  >
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Venditore</SelectItem>
                      <SelectItem value="admin">Amministratore</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.role && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.role.message}
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateDialog(false)}
                    data-testid="button-cancel"
                  >
                    Annulla
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createUserMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createUserMutation.isPending ? "Creazione..." : "Crea Utente"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Utenti Azienda ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente</h3>
                <p className="text-gray-500">Crea il primo utente per la tua azienda</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Data Creazione</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userItem: any) => (
                    <TableRow key={userItem.id} data-testid={`row-user-${userItem.id}`}>
                      <TableCell className="font-medium" data-testid={`text-fullname-${userItem.id}`}>
                        {userItem.fullName}
                      </TableCell>
                      <TableCell data-testid={`text-username-${userItem.id}`}>
                        {userItem.username}
                      </TableCell>
                      <TableCell data-testid={`text-email-${userItem.id}`}>
                        {userItem.email}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={userItem.role === "admin" ? "default" : "secondary"}
                          data-testid={`badge-role-${userItem.id}`}
                        >
                          {userItem.role === "admin" ? "Amministratore" : "Venditore"}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-date-${userItem.id}`}>
                        {new Date(userItem.createdAt).toLocaleDateString('it-IT')}
                      </TableCell>
                      <TableCell className="text-right">
                        {userItem.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                            disabled={deleteUserMutation.isPending}
                            data-testid={`button-delete-${userItem.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}