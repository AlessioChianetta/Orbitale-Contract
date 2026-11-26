import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import PasswordCard from "@/components/password-card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/password-reset/request", { email: email.trim() });
      return (await res.json()) as { message: string };
    },
    onSuccess: (r) => setDone(r.message),
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <PasswordCard title="Password dimenticata" subtitle="Inserisci l'email del tuo account: ti mandiamo un link per sceglierne una nuova.">
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700" data-testid="text-reset-requested">{done}</p>
          <p className="text-xs text-gray-500">Non arriva? Controlla la cartella spam oppure chiedi all'amministratore della tua azienda.</p>
          <Link href="/auth"><span className="text-sm text-indigo-600 hover:underline cursor-pointer">Torna all'accesso</span></Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate(); }}
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" data-testid="input-reset-email" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full h-11" disabled={mutation.isPending || !email.trim()} data-testid="button-request-reset">
            {mutation.isPending ? "Invio..." : "Invia il link"}
          </Button>
          <Link href="/auth"><span className="block text-center text-sm text-gray-500 hover:text-gray-800 cursor-pointer">Torna all'accesso</span></Link>
        </form>
      )}
    </PasswordCard>
  );
}
