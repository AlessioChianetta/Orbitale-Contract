import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * "Entra come venditore": l'admin usa l'account di un suo venditore e torna
 * al proprio con un click. Dopo il cambio la pagina si ricarica, così nessun
 * dato dell'account precedente resta in memoria.
 */
export function useImpersonation() {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const enterAsSeller = async (sellerId: number) => {
    setPending(true);
    try {
      await apiRequest("POST", `/api/admin/impersonate/${sellerId}`);
      window.location.assign("/seller");
    } catch (err) {
      setPending(false);
      toast({ title: "Impossibile entrare come venditore", description: getErrorMessage(err as Error), variant: "destructive" });
    }
  };

  const backToAdmin = async () => {
    setPending(true);
    try {
      await apiRequest("POST", "/api/admin/stop-impersonation");
      window.location.assign("/admin");
    } catch (err) {
      setPending(false);
      toast({ title: "Impossibile tornare all'account admin", description: getErrorMessage(err as Error), variant: "destructive" });
      window.location.assign("/auth");
    }
  };

  return { enterAsSeller, backToAdmin, pending };
}

type CompanyUser = { id: number; fullName: string; username: string; role: string; isActive: boolean };

/** Pulsante nell'intestazione dell'admin: un venditore → entra subito; più venditori → elenco. */
export function EnterAsSellerButton() {
  const { enterAsSeller, pending } = useImpersonation();
  const { data: users = [] } = useQuery<CompanyUser[]>({ queryKey: ["/api/admin/users"] });
  const sellers = users.filter((u) => u.role === "seller" && u.isActive !== false);
  if (sellers.length === 0) return null;

  const icon = pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Store className="h-4 w-4 mr-2" />;
  const cls = "text-slate-500 hover:text-slate-900 hover:bg-black/[0.03] transition-all duration-200";

  if (sellers.length === 1) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cls}
        disabled={pending}
        onClick={() => enterAsSeller(sellers[0].id)}
        title={`Usa l'account venditore di ${sellers[0].fullName}`}
        data-testid="button-enter-as-seller"
      >
        {icon}
        Entra come venditore
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cls} disabled={pending} data-testid="button-enter-as-seller">
          {icon}
          Entra come venditore
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Scegli il venditore</DropdownMenuLabel>
        {sellers.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => enterAsSeller(s.id)} data-testid={`menu-enter-as-seller-${s.id}`}>
            {s.fullName} <span className="ml-2 text-xs text-slate-400">{s.username}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Fascia in alto, visibile solo mentre l'admin usa l'account di un venditore. */
export function ImpersonationBanner() {
  const { user } = useAuth();
  const { backToAdmin, pending } = useImpersonation();
  if (!user?.impersonator) return null;
  return (
    <div className="sticky top-0 z-50 bg-slate-900 text-white" data-testid="impersonation-banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          Stai usando l'account venditore di <strong>{user.fullName}</strong>. I contratti che invii risultano inviati da questo account.
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          disabled={pending}
          onClick={backToAdmin}
          data-testid="button-back-to-admin"
        >
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
          Torna all'account admin ({user.impersonator.fullName})
        </Button>
      </div>
    </div>
  );
}
