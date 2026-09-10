import { FormModal } from "../components/ui/form-modal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  Plus,
  Radio,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUrlFilter } from "../hooks/use-url-filter";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { ConfirmationAlertDialog } from "../components/ui/confirmation-alert-dialog";
import { Combobox } from "../components/ui/combobox";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { FieldLegend, FieldSet } from "../components/ui/field";
import { ModalCloseButton } from "../components/ui/modal-close-button";
import { SessionSchedulePicker } from "../components/ui/session-schedule-picker";
import { Textarea } from "../components/ui/textarea";
import {
  createSession,
  getClients,
  getCurrentUser,
  getInProgressSessions,
  getSessions,
  getSpaces,
  transitionSession,
  updateClient,
  type ArenaSession,
  type Client,
  type SessionStatus,
} from "../lib/api";

const statusLabels: Record<SessionStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "Em andamento",
  finished: "Finalizada",
  archived: "Arquivada",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
};
const statusClasses: Record<SessionStatus, string> = {
  scheduled: "bg-secondary text-primary",
  confirmed: "bg-secondary text-primary",
  in_progress: "bg-primary text-primary-foreground",
  finished: "bg-border text-foreground",
  archived: "bg-muted text-muted-foreground",
  cancelled: "bg-danger-muted text-destructive",
  no_show: "bg-warning-muted text-warning-foreground",
};

