import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { FileText, ArrowLeft, Building } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const loginSchema = insertUserSchema.pick({ username: true, password: true });

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
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

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

  if (user) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/seller"} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <style>{`
        @keyframes auth-gradient {
          0%, 100% { background-position: 0% 50%; }
          25% { background-position: 50% 0%; }
          50% { background-position: 100% 50%; }
          75% { background-position: 50% 100%; }
        }
        .auth-bg {
          background: linear-gradient(135deg, #f8f9fc 0%, #eef0f7 25%, #e8e4f3 50%, #f0ecf8 75%, #f5f3fa 100%);
          background-size: 400% 400%;
          animation: auth-gradient 20s ease infinite;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 25px 60px -12px rgba(79, 70, 229, 0.12), 0 0 0 1px rgba(79, 70, 229, 0.04);
        }
        .input-glow:focus {
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }
      `}</style>

      <div className="auth-bg absolute inset-0" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[15%] w-80 h-80 bg-violet-200/20 rounded-full blur-3xl" />
      </div>

      <Link href="/">
        <span className="fixed top-6 left-6 z-50 inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
          Torna alla home
        </span>
      </Link>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-card rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <FileText className="h-8 w-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Turbo Contract</h1>
            </div>
            <p className="text-gray-500 text-sm">
              Gestione contratti e firme digitali
            </p>
          </div>

          {/* Pill Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Accesso
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "register"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Registra Azienda
            </button>
          </div>

          {/* LOGIN TAB */}
          {activeTab === "login" && (
            <div>
              <h2 className="text-lg font-bold text-center text-gray-900 mb-6">Accedi al Sistema</h2>
              
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div>
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700">Username</Label>
                  <Input
                    id="username"
                    data-testid="input-username"
                    className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    data-testid="input-password"
                    className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                  data-testid="button-login"
                  disabled={loginMutation.isPending}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-indigo-200 transition-all"
                >
                  {loginMutation.isPending ? "Accesso in corso..." : "Accedi"}
                </Button>
              </form>
            </div>
          )}

          {/* REGISTER TAB */}
          {activeTab === "register" && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
                  <Building className="h-5 w-5" />
                  Registra Nuova Azienda
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Crea un account amministratore per la tua azienda
                </p>
              </div>
              
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reg-username" className="text-sm font-medium text-gray-700">Username</Label>
                    <Input
                      id="reg-username"
                      data-testid="input-reg-username"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                    <Label htmlFor="reg-password" className="text-sm font-medium text-gray-700">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      data-testid="input-reg-password"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reg-email" className="text-sm font-medium text-gray-700">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      data-testid="input-reg-email"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                    <Label htmlFor="reg-fullName" className="text-sm font-medium text-gray-700">Nome Completo</Label>
                    <Input
                      id="reg-fullName"
                      data-testid="input-reg-fullname"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                  <Label htmlFor="reg-companyName" className="text-sm font-medium text-gray-700">Nome Azienda</Label>
                  <Input
                    id="reg-companyName"
                    data-testid="input-reg-companyname"
                    className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                  <Label htmlFor="reg-address" className="text-sm font-medium text-gray-700">Indirizzo</Label>
                  <Input
                    id="reg-address"
                    data-testid="input-reg-address"
                    className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
                    {...registerForm.register("address")}
                    disabled={registerMutation.isPending}
                  />
                  {registerForm.formState.errors.address && (
                    <p className="text-sm text-red-600 mt-1">
                      {registerForm.formState.errors.address.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reg-city" className="text-sm font-medium text-gray-700">Città</Label>
                    <Input
                      id="reg-city"
                      data-testid="input-reg-city"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                    <Label htmlFor="reg-postalCode" className="text-sm font-medium text-gray-700">CAP</Label>
                    <Input
                      id="reg-postalCode"
                      data-testid="input-reg-postalcode"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reg-taxId" className="text-sm font-medium text-gray-700">Codice Fiscale</Label>
                    <Input
                      id="reg-taxId"
                      data-testid="input-reg-taxid"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                    <Label htmlFor="reg-vatId" className="text-sm font-medium text-gray-700">Partita IVA</Label>
                    <Input
                      id="reg-vatId"
                      data-testid="input-reg-vatid"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reg-uniqueCode" className="text-sm font-medium text-gray-700">Codice Univoco</Label>
                    <Input
                      id="reg-uniqueCode"
                      data-testid="input-reg-uniquecode"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                    <Label htmlFor="reg-pec" className="text-sm font-medium text-gray-700">Email PEC</Label>
                    <Input
                      id="reg-pec"
                      type="email"
                      data-testid="input-reg-pec"
                      className="h-12 rounded-xl border-gray-200 input-glow mt-1.5"
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
                  data-testid="button-register"
                  disabled={registerMutation.isPending}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-indigo-200 transition-all"
                >
                  {registerMutation.isPending ? "Registrazione in corso..." : "Registra Azienda"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}