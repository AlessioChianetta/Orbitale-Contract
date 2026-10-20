import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import { ImpersonationBanner } from "@/components/impersonation";
import { lazy, Suspense, type ComponentType } from "react";

/**
 * Ogni pagina è un file JavaScript a parte, scaricato solo quando serve: il
 * cliente che apre il link di firma non scarica dashboard, editor e
 * impostazioni. Se un file non si trova più (pagina aperta prima di un
 * aggiornamento del sito) si ricarica la pagina una volta sola.
 */
function page<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((err) => {
      const key = "tc-chunk-reload";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

const AuthPage = page(() => import("@/pages/auth-page"));
const LandingPage = page(() => import("@/pages/landing-page"));
const AdminDashboard = page(() => import("@/pages/admin-dashboard"));
const AdminPresetsPage = page(() => import("@/pages/admin-presets"));
const SellerDashboard = page(() => import("@/pages/seller-dashboard"));
const ClientView = page(() => import("@/pages/client-view"));
const CompanySettings = page(() => import("./pages/company-settings"));
const UserManagement = page(() => import("./pages/user-management"));
const ContractView = page(() => import("./pages/contract-view"));
const CoFillPage = page(() => import("@/pages/co-fill-page"));
const ChangePasswordPage = page(() => import("@/pages/change-password"));
const ForgotPasswordPage = page(() => import("@/pages/forgot-password"));
const ResetPasswordPage = page(() => import("@/pages/reset-password"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-border" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/" component={LandingPage} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <ProtectedRoute path="/admin/presets" component={AdminPresetsPage} />
      <ProtectedRoute path="/presets" component={AdminPresetsPage} />
      <ProtectedRoute path="/seller" component={SellerDashboard} />
      <ProtectedRoute path="/company-settings" component={CompanySettings} />
      <ProtectedRoute path="/user-management" component={UserManagement} />
      <Route path="/contratto" component={ContractView} />
      <Route path="/client/:code" component={ClientView} />
      <Route path="/co-fill/:token" component={CoFillPage} />
      <ProtectedRoute path="/cambia-password" component={ChangePasswordPage} />
      <Route path="/password-dimenticata" component={ForgotPasswordPage} />
      <Route path="/reimposta-password" component={ResetPasswordPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <ImpersonationBanner />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;