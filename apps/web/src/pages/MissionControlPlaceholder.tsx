import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Play, Radio, Square, TimerReset, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Combobox } from "../components/ui/combobox";
import { extendSession, getClients, getCurrentUser, getSessions, getSpaces, subscribeToOperationalEvents, transitionSession, type ArenaSession } from "../lib/api";

const activeStatuses = new Set(["scheduled", "confirmed", "in_progress"]);
const formatTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor(Math.abs(ms) / 60_000));
  return total >= 60 ? `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}min` : `${total} min`;
};

type OperationalState = "available" | "in_progress" | "ending" | "overdue" | "unavailable";
type SpaceStatusFilter = "all" | OperationalState;

function getState(session: ArenaSession | undefined, administrativeStatus: string, now: Date): OperationalState {
  if (administrativeStatus !== "active") return "unavailable";
  if (!session || session.status !== "in_progress") return "available";
  const remaining = new Date(session.scheduled_end).getTime() - now.getTime();
  if (remaining < 0) return "overdue";
  return remaining <= 10 * 60_000 ? "ending" : "in_progress";
}

const presentation = {
  available: { label: "Disponível", card: "border-border bg-card", dot: "bg-border" },
  in_progress: { label: "Em Sessão", card: "border-secondary bg-secondary/40", dot: "bg-mint" },
  ending: { label: "Encerrando", card: "border-warning-border bg-warning-muted/60", dot: "bg-warning" },
  overdue: { label: "Excedido", card: "border-danger-border bg-danger-muted/60", dot: "bg-destructive" },
  unavailable: { label: "Indisponível", card: "border-border bg-muted", dot: "bg-muted-foreground" },
} satisfies Record<OperationalState, { label: string; card: string; dot: string }>;

