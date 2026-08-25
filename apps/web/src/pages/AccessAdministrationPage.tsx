import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Combobox } from "../components/ui/combobox";
import { Input } from "../components/ui/input";
import { createUser, getCurrentUser, getUsers, resetUserPassword, updateUser, type ManagedUser } from "../lib/api";

const roleLabels = { proprietario: "Proprietário", administrador: "Administrador", operador: "Operador" };
const statusLabels = { ativo: "Ativo", bloqueado: "Bloqueado", desativado: "Desativado" };

export function AccessAdministrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "operador" as ManagedUser["role"] });
  const currentUser = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers, enabled: currentUser.data?.role !== "operador" });

  useEffect(() => {
    if (currentUser.isError || currentUser.data?.role === "operador") navigate("/mission-control", { replace: true });
  }, [currentUser.data?.role, currentUser.isError, navigate]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });
  const create = useMutation({
    mutationFn: createUser,
    onSuccess: () => { setForm({ name: "", email: "", password: "", role: "operador" }); toast.success("Usuário cadastrado com sucesso."); refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar."),
  });
  const update = useMutation({
    mutationFn: ({ user, role, status }: { user: ManagedUser; role: ManagedUser["role"]; status: ManagedUser["status"] }) => updateUser(user.id, { role, status }),
    onSuccess: () => { toast.success("Acesso atualizado."); refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });
  const reset = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password),
    onSuccess: () => { toast.success("Senha redefinida e acessos anteriores revogados."); setResetTarget(null); setNewPassword(""); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível redefinir a senha."),
  });

  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(form); };
  const roleOptions = currentUser.data?.role === "proprietario" ? Object.keys(roleLabels) : ["administrador", "operador"];

  return <AppShell user={currentUser.data}>
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div><p className="mb-2 text-sm font-semibold tracking-wide text-emerald-700">ACESSO E IDENTIDADE</p><h1 className="text-3xl font-semibold tracking-tight">Usuários da arena</h1><p className="mt-2 text-slate-500">Cadastre a equipe e controle quem pode acessar a operação.</p></div>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><UserPlus size={20} /></span><div><h2 className="font-semibold">Novo Usuário</h2><p className="text-sm text-slate-500">A senha inicial deve ter pelo menos 12 caracteres.</p></div></div>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto] xl:items-end" onSubmit={submit}>
          <label className="text-sm font-semibold text-slate-600">Nome<Input className="mt-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="text-sm font-semibold text-slate-600">E-mail<Input className="mt-2" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="text-sm font-semibold text-slate-600">Senha inicial<Input className="mt-2" type="password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <label className="text-sm font-semibold text-slate-600">Papel<Combobox value={form.role} onValueChange={(value) => setForm({ ...form, role: value as ManagedUser["role"] })} options={roleOptions.map((role) => ({ value: role, label: roleLabels[role as ManagedUser["role"]] }))} /></label>
          <button className="operation-button operation-button-primary h-[46px] justify-center" disabled={create.isPending}>Cadastrar</button>
        </form>
      </section>

      <section className="mt-8"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="text-emerald-700" size={21} /><h2 className="text-xl font-semibold">Acessos cadastrados</h2></div>
        {users.isLoading && <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />}
        {users.isError && <div className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-800">Não foi possível carregar os Usuários.</div>}
        {users.data && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[800px] text-left"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Usuário</th><th className="px-5 py-4">Papel</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Último acesso</th><th className="px-5 py-4 text-right">Segurança</th></tr></thead><tbody className="divide-y divide-slate-100">{users.data.map((user) => {
          const canEditOwner = currentUser.data?.role === "proprietario" || user.role !== "proprietario";
          return <tr key={user.id}><td className="px-5 py-4"><p className="font-semibold">{user.name}{user.id === currentUser.data?.id && <span className="ml-2 text-xs text-emerald-700">Você</span>}</p><p className="mt-1 text-sm text-slate-500">{user.email}</p></td><td className="px-5 py-4"><Combobox className="mt-0 min-w-36" value={user.role} disabled={!canEditOwner || update.isPending} onValueChange={(value) => update.mutate({ user, role: value as ManagedUser["role"], status: user.status })} options={roleOptions.map((role) => ({ value: role, label: roleLabels[role as ManagedUser["role"]] }))} /></td><td className="px-5 py-4"><Combobox className="mt-0 min-w-32" value={user.status} disabled={!canEditOwner || update.isPending} onValueChange={(value) => update.mutate({ user, role: user.role, status: value as ManagedUser["status"] })} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} /></td><td className="px-5 py-4 text-sm text-slate-500">{user.last_access_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(user.last_access_at)) : "Nunca acessou"}</td><td className="px-5 py-4 text-right"><button className="operation-button ml-auto" disabled={!canEditOwner || reset.isPending} onClick={() => setResetTarget(user)}><KeyRound size={15} /> Redefinir senha</button></td></tr>;
        })}</tbody></table></div>}
      </section>
    </main>
    {resetTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5" role="presentation"><form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); reset.mutate({ id: resetTarget.id, password: newPassword }); }}><h2 className="text-xl font-semibold">Redefinir senha</h2><p className="mt-2 text-sm text-slate-500">Defina uma nova senha para {resetTarget.name}. Todos os acessos atuais serão encerrados.</p><label className="mt-5 block text-sm font-semibold text-slate-600">Nova senha<Input className="mt-2" type="password" minLength={12} autoFocus value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><div className="mt-6 flex justify-end gap-2"><button className="operation-button" type="button" onClick={() => { setResetTarget(null); setNewPassword(""); }}>Cancelar</button><button className="operation-button operation-button-primary" disabled={reset.isPending}>Salvar nova senha</button></div></form></div>}
  </AppShell>;
}
