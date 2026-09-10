import { FormModal } from "../components/ui/form-modal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, ShieldCheck, User, UserShield, UserStar } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { StatusCounterCard } from "../components/StatusCounterCard";
import { Combobox } from "../components/ui/combobox";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { ModalCloseButton } from "../components/ui/modal-close-button";
import { SearchInput } from "../components/ui/search-input";
import { Hint } from "../components/ui/tooltip";
import { createUser, getCurrentUser, getUsers, resetUserPassword, updateUser, type ManagedUser } from "../lib/api";

type Filter = "active" | "inactive" | "all";
type UserForm = { name: string; email: string; password: string; role: ManagedUser["role"]; status: ManagedUser["status"] };
const emptyForm: UserForm = { name: "", email: "", password: "", role: "operador", status: "ativo" };
const roleLabels = { proprietario: "Proprietário", administrador: "Administrador", operador: "Operador" };
const statusLabels = { ativo: "Ativo", bloqueado: "Bloqueado", desativado: "Desativado" };
const isInactive = (user: ManagedUser) => user.status !== "ativo";

export function AccessAdministrationPage() {
  const navigate = useNavigate(), queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active"), [search, setSearch] = useState("");
  const [modal, setModal] = useState<ManagedUser | "new" | null>(null), [form, setForm] = useState<UserForm>(emptyForm);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null), [newPassword, setNewPassword] = useState("");
  const currentUser = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers, enabled: currentUser.data?.role !== "operador" });

  useEffect(() => { if (currentUser.isError || currentUser.data?.role === "operador") navigate("/mission-control", { replace: true }); }, [currentUser.data?.role, currentUser.isError, navigate]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });
  const save = useMutation({
    mutationFn: () => modal === "new" ? createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role }) : updateUser(modal!.id, { role: form.role, status: form.status }),
    onSuccess: () => { toast.success(modal === "new" ? "Usuário cadastrado com sucesso." : "Acesso atualizado."); setModal(null); setForm(emptyForm); refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const reset = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password),
    onSuccess: () => { toast.success("Senha redefinida e acessos anteriores revogados."); setResetTarget(null); setNewPassword(""); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível redefinir a senha."),
  });
  const roleOptions = currentUser.data?.role === "proprietario" ? Object.keys(roleLabels) : ["administrador", "operador"];
  const counts = { active: users.data?.filter((user) => !isInactive(user)).length ?? 0, inactive: users.data?.filter(isInactive).length ?? 0, all: users.data?.length ?? 0 };
  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (users.data ?? []).filter((user) => {
      const matchesStatus = Boolean(term) || filter === "all" || (filter === "active" ? !isInactive(user) : isInactive(user));
      return matchesStatus && (!term || [user.name, user.email, roleLabels[user.role], statusLabels[user.status]].some((value) => value.toLocaleLowerCase("pt-BR").includes(term)));
    });
  }, [filter, search, users.data]);
  const open = (user: ManagedUser | "new") => { setModal(user); setForm(user === "new" ? emptyForm : { name: user.name, email: user.email, password: "", role: user.role, status: user.status }); };

  return <AppShell user={currentUser.data}>
    <main className="page-shell">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-primary">ACESSO E IDENTIDADE</p><h1 className="mt-2 page-heading">Cadastro de Usuários</h1></div><button className="operation-button operation-button-primary" onClick={() => open("new")}><Plus size={17} /> Cadastrar</button></header>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <StatusCounterCard kind="active" label="Ativos" value={counts.active} selected={filter === "active"} onClick={() => setFilter("active")} />
        <StatusCounterCard kind="inactive" label="Inativos" value={counts.inactive} selected={filter === "inactive"} onClick={() => setFilter("inactive")} />
        <StatusCounterCard kind="all" label="Todos" value={counts.all} selected={filter === "all"} onClick={() => setFilter("all")} />
      </div>
      <SearchInput className="mt-6" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar Usuários" aria-label="Pesquisar Usuários" />
      {users.isLoading && <div className="mt-4 h-48 animate-pulse rounded-2xl border border-border bg-card" />}
      {users.isError && <div className="mt-4 rounded-2xl border border-danger-border bg-card p-6 text-destructive">Não foi possível carregar os Usuários.</div>}
      {users.data && <section className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid min-w-[800px] border-b bg-muted px-5 py-3 text-xs font-semibold uppercase text-muted-foreground" style={{ gridTemplateColumns: "64px minmax(260px, 1fr) 130px 180px 100px" }}><span>Papel</span><span>Usuário</span><span>Status</span><span>Último acesso</span><span>Ações</span></div>
        {rows.map((user) => { const canEditOwner = currentUser.data?.role === "proprietario" || user.role !== "proprietario"; const RoleIcon = user.role === "proprietario" ? UserStar : user.role === "administrador" ? UserShield : User; return <div key={user.id} className="grid min-w-[800px] items-center border-b px-5 py-4 last:border-0" style={{ gridTemplateColumns: "64px minmax(260px, 1fr) 130px 180px 100px" }}>
          <Hint label={roleLabels[user.role]}><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary" aria-label={roleLabels[user.role]}><RoleIcon size={18} aria-hidden="true" /></span></Hint><div className="min-w-0"><p className="truncate font-semibold">{user.name}{user.id === currentUser.data?.id && <span className="ml-2 text-xs text-primary">Você</span>}</p><p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p></div><span className="text-sm text-foreground">{statusLabels[user.status]}</span><span className="text-sm text-muted-foreground">{user.last_access_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(user.last_access_at)) : "Nunca acessou"}</span><div className="flex gap-1"><button className="rounded-lg p-2 hover:bg-muted" disabled={!canEditOwner} onClick={() => open(user)} aria-label={`Editar ${user.name}`}><Pencil size={17} /></button><button className="rounded-lg p-2 hover:bg-muted" disabled={!canEditOwner || reset.isPending} onClick={() => setResetTarget(user)} aria-label={`Redefinir senha de ${user.name}`}><KeyRound size={17} /></button></div>
        </div>; })}
        {!rows.length && <p className="p-10 text-center text-muted-foreground">Nenhum Usuário nesta seleção.</p>}
      </section>}
    </main>
    {modal && <FormModal title="Usuário" onClose={() => setModal(null)} size="md"><form className="w-full p-6" onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(); }}><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold">{modal === "new" ? "Cadastrar Usuário" : "Editar Usuário"}</h2><ModalCloseButton onClick={() => setModal(null)} /></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Nome<Input className="mt-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={modal !== "new"} required /></label><label className="block text-sm font-semibold">E-mail<Input className="mt-2" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={modal !== "new"} required /></label></div>
      {modal === "new" && <label className="mt-4 block text-sm font-semibold">Senha inicial<Input className="mt-2" type="password" minLength={12} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>}
      {modal === "new" ? <label className="mt-4 block text-sm font-semibold">Papel<Combobox value={form.role} onValueChange={(value) => setForm({ ...form, role: value as ManagedUser["role"] })} options={roleOptions.map((role) => ({ value: role, label: roleLabels[role as ManagedUser["role"]] }))} /></label> : <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="block text-sm font-semibold">Papel<Combobox value={form.role} onValueChange={(value) => setForm({ ...form, role: value as ManagedUser["role"] })} options={roleOptions.map((role) => ({ value: role, label: roleLabels[role as ManagedUser["role"]] }))} /></label><label className="flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold"><Checkbox checked={form.status === "ativo"} onCheckedChange={(checked) => setForm({ ...form, status: checked === true ? "ativo" : "desativado" })} />Ativo</label></div>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="operation-button" onClick={() => setModal(null)}>Cancelar</button><button className="operation-button operation-button-primary" disabled={save.isPending}>Salvar</button></div></form></FormModal>}
    {resetTarget && <FormModal title="Redefinir senha" onClose={() => { setResetTarget(null); setNewPassword(""); }} size="sm"><form className="w-full p-6" onSubmit={(event) => { event.preventDefault(); reset.mutate({ id: resetTarget.id, password: newPassword }); }}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-secondary p-2.5 text-primary"><ShieldCheck size={20} /></span><h2 className="text-xl font-semibold">Redefinir senha</h2></div><ModalCloseButton onClick={() => { setResetTarget(null); setNewPassword(""); }} /></div><p className="mt-3 text-sm text-muted-foreground">Defina uma nova senha para {resetTarget.name}. Todos os acessos atuais serão encerrados.</p><label className="mt-5 block text-sm font-semibold">Nova senha<Input className="mt-2" type="password" minLength={12} autoFocus value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><div className="mt-6 flex justify-end gap-2"><button className="operation-button" type="button" onClick={() => { setResetTarget(null); setNewPassword(""); }}>Cancelar</button><button className="operation-button operation-button-primary" disabled={reset.isPending}>Salvar nova senha</button></div></form></FormModal>}
  </AppShell>;
}
