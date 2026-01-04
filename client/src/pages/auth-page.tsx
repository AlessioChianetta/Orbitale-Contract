import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { File, Shield, Users, Zap, Building } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const loginSchema = insertUserSchema.pick({ username: true, password: true });

// Schema per registrazione admin (nuove aziende)
const registerAdminSchema = insertUserSchema
  .omit({ id: true, createdAt: true, companyId: true, role: true })
  .extend({ 
    companyName: z.string().min(2, "Nome azienda richiesto"),
    address: z.string().min(5, "Indirizzo richiesto"),
    city: z.string().min(2, "Città richiesta"),
    postalCode: z.string().min(5, "CAP richiesto"),
    taxId: z.string().min(11, "Codice fiscale richiesto"),
    vatId: z.string().min(11, "Partita IVA richiesta"),
    uniqueCode: z.string().min(7, "Codice univoco richiesto"),
    pec: z.string().email("Email PEC non valida")
  });

type LoginForm = z.infer<typeof loginSchema>;
type RegisterAdminForm = z.infer<typeof registerAdminSchema>;

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterAdminForm>({
    resolver: zodResolver(registerAdminSchema),
    defaultValues: { 
      username: "", 
      password: "", 
      email: "", 
      fullName: "",
      companyName: "",
      address: "",
      city: "",
      postalCode: "",
      taxId: "",
      vatId: "",
      uniqueCode: "",
      pec: ""
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterAdminForm) => {
      const res = await apiRequest("POST", "/api/register", data);
      return await res.json();
    },
    onSuccess: (response) => {
      toast({
        title: "Registrazione completata!",
        description: `Azienda "${response.company.companyName}" creata con successo. Ora puoi effettuare l'accesso.`,
      });
      registerForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore nella registrazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterAdminForm) => {
    registerMutation.mutate(data);
  };

  // Redirect if already logged in (after all hooks are called)
  if (user) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/seller"} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Column - Auth Forms */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <File className="h-12 w-12 text-primary mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">Turbo Contract</h1>
            </div>
            <p className="text-gray-600">
              Sistema avanzato per la gestione di contratti e firme elettroniche
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Accesso</TabsTrigger>
                  <TabsTrigger value="register">Registra Azienda</TabsTrigger>
                </TabsList>

                <div className="p-6">
                  {/* LOGIN TAB */}
                  <TabsContent value="login" className="space-y-4">
                    <CardHeader className="px-0">
                      <CardTitle className="text-center">Accedi al Sistema</CardTitle>
                    </CardHeader>
                    
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          data-testid="input-username"
                          {...loginForm.register("username")}
                          disabled={loginMutation.isPending}
                        />
                        {loginForm.formState.errors.username && (
                          <p className="text-sm text-red-600 mt-1">
                            {loginForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          data-testid="input-password"
                          {...loginForm.register("password")}
                          disabled={loginMutation.isPending}
                        />
                        {loginForm.formState.errors.password && (
                          <p className="text-sm text-red-600 mt-1">
                            {loginForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        data-testid="button-login"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Accesso in corso..." : "Accedi"}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* REGISTER TAB */}
                  <TabsContent value="register" className="space-y-4">
                    <CardHeader className="px-0">
                      <CardTitle className="text-center flex items-center justify-center gap-2">
                        <Building className="h-5 w-5" />
                        Registra Nuova Azienda
                      </CardTitle>
                      <p className="text-sm text-gray-600 text-center">
                        Crea un account amministratore per la tua azienda
                      </p>
                    </CardHeader>
                    
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="reg-username">Username</Label>
                          <Input
                            id="reg-username"
                            data-testid="input-reg-username"
                            {...registerForm.register("username")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.username && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.username.message}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="reg-password">Password</Label>
                          <Input
                            id="reg-password"
                            type="password"
                            data-testid="input-reg-password"
                            {...registerForm.register("password")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.password && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.password.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="reg-email">Email</Label>
                          <Input
                            id="reg-email"
                            type="email"
                            data-testid="input-reg-email"
                            {...registerForm.register("email")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.email && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.email.message}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="reg-fullName">Nome Completo</Label>
                          <Input
                            id="reg-fullName"
                            data-testid="input-reg-fullname"
                            {...registerForm.register("fullName")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.fullName && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.fullName.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="reg-companyName">Nome Azienda</Label>
                        <Input
                          id="reg-companyName"
                          data-testid="input-reg-companyname"
                          {...registerForm.register("companyName")}
                          disabled={registerMutation.isPending}
                        />
                        {registerForm.formState.errors.companyName && (
                          <p className="text-sm text-red-600 mt-1">
                            {registerForm.formState.errors.companyName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="reg-address">Indirizzo</Label>
                        <Input
                          id="reg-address"
                          data-testid="input-reg-address"
                          {...registerForm.register("address")}
                          disabled={registerMutation.isPending}
                        />
                        {registerForm.formState.errors.address && (
                          <p className="text-sm text-red-600 mt-1">
                            {registerForm.formState.errors.address.message}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="reg-city">Città</Label>
                          <Input
                            id="reg-city"
                            data-testid="input-reg-city"
                            {...registerForm.register("city")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.city && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.city.message}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="reg-postalCode">CAP</Label>
                          <Input
                            id="reg-postalCode"
                            data-testid="input-reg-postalcode"
                            {...registerForm.register("postalCode")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.postalCode && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.postalCode.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="reg-taxId">Codice Fiscale</Label>
                          <Input
                            id="reg-taxId"
                            data-testid="input-reg-taxid"
                            {...registerForm.register("taxId")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.taxId && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.taxId.message}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="reg-vatId">Partita IVA</Label>
                          <Input
                            id="reg-vatId"
                            data-testid="input-reg-vatid"
                            {...registerForm.register("vatId")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.vatId && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.vatId.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="reg-uniqueCode">Codice Univoco</Label>
                          <Input
                            id="reg-uniqueCode"
                            data-testid="input-reg-uniquecode"
                            {...registerForm.register("uniqueCode")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.uniqueCode && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.uniqueCode.message}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="reg-pec">Email PEC</Label>
                          <Input
                            id="reg-pec"
                            type="email"
                            data-testid="input-reg-pec"
                            {...registerForm.register("pec")}
                            disabled={registerMutation.isPending}
                          />
                          {registerForm.formState.errors.pec && (
                            <p className="text-sm text-red-600 mt-1">
                              {registerForm.formState.errors.pec.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        data-testid="button-register"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Registrazione in corso..." : "Registra Azienda"}
                      </Button>
                    </form>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Column - Hero Section */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-4xl font-bold mb-6">
            Contratti Digitali del Futuro
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Gestisci template, genera contratti dinamici e raccogli firme elettroniche 
            legalmente valide con un unico sistema integrato.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-full">
                <Zap className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Generazione Rapida</h3>
                <p className="text-sm opacity-75">Template avanzati con sezioni dinamiche</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-full">
                <Shield className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Sicurezza Garantita</h3>
                <p className="text-sm opacity-75">Crittografia avanzata e compliance GDPR</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-full">
                <Users className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Collaborazione Team</h3>
                <p className="text-sm opacity-75">Gestione utenti e permessi granulari</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
