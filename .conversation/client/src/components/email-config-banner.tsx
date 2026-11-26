import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export type EmailStatus = { configured: boolean; missingFields: string[] };

export function useEmailStatus() {
  return useQuery<EmailStatus>({
    queryKey: ["/api/company-settings/email-status"],
    staleTime: 30_000,
  });
}

type Props = {
  compact?: boolean;
  className?: string;
};

export default function EmailConfigBanner({ compact, className }: Props) {
  const { user } = useAuth();
  const { data, isLoading } = useEmailStatus();

  if (isLoading || !data || data.configured) return null;

  const isAdmin = user?.role === "admin";

  return (
    <div
      role="alert"
      className={
        "flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 " +
        (className || "")
      }
      data-testid="banner-email-not-configured"
    >
      <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Configurazione email aziendale incompleta</p>
        {!compact && (
          <p className="mt-0.5">
            Finché le credenziali SMTP non sono compilate, non è possibile inviare i contratti né i
            codici OTP via email.
          </p>
        )}
        {isAdmin ? (
          <Link
            href="/company-settings"
            className="mt-1 inline-block font-medium text-amber-900 underline hover:text-amber-950"
            data-testid="link-configure-email"
          >
            Configura ora le impostazioni email →
          </Link>
        ) : (
          <p className="mt-1 text-amber-800">
            Contatta l'amministratore per completare la configurazione in Impostazioni Azienda.
          </p>
        )}
      </div>
    </div>
  );
}
