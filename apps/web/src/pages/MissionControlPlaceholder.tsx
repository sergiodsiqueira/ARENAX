import { LogOut, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { getCurrentUser, logout, type AuthenticatedUser } from "../lib/api";

export function MissionControlPlaceholder() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  const leave = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (!user) {
    return <main className="min-h-screen bg-stone-50" aria-label="Verificando acesso" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-[0.22em]">ARENAX</span>
          <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Radio size={16} /> Acesso autenticado
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Olá, {user.name}.</h1>
        <p className="mt-3 leading-7 text-slate-500">
          Seu acesso está funcionando. O Mission Control será construído nesta área.
        </p>
        <button className="mt-8 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700" onClick={leave}>
          <LogOut size={17} /> Sair com segurança
        </button>
      </section>
    </main>
  );
}
