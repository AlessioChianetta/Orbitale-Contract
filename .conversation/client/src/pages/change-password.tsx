import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import PasswordCard, { validateNewPassword, PASSWORD_MIN_LENGTH } from "@/components/password-card";

export default function ChangePasswordPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const forced = !!user?.mustChangePassword;
  const home = user?.role === "admin" ? "/admin" : "/seller";

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/change-password", { currentPassword, newPassword });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Password aggiornata" });
      navigate(home);
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(newPassword, confirm);
    setError(problem);
    if (!problem) mutation.mutate();
  };

  return (
    <PasswordCard
      title="Cambia password"
      subtitle={forced
        ? "Stai usando una password temporanea: scegline una tua per continuare."
        : `Almeno ${PASSWORD_MIN_LENGTH} caratteri.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="current">{forced ? "Password temporanea" : "Password attuale"}</Label>
          <Input id="current" type="password" autoComplete="current-password" value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1.5 h-11" data-testid="input-current-password" />
        </div>
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
        {error && <p className="text-sm text-red-600" data-testid="text-password-error">{error}</p>}
        <Button type="submit" className="w-full h-11" disabled={mutation.isPending || !currentPassword} data-testid="button-save-password">
          {mutation.isPending ? "Salvataggio..." : "Salva la nuova password"}
        </Button>
        <div className="flex justify-between text-sm">
          {forced ? <span /> : (
            <button type="button" className="text-gray-500 hover:text-gray-800" onClick={() => navigate(home)}>Annulla</button>
          )}
          <button type="button" className="text-gray-500 hover:text-gray-800" onClick={() => logoutMutation.mutate()}>Esci</button>
        </div>
      </form>
    </PasswordCard>
  );
}
