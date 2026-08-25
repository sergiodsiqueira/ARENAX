import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { StatusCounterCard } from "../components/StatusCounterCard";
import { ConfirmationAlertDialog } from "../components/ui/confirmation-alert-dialog";
import { Combobox } from "../components/ui/combobox";
import { Input } from "../components/ui/input";
import {
  createClient,
  deleteClient,
  getClients,
  getCurrentUser,
  updateClient,
  type Client,
} from "../lib/api";
type Filter = "active" | "inactive" | "all";
export function ClientsAdministrationPage() {
  const navigate = useNavigate(),
    qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active"),
    [modal, setModal] = useState<Client | "new" | null>(null),
    [name, setName] = useState(""),
    [status, setStatus] = useState<Client["administrative_status"]>("active");
  const user = useQuery({
      queryKey: ["current-user"],
      queryFn: getCurrentUser,
      retry: false,
    }),
    clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  useEffect(() => {
    if (user.isError) navigate("/login", { replace: true });
  }, [navigate, user.isError]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["clients"] });
  const save = useMutation({
    mutationFn: async () =>
      modal === "new"
        ? createClient(name.trim())
        : updateClient(modal!.id, {
            name: name.trim(),
            administrative_status: status,
          }),
    onSuccess: () => {
      setModal(null);
      toast.success("Cliente salvo com sucesso.");
      refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const remove = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      toast.success("Cliente excluído.");
      refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });
  const counts = {
    active:
      clients.data?.filter((x) => x.administrative_status === "active")
        .length ?? 0,
    inactive:
      clients.data?.filter((x) => x.administrative_status === "inactive")
        .length ?? 0,
    all: clients.data?.length ?? 0,
  };
  const rows = useMemo(
    () =>
      (clients.data ?? []).filter(
        (x) => filter === "all" || x.administrative_status === filter,
      ),
    [clients.data, filter],
  );
  const open = (item: Client | "new") => {
    setModal(item);
    setName(item === "new" ? "" : item.name);
    setStatus(item === "new" ? "active" : item.administrative_status);
  };
  return (
    <AppShell user={user.data}>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">CLIENTES</p>
            <h1 className="mt-2 text-3xl font-semibold">
              Cadastro de Clientes
            </h1>
          </div>
          <button
            className="operation-button operation-button-primary"
            onClick={() => open("new")}
          >
            <Plus size={17} /> Cadastrar
          </button>
        </header>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <StatusCounterCard
            kind="active"
            label="Ativos"
            value={counts.active}
            selected={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <StatusCounterCard
            kind="inactive"
            label="Inativos"
            value={counts.inactive}
            selected={filter === "inactive"}
            onClick={() => setFilter("inactive")}
          />
          <StatusCounterCard
            kind="all"
            label="Todos"
            value={counts.all}
            selected={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </div>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[80px_1fr_110px] border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Tipo</span>
            <span>Descrição</span>
            <span>Ações</span>
          </div>
          {rows.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[80px_1fr_110px] items-center border-b px-4 py-4 last:border-0"
            >
              <UserRound className="text-emerald-700" />
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-slate-400">
                  {item.administrative_status === "active"
                    ? "Ativo"
                    : "Inativo"}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => open(item)}
                  aria-label="Editar"
                >
                  <Pencil size={17} />
                </button>
                <ConfirmationAlertDialog
                  title="Excluir Cliente?"
                  description={`O Cliente ${item.name} será removido definitivamente. A exclusão será bloqueada se ele for Responsável por alguma Sessão.`}
                  confirmLabel="Excluir Cliente"
                  pending={remove.isPending}
                  onConfirm={() => remove.mutate(item.id)}
                  trigger={<button className="rounded-lg p-2 hover:bg-rose-50 hover:text-rose-700" aria-label={`Excluir ${item.name}`}><Trash2 size={17} /></button>}
                />
              </div>
            </div>
          ))}
          {!rows.length && (
            <p className="p-10 text-center text-slate-500">
              Nenhum Cliente nesta seleção.
            </p>
          )}
        </section>
        {modal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-5">
            <form
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <h2 className="text-xl font-semibold">
                {modal === "new" ? "Cadastrar Cliente" : "Editar Cliente"}
              </h2>
              <label className="mt-5 block text-sm font-semibold">
                Descrição
                <Input
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              {modal !== "new" && (
                <label className="mt-4 block text-sm font-semibold">
                  Estado
                  <Combobox
                    value={status}
                    onValueChange={(value) => setStatus(value as Client["administrative_status"])}
                    options={[{ value: "active", label: "Ativo" }, { value: "inactive", label: "Inativo" }]}
                  />
                </label>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="operation-button"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="operation-button operation-button-primary"
                  disabled={!name.trim() || save.isPending}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </AppShell>
  );
}
