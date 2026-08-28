import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Radio,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { DatePicker } from "../components/ui/date-picker";
import { ConfirmationAlertDialog } from "../components/ui/confirmation-alert-dialog";
import { Combobox } from "../components/ui/combobox";
import { Checkbox } from "../components/ui/checkbox";
import { SessionSchedulePicker } from "../components/ui/session-schedule-picker";
import {
  createSession,
  getClients,
  getCurrentUser,
  getInProgressSessions,
  getSessions,
  getSpaces,
  transitionSession,
  type ArenaSession,
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
  scheduled: "bg-sky-100 text-sky-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-emerald-700 text-white",
  finished: "bg-slate-200 text-slate-700",
  archived: "bg-slate-100 text-slate-500",
  cancelled: "bg-rose-100 text-rose-800",
  no_show: "bg-amber-100 text-amber-800",
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

export function AgendaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => {
    const requestedDay = searchParams.get("date");
    return requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay)
      ? requestedDay
      : dateInput(new Date());
  });
  const [creating, setCreating] = useState(false);
  const [responsibleId, setResponsibleId] = useState("");
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [period, setPeriod] = useState(initialPeriod);
  const [view, setView] = useState<"day" | "in_progress">("day");
  const window = useMemo(() => dayWindow(day), [day]);
  const user = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const spaces = useQuery({ queryKey: ["spaces"], queryFn: getSpaces });
  const sessions = useQuery({
    queryKey: ["agenda", day],
    queryFn: () => getSessions(window.start, window.end),
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
  const clientNames = useMemo(
    () =>
      new Map((clients.data ?? []).map((client) => [client.id, client.name])),
    [clients.data],
  );
  const spaceNames = useMemo(
    () => new Map((spaces.data ?? []).map((space) => [space.id, space.name])),
    [spaces.data],
  );
  const moveDay = (amount: number) => {
    const next = new Date(`${day}T12:00:00`);
    next.setDate(next.getDate() + amount);
    setDay(dateInput(next));
  };
  const openCreateSession = () => {
    setPeriod(initialPeriodForDay(day));
    setCreating(true);
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
      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold tracking-wide text-emerald-700">
              AGENDA
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Sessões da Arena
            </h1>
            <p className="mt-2 text-slate-500">
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
        {view === "day" ? <section className="mt-7 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2">
            <button
              className="rounded-lg p-2 hover:bg-slate-100"
              onClick={() => moveDay(-1)}
              aria-label="Dia anterior"
            >
              <ChevronLeft />
            </button>
            <DatePicker value={day} onChange={setDay} markedDates={markedDates} />
            <button
              className="rounded-lg p-2 hover:bg-slate-100"
              onClick={() => moveDay(1)}
              aria-label="Próximo dia"
            >
              <ChevronRight />
            </button>
          </div>
          <button
            className="text-sm font-semibold text-emerald-700"
            onClick={() => setDay(dateInput(new Date()))}
          >
            Hoje
          </button>
        </section> : <section className="mt-7 flex items-center gap-3 rounded-2xl bg-secondary px-5 py-4 text-primary"><span className="grid size-9 place-items-center rounded-xl bg-card"><Radio size={18} /></span><div><p className="font-semibold">Sessões em andamento</p><p className="text-sm text-muted-foreground">Exibindo todas as Sessões atualmente em curso na Arena.</p></div></section>}

        <section className="mt-5 space-y-3">
          {displayedSessions.isLoading &&
            [1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          {displayedSessions.isError && (
            <div className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-800">
              Não foi possível carregar a Agenda.
            </div>
          )}
          {!displayedSessions.isLoading &&
            !displayedSessions.isError &&
            !displayedSessions.data?.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <CalendarDays className="mx-auto text-slate-300" size={36} />
                <p className="mt-3 font-semibold text-slate-600">
                  {view === "in_progress" ? "Nenhuma Sessão em andamento" : "Nenhuma Sessão neste dia"}
                </p>
                {view === "day" && <button
                  className="mt-4 text-sm font-semibold text-emerald-700"
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
              clientName={
                clientNames.get(session.responsible_client_id) ??
                "Cliente desconhecido"
              }
              spaces={session.space_ids.map(
                (id) => spaceNames.get(id) ?? "Espaço desconhecido",
              )}
              onAction={(action) =>
                transition.mutate({ id: session.id, action })
              }
              pending={transition.isPending}
              agendaDate={day}
            />
          ))}
        </section>

        {creating && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-5 py-8">
            <form
              className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
              onSubmit={submit}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Nova Sessão</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    A Sessão nasce Agendada e deve utilizar ao menos um Espaço.
                  </p>
                </div>
                <button
                  className="text-sm font-semibold text-slate-500"
                  type="button"
                  onClick={() => setCreating(false)}
                >
                  Fechar
                </button>
              </div>
              <label className="mt-6 block text-sm font-semibold text-slate-600">
                Cliente Responsável
                <Combobox
                  value={responsibleId}
                  onValueChange={setResponsibleId}
                  options={(clients.data ?? []).map((client) => ({ value: client.id, label: client.name }))}
                  placeholder="Selecione o Cliente"
                  searchPlaceholder="Buscar Cliente..."
                />
              </label>
              <fieldset className="mt-5">
                <legend className="text-sm font-semibold text-slate-600">
                  Espaços
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {spaces.data
                    ?.filter((space) => space.administrative_status === "active")
                    .map((space) => (
                    <label
                      key={space.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${spaceIds.includes(space.id) ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}
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
                      <MapPin size={17} className="text-emerald-700" />
                      <span>
                        {space.name}
                        <small className="ml-2 text-emerald-600">Ativo</small>
                      </span>
                    </label>
                    ))}
                </div>
              </fieldset>
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-600">Data e período previstos</p>
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
          </div>
        )}
      </main>
    </AppShell>
  );
}

function SessionCard({
  session,
  clientName,
  spaces,
  onAction,
  pending,
  agendaDate,
}: {
  session: ArenaSession;
  clientName: string;
  spaces: string[];
  onAction: (action: "confirm" | "start" | "cancel" | "no_show") => void;
  pending: boolean;
  agendaDate: string;
}) {
  const time = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 gap-4">
          <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-950 py-3 text-white">
            <strong>{time(session.scheduled_start)}</strong>
            <span className="mt-1 text-xs text-slate-300">
              {time(session.scheduled_end)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{clientName}</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[.68rem] font-semibold ${statusClasses[session.status]}`}
              >
                {statusLabels[session.status]}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <MapPin size={15} /> {spaces.join(" · ")}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <UserRound size={14} /> Responsável · <Clock3 size={14} /> período
              previsto
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="operation-button"
            to={`/sessoes/${session.id}?agendaDate=${encodeURIComponent(agendaDate)}`}
          >
            Ver dossiê
          </Link>
          {session.status === "scheduled" && (
            <button
              className="operation-button"
              disabled={pending}
              onClick={() => onAction("confirm")}
            >
              <Check size={16} /> Confirmar
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
          {(session.status === "scheduled" ||
            session.status === "confirmed") && (
            <button
              className="operation-button"
              disabled={pending}
              onClick={() => onAction("no_show")}
            >
              Não compareceu
            </button>
          )}
          {["scheduled", "confirmed", "in_progress"].includes(
            session.status,
          ) && (
            <ConfirmationAlertDialog
              title="Cancelar Sessão?"
              description="Se a Sessão ainda não tiver eventos associados, a agenda será excluída definitivamente. Sessões com histórico operacional serão preservadas como canceladas."
              confirmLabel="Cancelar Sessão"
              pending={pending}
              onConfirm={() => onAction("cancel")}
              trigger={<button className="operation-button" disabled={pending}>Cancelar</button>}
            />
          )}
        </div>
      </div>
    </article>
  );
}