function dayWindow(value: string) {
  const start = new Date(`${value}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
function dateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
function dateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function initialPeriod() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60_000);
  return { start: dateTimeInput(start), end: dateTimeInput(end) };
}

function initialPeriodForDay(day: string) {
  const period = initialPeriod();
  return {
    start: `${day}${period.start.slice(10)}`,
    end: `${day}${period.end.slice(10)}`,
  };
}

function formatPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
}

function formatDuration(start: string, end: string) {
  const totalMinutes = Math.max(
    0,
    Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 60_000),
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

export function AgendaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [day, setDay] = useUrlFilter("date", dateInput(new Date()), (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()));
  const [creating, setCreating] = useState(false);
  const [responsibleId, setResponsibleId] = useState("");
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [period, setPeriod] = useState(initialPeriod);
  const [view, setView] = useUrlFilter<"day" | "in_progress">("view", "day", (value) => value === "day" || value === "in_progress");
  const [spaceFilter, setSpaceFilter] = useUrlFilter<string>("space", "all");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientDraft, setClientDraft] = useState({ name: "", phone: "", email: "", notes: "" });
  const window = useMemo(() => dayWindow(day), [day]);
  const user = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const spaces = useQuery({ queryKey: ["spaces"], queryFn: getSpaces });
  const sessions = useQuery({
    queryKey: ["agenda", day, spaceFilter],
    queryFn: () => getSessions(
      window.start,
      window.end,
      spaceFilter === "all" ? undefined : spaceFilter,
    ),
  });
  const inProgressSessions = useQuery({
    queryKey: ["agenda-in-progress"],
    queryFn: getInProgressSessions,
    enabled: view === "in_progress",
  });
  const selectedDate = useMemo(() => new Date(`${day}T12:00:00`), [day]);
  const monthWindow = useMemo(() => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
    return { start, end };
  }, [selectedDate]);
  const monthSessions = useQuery({
    queryKey: ["agenda-month", selectedDate.getFullYear(), selectedDate.getMonth()],
    queryFn: () => getSessions(monthWindow.start, monthWindow.end),
  });
  const markedDates = useMemo(
    () => new Set((monthSessions.data ?? []).map((session) => dateInput(new Date(session.scheduled_start)))),
    [monthSessions.data],
  );
  useEffect(() => {
    if (user.isError) navigate("/login", { replace: true });
  }, [navigate, user.isError]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-in-progress"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-month"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };
  const create = useMutation({
    mutationFn: () =>
      createSession({
        responsible_client_id: responsibleId,
        space_ids: spaceIds,
        scheduled_start: new Date(period.start).toISOString(),
        scheduled_end: new Date(period.end).toISOString(),
      }),
    onSuccess: () => {
      setCreating(false);
      setResponsibleId("");
      setSpaceIds([]);
      setPeriod(initialPeriod());
      toast.success("Sessão agendada com sucesso.");
      refresh();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a Sessão.",
      ),
  });
  const transition = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "confirm" | "start" | "cancel" | "no_show";
    }) => transitionSession(id, action),
    onSuccess: () => {
      toast.success("Sessão atualizada com sucesso.");
      refresh();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a Sessão.",
      ),
  });
  const saveClient = useMutation({
    mutationFn: () => {
      if (!editingClient) throw new Error("Cliente não selecionado.");
      return updateClient(editingClient.id, {
        ...editingClient,
        name: clientDraft.name.trim(),
        phone: clientDraft.phone.replace(/\D/g, ""),
        email: clientDraft.email.trim(),
        notes: clientDraft.notes.trim(),
      });
    },
    onSuccess: (updatedClient) => {
      queryClient.setQueryData<Client[]>(["clients"], (current = []) =>
        current.map((client) => client.id === updatedClient.id ? updatedClient : client),
      );
      setEditingClient(null);
      toast.success("Cliente atualizado com sucesso.");
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Não foi possível atualizar o Cliente.",
    ),
  });
  const clientsById = useMemo(
    () => new Map((clients.data ?? []).map((client) => [client.id, client])),
    [clients.data],
  );
  const spaceNames = useMemo(
    () => new Map((spaces.data ?? []).map((space) => [space.id, space.name])),
    [spaces.data],
  );
  const spaceFilterOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...(spaces.data ?? [])
        .map((space) => ({ value: space.id, label: space.name })),
    ],
    [spaces.data],
  );
  const openCreateSession = () => {
    setPeriod(initialPeriodForDay(day));
    setCreating(true);
  };
  const openClientEdit = (clientId: string) => {
    const client = clientsById.get(clientId);
    if (!client) return;
    setEditingClient(client);
    setClientDraft({
      name: client.name,
      phone: formatPhone(client.phone),
      email: client.email,
      notes: client.notes,
    });
  };
  const valid =
    responsibleId &&
    spaceIds.length > 0 &&
    period.start &&
    period.end &&
    new Date(period.end) > new Date(period.start);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) create.mutate();
  };
  const displayedSessions = view === "in_progress" ? inProgressSessions : sessions;

  return (
    <AppShell user={user.data}>
      <main className="page-shell flex flex-col lg:h-dvh lg:min-h-0">
        <div className="flex shrink-0 flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold tracking-wide text-primary">
              AGENDA
            </p>
            <h1 className="page-heading">
              Sessões da Arena
            </h1>
            <p className="mt-2 text-muted-foreground">
              Planeje a utilização dos Espaços e acompanhe confirmações.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={`operation-button justify-center ${view === "in_progress" ? "operation-button-primary" : ""}`}
              aria-pressed={view === "in_progress"}
              onClick={() => setView((current) => current === "in_progress" ? "day" : "in_progress")}
            >
              <Radio size={16} /> Em andamento
            </button>
            <button
              className="operation-button operation-button-primary justify-center"
              onClick={openCreateSession}
            >
              <Plus size={17} /> Nova Sessão
            </button>
          </div>
        </div>
        <div className={view === "day" ? "mt-7 grid min-h-0 items-start gap-5 lg:flex-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch" : "mt-7 flex min-h-0 flex-col gap-5 lg:flex-1"}>
        {view === "day" ? <section className="flex min-h-0 min-w-0 flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-start-2 lg:row-start-1 lg:overflow-y-auto [&>*]:shrink-0">
          <DatePicker inline value={day} onChange={setDay} markedDates={markedDates} className="w-full min-w-0" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-primary bg-transparent px-6 text-primary"
            onClick={() => setDay(dateInput(new Date()))}
          >
            Hoje
          </Button>
          <FieldSet className="mt-3 w-full min-w-0 gap-3" disabled={spaces.isLoading}>
            <FieldLegend id="agenda-space-label" variant="label">Espaço</FieldLegend>
            <Combobox
              className="mt-0"
              value={spaceFilter}
              onValueChange={setSpaceFilter}
              options={spaceFilterOptions}
              placeholder="Todos"
              searchPlaceholder="Buscar Espaço..."
              emptyText="Nenhum Espaço encontrado."
              disabled={spaces.isLoading}
            />
          </FieldSet>
        </section> : <section className="flex items-center gap-3 rounded-2xl bg-secondary px-5 py-4 text-primary"><span className="grid size-9 place-items-center rounded-xl bg-card"><Radio size={18} /></span><div><p className="font-semibold">Sessões em andamento</p><p className="text-sm text-muted-foreground">Exibindo todas as Sessões atualmente em curso na Arena.</p></div></section>}

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-start-1 lg:row-start-1 lg:flex-1">
        <section
          aria-label={view === "day" ? "Sessões da Agenda" : "Sessões em andamento"}
          tabIndex={0}
          className="max-h-[70dvh] min-h-0 space-y-3 overflow-y-auto overscroll-contain rounded-lg p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:max-h-none lg:flex-1"
        >
          {displayedSessions.isLoading &&
            [1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          {displayedSessions.isError && (
            <div className="rounded-2xl border border-danger-border bg-card p-6 text-destructive">
              Não foi possível carregar a Agenda.
            </div>
          )}
          {!displayedSessions.isLoading &&
            !displayedSessions.isError &&
            !displayedSessions.data?.length && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                <CalendarDays className="mx-auto text-muted-foreground" size={36} />
                <p className="mt-3 font-semibold text-foreground">
                  {view === "in_progress"
                    ? "Nenhuma Sessão em andamento"
                    : spaceFilter === "all"
                      ? "Nenhuma Sessão neste dia"
                      : "Nenhuma Sessão neste Espaço"}
                </p>
                {view === "day" && <button
                  className="mt-4 text-sm font-semibold text-primary"
                  onClick={openCreateSession}
                >
                  Agendar a primeira Sessão
                </button>}
              </div>
            )}
          {displayedSessions.data?.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              clientName={clientsById.get(session.responsible_client_id)?.name ?? "Cliente desconhecido"}
              clientPhone={clientsById.get(session.responsible_client_id)?.phone ?? ""}
              spaces={session.space_ids.map(
                (id) => spaceNames.get(id) ?? "Espaço desconhecido",
              )}
              onAction={(action) =>
                transition.mutate({ id: session.id, action })
              }
              pending={transition.isPending}
              returnTo={`/agenda?${new URLSearchParams({ date: day, space: spaceFilter, view })}`}
            />
          ))}
        </section>
        </div>
        </div>

        {creating && (
          <FormModal title="Nova Sessão" onClose={() => setCreating(false)} size="lg">
            <form
              className="w-full p-6"
              onSubmit={submit}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Nova Sessão</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A Sessão nasce Agendada e deve utilizar ao menos um Espaço.
                  </p>
                </div>
                <ModalCloseButton onClick={() => setCreating(false)} />
              </div>
              <label className="mt-6 block text-sm font-semibold text-foreground">
                Cliente Responsável
                <Combobox
                  value={responsibleId}
                  onValueChange={setResponsibleId}
                  options={(clients.data ?? [])
                    .filter((client) => client.administrative_status === "active")
                    .map((client) => ({
                      value: client.id,
                      label: client.name,
                      detail: client.phone ? formatPhone(client.phone) : "Não informado",
                      detailIcon: <Phone className="size-3.5" />,
                    }))}
                  placeholder="Selecione o Cliente"
                  searchPlaceholder="Buscar Cliente..."
                  onOptionEdit={openClientEdit}
                />
              </label>
              <fieldset className="mt-5">
                <legend className="text-sm font-semibold text-foreground">
                  Espaços
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {spaces.data
                    ?.filter((space) => space.administrative_status === "active")
                    .map((space) => (
                    <label
                      key={space.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${spaceIds.includes(space.id) ? "border-primary bg-secondary" : "border-border"}`}
                    >
                      <Checkbox
                        checked={spaceIds.includes(space.id)}
                        onCheckedChange={() =>
                          setSpaceIds((current) =>
                            current.includes(space.id)
                              ? current.filter((id) => id !== space.id)
                              : [...current, space.id],
                          )
                        }
                      />
                      <MapPin size={17} className="text-primary" />
                      <span>
                        {space.name}
                        <small className="ml-2 text-primary">Ativo</small>
                      </span>
                    </label>
                    ))}
                </div>
              </fieldset>
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-foreground">Data e período previstos</p>
                <SessionSchedulePicker start={period.start} end={period.end} onChange={setPeriod} />
              </div>
              <div className="mt-7 flex justify-end gap-2">
                <button
                  className="operation-button"
                  type="button"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
                <button
                  className="operation-button operation-button-primary"
                  disabled={!valid || create.isPending}
                >
                  Agendar Sessão
                </button>
              </div>
            </form>
          </FormModal>
        )}

        {editingClient && (
          <FormModal title="Editar Cliente" onClose={() => setEditingClient(null)} size="md">
            <form
              className="w-full p-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (clientDraft.name.trim()) saveClient.mutate();
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Editar Cliente</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Atualize os dados de contato sem sair do agendamento.
                  </p>
                </div>
                <ModalCloseButton onClick={() => setEditingClient(null)} />
              </div>
              <div className="mt-6 grid gap-4">
                <label className="text-sm font-semibold text-foreground">
                  Nome
                  <Input
                    className="mt-2"
                    value={clientDraft.name}
                    onChange={(event) => setClientDraft((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="text-sm font-semibold text-foreground">
                  Telefone
                  <Input
                    className="mt-2"
                    inputMode="tel"
                    maxLength={15}
                    placeholder="(00) 00000-0000"
                    value={clientDraft.phone}
                    onChange={(event) => setClientDraft((current) => ({ ...current, phone: formatPhone(event.target.value) }))}
                  />
                </label>
                <label className="text-sm font-semibold text-foreground">
                  E-mail
                  <Input
                    className="mt-2"
                    type="email"
                    value={clientDraft.email}
                    onChange={(event) => setClientDraft((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label className="text-sm font-semibold text-foreground">
                  Observações
                  <Textarea
                    className="mt-2"
                    value={clientDraft.notes}
                    onChange={(event) => setClientDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-7 flex justify-end gap-2">
                <button className="operation-button" type="button" onClick={() => setEditingClient(null)}>
                  Cancelar
                </button>
                <button
                  className="operation-button operation-button-primary"
                  disabled={!clientDraft.name.trim() || saveClient.isPending}
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </FormModal>
        )}
      </main>
    </AppShell>
  );
}

function SessionCard({
  session,
  clientName,
  clientPhone,
  spaces,
  onAction,
  pending,
  returnTo,
}: {
  session: ArenaSession;
  clientName: string;
  clientPhone: string;
  spaces: string[];
  onAction: (action: "confirm" | "start" | "cancel" | "no_show") => void;
  pending: boolean;
  returnTo: string;
}) {
  const time = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 gap-4">
          <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary py-3 text-primary">
            <strong>{time(session.scheduled_start)}</strong>
            <span className="mt-1 text-sm text-primary">
              {time(session.scheduled_end)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words font-semibold [overflow-wrap:anywhere]">{clientName}</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[session.status]}`}
              >
                {statusLabels[session.status]}
              </span>
            </div>
            <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin size={16} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words [overflow-wrap:anywhere]">{spaces.join(" · ")}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Phone size={16} className="shrink-0" /> {clientPhone ? formatPhone(clientPhone) : "Telefone não informado"}</p>
              <p className="flex items-center gap-2"><Clock3 size={16} className="shrink-0" /> {formatDuration(session.scheduled_start, session.scheduled_end)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Link
            className="operation-button"
            to={`/sessoes/${session.id}?returnTo=${encodeURIComponent(returnTo)}`}
          >
            Ver dossiê
          </Link>
          {session.status === "scheduled" && (
            <button
              className="operation-button"
              disabled={pending}
              onClick={() => onAction("confirm")}
            >
              Confirmar
            </button>
          )}
          {(session.status === "scheduled" ||
            session.status === "confirmed") && (
            <button
              className="operation-button operation-button-primary"
              disabled={pending}
              onClick={() => onAction("start")}
            >
              Iniciar
            </button>
          )}
          {["scheduled", "confirmed", "in_progress"].includes(
            session.status,
          ) && (
            <ConfirmationAlertDialog
              title="Cancelar Sessão?"
              description={`Ao cancelar, se a Sessão ainda não tiver eventos associados, a agenda será excluída definitivamente. Sessões com histórico operacional serão preservadas como canceladas.${session.status === "scheduled" || session.status === "confirmed" ? " Se o Cliente não veio, escolha Não compareceu para registrar a ausência e preservar a Sessão." : ""}`}
              confirmLabel="Cancelar"
              pending={pending}
              onConfirm={() => onAction("cancel")}
              alternativeAction={session.status === "scheduled" || session.status === "confirmed"
                ? { label: "Não compareceu", onSelect: () => onAction("no_show") }
                : undefined}
              trigger={<button className="operation-button" disabled={pending}>Cancelar</button>}
            />
          )}
        </div>
      </div>
    </article>
  );
}
