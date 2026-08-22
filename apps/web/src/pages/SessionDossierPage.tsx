import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CirclePlay, Clock3, Film, MapPin, UserRound } from "lucide-react";
import { type ReactNode, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AppShell } from "../components/AppShell";
import { getClients, getCurrentUser, getSessionDossier, getSpaces, replayUrl, type SessionStatus } from "../lib/api";

const statusLabels: Record<SessionStatus, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", in_progress: "Em andamento",
  finished: "Finalizada", archived: "Arquivada", cancelled: "Cancelada", no_show: "Não compareceu",
};
const eventLabels: Record<string, string> = {
  SessionCreated: "Sessão criada",
  SessionConfirmed: "Sessão confirmada",
  SessionStarted: "Sessão iniciada",
  SessionExtended: "Sessão prorrogada",
  SessionFinished: "Sessão finalizada",
  SessionCancelled: "Sessão cancelada",
  SessionMarkedNoShow: "Não comparecimento registrado",
  MomentRequested: "Momento solicitado",
  ReplayGenerated: "Replay gerado",
  ReplayGenerationFailed: "Falha ao gerar Replay",
};
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export function SessionDossierPage() {
  const { sessionId = "" } = useParams(); const navigate = useNavigate();
  const user = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const dossier = useQuery({ queryKey: ["session-dossier", sessionId], queryFn: () => getSessionDossier(sessionId), enabled: Boolean(sessionId), refetchInterval: (query) => query.state.data?.moments.some((moment) => !["ready", "failed"].includes(moment.status)) ? 3000 : false });
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const spaces = useQuery({ queryKey: ["spaces"], queryFn: getSpaces });
  useEffect(() => { if (user.isError) navigate("/login", { replace: true }); }, [navigate, user.isError]);
  const clientNames = useMemo(() => new Map((clients.data ?? []).map((client) => [client.id, client.name])), [clients.data]);
  const spaceNames = useMemo(() => new Map((spaces.data ?? []).map((space) => [space.id, space.name])), [spaces.data]);

  if (dossier.isLoading || user.isLoading) return <AppShell user={user.data}><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" /></main></AppShell>;
  if (dossier.isError || !dossier.data) return <AppShell user={user.data}><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link className="operation-button" to="/agenda"><ArrowLeft size={16} /> Agenda</Link><div className="mt-6 rounded-2xl border border-rose-200 bg-white p-8 text-rose-800">Não foi possível carregar o Dossiê da Sessão.</div></main></AppShell>;
  const session = dossier.data;
  return <AppShell user={user.data}><main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700" to="/agenda"><ArrowLeft size={16} /> Voltar para Agenda</Link>
    <header className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-semibold tracking-wide text-emerald-700">DOSSIÊ DA SESSÃO</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Sessão #{session.id.slice(0, 8).toUpperCase()}</h1></div><span className="w-fit rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">{statusLabels[session.status]}</span></header>
    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Info icon={<UserRound size={19} />} label="Responsável" value={clientNames.get(session.responsible_client_id) ?? "Cliente desconhecido"} />
      <Info icon={<MapPin size={19} />} label="Espaços" value={session.space_ids.map((id) => spaceNames.get(id) ?? "Espaço desconhecido").join(" · ")} />
      <Info icon={<CalendarClock size={19} />} label="Período previsto" value={`${dateTime(session.scheduled_start)} — ${dateTime(session.scheduled_end)}`} />
      <Info icon={<Clock3 size={19} />} label="Período real" value={`${dateTime(session.actual_start)} — ${dateTime(session.actual_end)}`} />
    </section>
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <section><div className="flex items-center gap-2"><Film className="text-emerald-700" size={21} /><h2 className="text-xl font-semibold">Momentos e Replays</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{session.moments.length}</span></div>
        {!session.moments.length && <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhum Momento registrado nesta Sessão.</div>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">{session.moments.map((moment) => <article key={moment.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{moment.status === "ready" ? <video className="aspect-video w-full bg-black" src={replayUrl(moment.id)} controls preload="metadata" /> : <div className="grid aspect-video place-items-center bg-slate-950 text-slate-300"><div className="text-center"><CirclePlay className="mx-auto" size={32} /><p className="mt-2 text-sm">{moment.status === "failed" ? "Falha no processamento" : "Replay em processamento"}</p></div></div>}<div className="p-4"><p className="font-semibold">Momento às {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(moment.occurred_at))}</p><p className="mt-1 text-xs text-slate-500">{spaceNames.get(moment.space_id) ?? "Espaço desconhecido"} · {moment.status}</p></div></article>)}</div>
      </section>
      <section><h2 className="text-xl font-semibold">Timeline</h2><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{!session.timeline.length && <p className="text-sm text-slate-500">Nenhum evento registrado.</p>}<ol className="space-y-5">{session.timeline.map((entry, index) => <li key={`${entry.kind}-${entry.occurred_at}-${index}`} className="relative flex gap-3 before:absolute before:left-[5px] before:top-5 before:h-[calc(100%+4px)] before:w-px before:bg-slate-200 last:before:hidden"><span className="relative mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-600 ring-4 ring-emerald-50" /><div><p className="text-sm font-semibold">{eventLabels[entry.kind] ?? entry.kind}</p><time className="mt-1 block text-xs text-slate-400">{dateTime(entry.occurred_at)}</time></div></li>)}</ol></div></section>
    </div>
  </main></AppShell>;
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-emerald-700">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div><p className="mt-3 text-sm font-semibold leading-relaxed text-slate-800">{value}</p></article>;
}
