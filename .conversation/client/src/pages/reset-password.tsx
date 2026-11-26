import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import PasswordCard, { validateNewPassword, PASSWORD_MIN_LENGTH } from "@/components/password-card";

export default function ResetPasswordPage() {
  const token = new URLSearchParams(useSearch()).get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/password-reset/confirm", { token, newPassword });
      return res.json();
    },
    onSuccess: () => setDone(true),
    onError: (e) => setError(getErrorMessage(e)),
  });

  if (!token) {
    return (
      <PasswordCard title="Link non valido" subtitle="Il link è incompleto. Apri di nuovo quello ricevuto via email oppure richiedine uno nuovo.">
        <Link href="/password-dimenticata"><span className="text-sm text-indigo-600 hover:underline cursor-pointer">Richiedi un nuovo link</span></Link>
      </PasswordCard>
    );
  }

  if (done) {
    return (
      <PasswordCard title="Password aggiornata" subtitle="Ora puoi accedere con la nuova password.">
        <Link href="/auth"><span className="text-sm text-indigo-600 hover:underline cursor-pointer" data-testid="link-login-after-reset">Vai all'accesso</span></Link>
      </PasswordCard>
    );
  }

  return (
    <PasswordCard title="Scegli una nuova password" subtitle={`Almeno ${PASSWORD_MIN_LENGTH} caratteri.`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const problem = validateNewPassword(newPassword, confirm);
          setError(problem);
          if (!problem) mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="new">Nuova password</Label>
          <Input id="new" type="password" autoComplete="new-password" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5 h-11" data-testid="input-new-password" />
        </div>
        <div>
          <Label htmlFor="confirm">Ripeti la nuova password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 h-11" data-testid="input-confirm-password" />
        </div>
        {error && (
          <p className="text-sm text-red-600">
            {error}{" "}
            {/scadut|non valido/i.test(error) && (
              <Link href="/password-dimenticata"><span className="underline cursor-pointer">Richiedi un nuovo link</span></Link>
            )}
          </p>
        )}
        <Button type="submit" className="w-full h-11" disabled={mutation.isPending} data-testid="button-save-password">
          {mutation.isPending ? "Salvataggio..." : "Salva la nuova password"}
        </Button>
      </form>
    </PasswordCard>
  );
}
