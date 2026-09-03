import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ExternalLink,
  Pencil,
  Plus,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { StatusCounterCard } from "../components/StatusCounterCard";
import { Checkbox } from "../components/ui/checkbox";
import { ConfirmationAlertDialog } from "../components/ui/confirmation-alert-dialog";
import { Combobox } from "../components/ui/combobox";
import { Input } from "../components/ui/input";
import { SearchInput } from "../components/ui/search-input";
import {
  createEquipment,
  deleteEquipment,
  getCameraLive,
  getCurrentUser,
  getEquipments,
  getHealthCenter,
  getSpaces,
  updateEquipment,
  type Equipment,
} from "../lib/api";
type Filter = "active" | "inactive" | "all";
type Form = {
  spaceId: string;
  kind: Equipment["kind"];
  externalId: string;
  description: string;
  captureUrl: string;
  status: Equipment["administrative_status"];
};
const empty: Form = {
  spaceId: "",
  kind: "camera",
  externalId: "",
  description: "",
  captureUrl: "",
  status: "active",
};
const payload = (f: Form, old?: Equipment): Omit<Equipment, "id"> => {
  const configuration = { ...(old?.configuration ?? {}) };
  if (f.kind === "camera") configuration.capture_url = f.captureUrl.trim();
  else delete configuration.capture_url;
  return {
    space_id: f.spaceId,
    kind: f.kind,
    external_id: f.externalId.trim(),
    description: f.description.trim(),
    configuration,
    administrative_status: f.status,
  };
};
export function EquipmentsAdministrationPage() {
  const navigate = useNavigate(),
    qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active"),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<Equipment | "new" | null>(null),
    [form, setForm] = useState<Form>(empty),
    [live, setLive] = useState<Equipment | null>(null);
  const user = useQuery({
      queryKey: ["current-user"],
      queryFn: getCurrentUser,
      retry: false,
    }),
    spaces = useQuery({ queryKey: ["spaces"], queryFn: getSpaces }),
    items = useQuery({
      queryKey: ["equipments"],
      queryFn: () => getEquipments(),
    }),
    health = useQuery({
      queryKey: ["health-center"],
      queryFn: getHealthCenter,
      enabled: Boolean(user.data),
    });
  useEffect(() => {
    if (user.isError) navigate("/login", { replace: true });
    else if (user.data?.role === "operador")
      navigate("/mission-control", { replace: true });
  }, [navigate, user.data?.role, user.isError]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["equipments"] });
  const save = useMutation({
    mutationFn: async () =>
      modal === "new"
        ? createEquipment(payload(form))
        : updateEquipment(modal!.id, payload(form, modal!)),
    onSuccess: () => {
      setModal(null);
      setForm(empty);
      toast.success("Equipamento salvo com sucesso.");
      refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const remove = useMutation({
    mutationFn: deleteEquipment,
    onSuccess: () => {
      toast.success("Equipamento excluído.");
      refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });
  const names = useMemo(
    () => new Map((spaces.data ?? []).map((x) => [x.id, x.name])),
    [spaces.data],
  );
  const rows = useMemo(
    () =>
      (items.data ?? []).filter((x) => {
        const term = search.trim().toLocaleLowerCase("pt-BR");
        const matchesStatus = Boolean(term) || filter === "all" || x.administrative_status === filter;
        const matchesSearch = !term || [x.external_id, x.description, x.kind, names.get(x.space_id) ?? ""]
          .some((value) => value.toLocaleLowerCase("pt-BR").includes(term));
        return matchesStatus && matchesSearch;
      }),
    [items.data, filter, names, search],
  );
  const counts = {
    active:
      items.data?.filter((x) => x.administrative_status === "active").length ??
      0,
    inactive:
      items.data?.filter((x) => x.administrative_status === "inactive")
        .length ?? 0,
    all: items.data?.length ?? 0,
  };
  const open = (x: Equipment | "new") => {
    setModal(x);
    setForm(
      x === "new"
        ? empty
        : {
            spaceId: x.space_id,
            kind: x.kind,
            externalId: x.external_id,
            description: x.description,
            captureUrl: String(x.configuration.capture_url ?? ""),
            status: x.administrative_status,
          },
    );
  };
  const valid =
    form.spaceId &&
    form.externalId.trim() &&
    (form.kind === "ax_device" || form.captureUrl.trim());
  const copyAxDeviceUrl = async () => {
    const url = health.data?.ax_device_api_url;
    if (!url) {
      toast.error("Selecione a rede dos AX Devices na tela de Configurações.");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy command failed");
      }
      toast.success("Link do AX Device copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };
  return (
    <AppShell user={user.data}>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              EQUIPAMENTOS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Cadastro de Equipamentos
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
        <SearchInput className="mt-6" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar Equipamentos" aria-label="Pesquisar Equipamentos" />
        <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="grid grid-cols-[80px_minmax(140px,0.8fr)_minmax(180px,1.2fr)_140px] border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Tipo</span>
            <span>ID</span>
            <span>Descrição</span>
            <span>Ações</span>
          </div>
          {rows.map((x) => (
            <div
              key={x.id}
              className="grid grid-cols-[80px_minmax(140px,0.8fr)_minmax(180px,1.2fr)_140px] items-center border-b px-4 py-4 last:border-0"
            >
              {x.kind === "camera" ? (
                <button
                  className="w-fit rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setLive(x)}
                  aria-label={`Abrir transmissão ao vivo de ${x.external_id}`}
                  title="Abrir Câmera ao vivo"
                >
                  <Camera />
                </button>
              ) : (
                <button
                  className="w-fit rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"
                  onClick={copyAxDeviceUrl}
                  aria-label={`Copiar link de configuração de ${x.external_id}`}
                  title="Copiar link do AX Device"
                >
                  <Radio />
                </button>
              )}
              <p className="font-semibold">{x.external_id}</p>
              <div>
                <p className="font-medium text-slate-700">{x.description || "Sem descrição"}</p>
                <p className="text-xs text-slate-400">
                  {x.kind === "camera" ? "Câmera" : "AX Device"} ·{" "}
                  {names.get(x.space_id)} ·{" "}
                  {x.administrative_status === "active" ? "Ativo" : "Inativo"}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => open(x)}
                >
                  <Pencil size={17} />
                </button>
                <ConfirmationAlertDialog
                  title="Excluir Equipamento?"
                  description={`O Equipamento ${x.external_id} e seu vínculo administrativo serão removidos definitivamente. A auditoria pertencente à Sessão será preservada.`}
                  confirmLabel="Excluir Equipamento"
                  pending={remove.isPending}
                  onConfirm={() => remove.mutate(x.id)}
                  trigger={<button className="rounded-lg p-2 hover:bg-rose-50 hover:text-rose-700" aria-label={`Excluir ${x.external_id}`}><Trash2 size={17} /></button>}
                />
              </div>
            </div>
          ))}
          {!rows.length && (
            <p className="p-10 text-center text-slate-500">
              Nenhum Equipamento nesta seleção.
            </p>
          )}
        </section>
        {modal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-5">
            <form
              className="w-full max-w-xl rounded-2xl bg-white p-6"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <h2 className="text-xl font-semibold">
                {modal === "new"
                  ? "Cadastrar Equipamento"
                  : "Editar Equipamento"}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Espaço
                  <Combobox
                    value={form.spaceId}
                    onValueChange={(value) => setForm({ ...form, spaceId: value })}
                    options={(spaces.data ?? []).map((space) => ({ value: space.id, label: space.name }))}
                    placeholder="Selecione o Espaço"
                    searchPlaceholder="Buscar Espaço..."
                  />
                </label>
                <label className="text-sm font-semibold">
                  Tipo
                  <Combobox
                    value={form.kind}
                    onValueChange={(value) => setForm({ ...form, kind: value as Equipment["kind"] })}
                    options={[{ value: "camera", label: "Câmera" }, { value: "ax_device", label: "AX Device" }]}
                  />
                </label>
                <label className="text-sm font-semibold">
                  ID
                  <Input
                    className="mt-2"
                    maxLength={100}
                    placeholder={form.kind === "ax_device" ? "Ex.: AX-QUADRA-01" : "Ex.: CAM-QUADRA-01"}
                    value={form.externalId}
                    onChange={(e) =>
                      setForm({ ...form, externalId: e.target.value })
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-3 self-end pb-3 text-sm font-semibold">
                  <Checkbox
                    checked={form.status === "active"}
                    onCheckedChange={(checked) => setForm({ ...form, status: checked === true ? "active" : "inactive" })}
                  />
                  Ativo
                </label>
                <label className="text-sm font-semibold sm:col-span-2">
                  Descrição
                  <Input
                    className="mt-2"
                    maxLength={160}
                    placeholder="Ex.: Botão da quadra principal"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
                {form.kind === "camera" && (
                  <label className="text-sm font-semibold sm:col-span-2">
                    URL RTSP
                    <Input
                      className="mt-2 font-mono"
                      value={form.captureUrl}
                      onChange={(e) =>
                        setForm({ ...form, captureUrl: e.target.value })
                      }
                    />
                  </label>
                )}
              </div>
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
                  disabled={!valid || save.isPending}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}
        {live && (
          <CameraLiveModal
            camera={live}
            spaceName={names.get(live.space_id) ?? "Espaço"}
            onClose={() => setLive(null)}
          />
        )}
      </main>
    </AppShell>
  );
}
function CameraLiveModal({
  camera,
  spaceName,
  onClose,
}: {
  camera: Equipment;
  spaceName: string;
  onClose: () => void;
}) {
  const live = useQuery({
    queryKey: ["camera-live", camera.id],
    queryFn: () => getCameraLive(camera.id),
    retry: 1,
  });
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 px-4">
      <section className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white">
        <header className="flex justify-between p-4">
          <div>
            <h2 className="font-semibold">{camera.external_id} · Ao vivo</h2>
            <p className="text-sm text-slate-500">{spaceName}</p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        {live.data ? (
          <iframe
            className="aspect-video w-full bg-black"
            src={live.data.url}
            allow="autoplay; fullscreen"
          />
        ) : (
          <div className="grid aspect-video place-items-center bg-slate-950 text-white">
            {live.isLoading
              ? "Conectando…"
              : live.error instanceof Error
                ? live.error.message
                : "Indisponível"}
          </div>
        )}
        {live.data && (
          <a
            className="flex items-center gap-1 p-3 text-sm text-emerald-700"
            href={live.data.url}
            target="_blank"
            rel="noreferrer"
          >
            Abrir em nova aba <ExternalLink size={14} />
          </a>
        )}
      </section>
    </div>
  );
}