export function MissionControlPlaceholder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const spaceStatusFilter: SpaceStatusFilter = requestedStatus === "all" || (requestedStatus !== null && Object.hasOwn(presentation, requestedStatus))
    ? requestedStatus as SpaceStatusFilter
    : "available";
  const setSpaceStatusFilter = (value: SpaceStatusFilter) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("status", value);
      return next;
    }, { replace: true });
  };
  const [realTimeConnected, setRealTimeConnected] = useState(false);
  const day = useMemo(() => {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { start, end };
  }, [now]);

  useEffect(() => { const timer = globalThis.setInterval(() => setNow(new Date()), 30_000); return () => globalThis.clearInterval(timer); }, []);
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const spacesQuery = useQuery({ queryKey: ["spaces"], queryFn: getSpaces });
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const sessionsQuery = useQuery({ queryKey: ["sessions", day.start.toISOString()], queryFn: () => getSessions(day.start, day.end), refetchInterval: realTimeConnected ? false : 15_000 });
  useEffect(() => { if (userQuery.isError) navigate("/login", { replace: true }); }, [navigate, userQuery.isError]);
  useEffect(() => {
    if (!userQuery.data) return;
    return subscribeToOperationalEvents(
      (event) => queryClient.invalidateQueries({ queryKey: [event.resource] }),
      setRealTimeConnected,
    );
  }, [queryClient, userQuery.data]);

  const action = useMutation({
    mutationFn: ({ session, kind }: { session: ArenaSession; kind: "start" | "finish" | "cancel" | "extend" }) => kind === "extend" ? extendSession(session) : transitionSession(session.id, kind),
    onSuccess: (_result, { kind }) => {
      const messages = { start: "Sessão iniciada.", finish: "Sessão finalizada.", cancel: "Sessão cancelada.", extend: "Sessão prorrogada em 30 minutos." };
      toast.success(messages[kind]);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a Sessão."),
  });

  const sessions = sessionsQuery.data ?? [];
  const spaces = spacesQuery.data ?? [];
  const clients = new Map((clientsQuery.data ?? []).map((client) => [client.id, client.name]));
  const currentBySpace = new Map<string, ArenaSession>();
  const upcomingBySpace = new Map<string, ArenaSession>();
  for (const session of sessions.filter((item) => activeStatuses.has(item.status)).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))) {
    for (const spaceId of session.space_ids) {
      if (session.status === "in_progress") currentBySpace.set(spaceId, session);
      else if (new Date(session.scheduled_start) >= now && !upcomingBySpace.has(spaceId)) upcomingBySpace.set(spaceId, session);
    }
  }
  const activeCount = new Set([...currentBySpace.values()].map((session) => session.id)).size;
  const attentionCount = spaces.filter((space) => ["ending", "overdue"].includes(getState(currentBySpace.get(space.id), space.administrative_status, now))).length;
  const filteredSpaces = spaces.filter((space) => spaceStatusFilter === "all" || getState(currentBySpace.get(space.id), space.administrative_status, now) === spaceStatusFilter);
  const loading = spacesQuery.isLoading || sessionsQuery.isLoading || clientsQuery.isLoading || userQuery.isLoading;
  const loadError = spacesQuery.error || sessionsQuery.error || clientsQuery.error;
  return <AppShell user={userQuery.data}>
    <main className="page-shell">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-semibold tracking-wide text-primary">OPERAÇÃO AO VIVO</p><h1 className="page-heading">Visão geral da arena</h1><p className="mt-2 text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(now)} · {formatTime(now.toISOString())}</p></div><div className={`flex items-center gap-2 text-sm font-medium ${realTimeConnected ? "text-primary" : "text-warning-foreground"}`}><Radio size={16} /> {realTimeConnected ? "Tempo real conectado" : "Reconectando · atualização automática"}</div></section>
      <button type="button" aria-pressed={spaceStatusFilter === "in_progress"} onClick={() => setSpaceStatusFilter("in_progress")} className={`mt-8 w-full cursor-pointer rounded-2xl border p-5 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${attentionCount ? "border-warning-border bg-warning-muted" : "border-secondary bg-secondary"}`}><div className="flex items-start gap-3">{attentionCount ? <AlertTriangle className="mt-0.5 text-warning-foreground" size={21} /> : <CheckCircle2 className="mt-0.5 text-primary" size={21} />}<div><p className="font-semibold">{attentionCount ? `${attentionCount} Espaço${attentionCount > 1 ? "s precisam" : " precisa"} de atenção` : "Arena operando normalmente"}</p><p className="mt-1 text-sm text-foreground">{activeCount} {activeCount === 1 ? "Sessão" : "Sessões"} em andamento agora.</p></div></div></button>
      <section className="mt-8"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-semibold">Espaços</h2><div className="flex min-h-9 items-center gap-2 text-sm font-medium text-foreground"><span className="shrink-0 leading-none">Status</span><Combobox className="mt-0 h-9 w-52 shrink-0" value={spaceStatusFilter} onValueChange={(value) => setSpaceStatusFilter(value as SpaceStatusFilter)} options={[{ value: "all", label: `Todos (${spaces.length})` }, ...Object.entries(presentation).map(([status, item]) => ({ value: status, label: `${item.label} (${spaces.filter((space) => getState(currentBySpace.get(space.id), space.administrative_status, now) === status).length})` }))]} searchPlaceholder="Buscar status..." /></div></div>
        {loading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-border bg-card" />)}</div>}
        {loadError && <div className="rounded-2xl border border-danger-border bg-card p-8 text-center text-destructive">Não foi possível carregar a operação. Uma nova tentativa será feita automaticamente.</div>}
        {!loading && !loadError && spaces.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Nenhum Espaço cadastrado.</div>}
        {!loading && !loadError && spaces.length > 0 && filteredSpaces.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Nenhum Espaço com o status selecionado.</div>}
        {!loading && !loadError && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredSpaces.map((space) => {
          const current = currentBySpace.get(space.id); const upcoming = upcomingBySpace.get(space.id); const displayed = current ?? upcoming;
          const state = getState(current, space.administrative_status, now); const style = presentation[state];
          return <article key={space.id} className={`flex min-h-64 flex-col rounded-2xl border p-5 shadow-sm ${style.card}`}>
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">{space.name}</h3><span className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground"><span className={`h-2 w-2 rounded-full ${style.dot}`} />{style.label}</span></div>{current && <span className="rounded-lg bg-card/80 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm">#{current.id.slice(0,6).toUpperCase()}</span>}</div>
            {!displayed ? <div className="flex flex-1 flex-col items-center justify-center py-7 text-center text-muted-foreground"><CalendarClock size={28} /><p className="mt-3 text-sm">Sem Sessões previstas hoje</p></div> : <div className="mt-6 flex flex-1 flex-col">
              <div className="space-y-3 text-sm text-foreground"><p className="flex items-center gap-2"><Users size={16} />{clients.get(displayed.responsible_client_id) ?? "Responsável não identificado"}</p><p className="flex items-center gap-2"><Clock3 size={16} />{formatTime(displayed.scheduled_start)} — {formatTime(displayed.scheduled_end)}</p></div>
              <div className="mt-5 border-t border-border/80 pt-4">{current ? <p className={`text-2xl font-semibold ${state === "overdue" ? "text-destructive" : state === "ending" ? "text-warning-foreground" : "text-foreground"}`}>{state === "overdue" ? `+ ${formatDuration(now.getTime() - new Date(current.scheduled_end).getTime())}` : formatDuration(new Date(current.scheduled_end).getTime() - now.getTime())}<span className="ml-2 text-xs font-medium text-muted-foreground">{state === "overdue" ? "excedido" : "restantes"}</span></p> : <p className="text-sm font-semibold text-foreground">Próxima Sessão às {formatTime(displayed.scheduled_start)}</p>}</div>
              <div className="mt-auto flex flex-wrap gap-2 pt-5"><button className="operation-button" onClick={() => navigate(`/sessoes/${displayed.id}?from=mission-control&status=${encodeURIComponent(spaceStatusFilter)}`)}>Dossiê</button>{!current && <button className="operation-button operation-button-primary" disabled={action.isPending} onClick={() => action.mutate({ session: displayed, kind: "start" })}><Play size={15} />Iniciar</button>}{current && <button className="operation-button" disabled={action.isPending} onClick={() => action.mutate({ session: current, kind: "extend" })}><TimerReset size={15} />+30 min</button>}{current && <button className="operation-button operation-button-primary" disabled={action.isPending} onClick={() => action.mutate({ session: current, kind: "finish" })}><Square size={14} />Finalizar</button>}<button className="operation-button operation-button-danger" disabled={action.isPending} onClick={() => action.mutate({ session: displayed, kind: "cancel" })}>Cancelar</button></div>
            </div>}
          </article>;
        })}</div>}
      </section>
    </main>
  </AppShell>;
}
