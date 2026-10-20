import { ReactNode } from "react";
import { KeyRound } from "lucide-react";

/** Cornice comune delle pagine password (stile della pagina di accesso). */
export default function PasswordCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/60 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white/90 border border-white shadow-2xl shadow-indigo-100 p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        </div>
        {subtitle ? <div className="text-sm text-gray-500 mb-6">{subtitle}</div> : <div className="mb-6" />}
        {children}
      </div>
    </div>
  );
}

export const PASSWORD_MIN_LENGTH = 8;

/** Controllo lato pagina (il server ripete gli stessi controlli). */
export function validateNewPassword(newPassword: string, confirm: string): string | null {
  if (newPassword.length < PASSWORD_MIN_LENGTH) return `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri`;
  if (newPassword !== confirm) return "Le due password non coincidono";
  return null;
}
