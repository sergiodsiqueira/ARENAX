import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "../components/AppShell";
import { StatusCounterCard } from "../components/StatusCounterCard";
import {
  createSpace,
  deleteSpace,
  getCurrentUser,
  getSpaces,
  updateSpace,
  type Space,
} from "../lib/api";
type Filter = "active" | "inactive" | "all";
const inactive = (x: Space) => x.administrative_status !== "active";
export function SpacesAdministrationPage() {
  const navigate = useNavigate(),
    qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active"),
    [modal, setModal] = useState<Space | "new" | null>(null),
    [name, setName] = useState(""),
    [status, setStatus] = useState("active"),
    [feedback, setFeedback] = useState<string | null>(null);
  const user = useQuery({
      queryKey: ["current-user"],
      queryFn: getCurrentUser,
      retry: false,
    }),
    spaces = useQuery({ queryKey: ["spaces"], queryFn: getSpaces });
  useEffect(() => {
    if (user.isError) navigate("/login", { replace: true });
  }, [navigate, user.isError]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["spaces"] });
  const save = useMutation({
    mutationFn: async () =>
      modal === "new"
        ? createSpace(name.trim())
        : updateSpace(modal!.id, {
            name: name.trim(),
            administrative_status: status,
          }),
    onSuccess: () => {
      setModal(null);
      setFeedback("Espaço salvo com sucesso.");
      refresh();
    },
    onError: (e) =>
      setFeedback(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const remove = useMutation({
    mutationFn: deleteSpace,
    onSuccess: () => {
      setFeedback("Espaço excluído.");
      refresh();
    },
    onError: (e) =>
      setFeedback(e instanceof Error ? e.message : "Não foi possível excluir."),
  });
  const counts = {
    active: spaces.data?.filter((x) => !inactive(x)).length ?? 0,
    inactive: spaces.data?.filter(inactive).length ?? 0,
    all: spaces.data?.length ?? 0,
  };
  const rows = useMemo(
    () =>
      (spaces.data ?? []).filter(
        (x) =>
          filter === "all" ||
          (filter === "active" ? !inactive(x) : inactive(x)),
      ),
    [spaces.data, filter],
  );
  const open = (x: Space | "new") => {
    setModal(x);
    setName(x === "new" ? "" : x.name);
    setStatus(x === "new" ? "active" : x.administrative_status);
  };
  return (
    <AppShell user={user.data}>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">ESPAÇOS</p>
            <h1 className="mt-2 text-3xl font-semibold">Cadastro de Espaços</h1>
          </div>
          <button
            className="operation-button operation-button-primary"
            onClick={() => open("new")}
          >
            <Plus size={17} /> Cadastrar
          </button>
        </header>
        {feedback && (
          <div className="mt-5 rounded-xl border bg-white p-3 text-sm">
            {feedback}
          </div>
        )}
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
        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="grid grid-cols-[80px_1fr_110px] border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Tipo</span>
            <span>Descrição</span>
            <span>Ações</span>
          </div>
          {rows.map((x) => (
            <div
              key={x.id}
              className="grid grid-cols-[80px_1fr_110px] items-center border-b px-4 py-4 last:border-0"
            >
              <MapPin className="text-emerald-700" />
              <div>
                <p className="font-semibold">{x.name}</p>
                <p className="text-xs text-slate-400">
                  {x.administrative_status === "active"
                    ? "Ativo"
                    : x.administrative_status === "maintenance"
                      ? "Manutenção"
                      : "Desativado"}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => open(x)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="rounded-lg p-2 hover:bg-rose-50"
                  onClick={() =>
                    globalThis.confirm(`Excluir ${x.name}?`) &&
                    remove.mutate(x.id)
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
          {!rows.length && (
            <p className="p-10 text-center text-slate-500">
              Nenhum Espaço nesta seleção.
            </p>
          )}
        </section>
        {modal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-5">
            <form
              className="w-full max-w-md rounded-2xl bg-white p-6"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <h2 className="text-xl font-semibold">
                {modal === "new" ? "Cadastrar Espaço" : "Editar Espaço"}
              </h2>
              <label className="mt-5 block text-sm font-semibold">
                Descrição
                <input
                  className="admin-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Estado
                <select
                  className="admin-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Ativo</option>
                  <option value="maintenance">Manutenção</option>
                  <option value="disabled">Desativado</option>
                </select>
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="operation-button"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button className="operation-button operation-button-primary">
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
