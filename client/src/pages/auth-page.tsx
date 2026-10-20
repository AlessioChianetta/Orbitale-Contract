import { useAuth } from "@/hooks/use-auth";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { FileText, ArrowLeft } from "lucide-react";

const loginSchema = insertUserSchema.pick({ username: true, password: true });

type LoginForm = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const { user, loginMutation } = useAuth();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
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

          {/* LOGIN TAB */}
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
        </div>
      </div>
    </div>
  );
}