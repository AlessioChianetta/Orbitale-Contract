import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import AdminDashboard from "@/pages/admin-dashboard";
import SellerDashboard from "@/pages/seller-dashboard";
import ClientView from "@/pages/client-view";
import CompanySettings from "./pages/company-settings";
import UserManagement from "./pages/user-management";
import ContractView from "./pages/contract-view";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={AdminDashboard} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <ProtectedRoute path="/seller" component={SellerDashboard} />
      <ProtectedRoute path="/company-settings" component={CompanySettings} />
      <ProtectedRoute path="/user-management" component={UserManagement} />
      <Route path="/contratto" component={ContractView} />
      <Route path="/client/:code" component={ClientView} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;