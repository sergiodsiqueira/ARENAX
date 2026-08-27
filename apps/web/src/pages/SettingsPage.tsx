import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Settings, Video } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getCurrentUser, getOperationalSettings, updateOperationalSettings } from "../lib/api";

type FormValues = {
  sessionMinutes: string;
  replayPreSeconds: string;
  replayPostSeconds: string;
};

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues | null>(null);
  const currentUser = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const settings = useQuery({
    queryKey: ["operational-settings"],
    queryFn: getOperationalSettings,
    enabled: Boolean(currentUser.data && currentUser.data.role !== "operador"),
  });

  useEffect(() => {
    if (currentUser.isError || currentUser.data?.role === "operador") navigate("/mission-control", { replace: true });
  }, [currentUser.data?.role, currentUser.isError, navigate]);

  const displayedForm = form ?? {
    sessionMinutes: settings.data ? String(settings.data.default_session_duration_minutes) : "",
    replayPreSeconds: settings.data ? String(settings.data.replay_pre_duration_seconds) : "",
    replayPostSeconds: settings.data ? String(settings.data.replay_post_duration_seconds) : "",
  };

  const values = {
    sessionMinutes: Number(displayedForm.sessionMinutes),
    replayPreSeconds: Number(displayedForm.replayPreSeconds),
    replayPostSeconds: Number(displayedForm.replayPostSeconds),
  };
  const valid = Number.isInteger(values.sessionMinutes) && values.sessionMinutes > 0
    && Number.isInteger(values.replayPreSeconds) && values.replayPreSeconds >= 0
    && Number.isInteger(values.replayPostSeconds) && values.replayPostSeconds >= 0
    && values.replayPreSeconds + values.replayPostSeconds > 0;
  const dirty = settings.data !== undefined && (
    values.sessionMinutes !== settings.data.default_session_duration_minutes
    || values.replayPreSeconds !== settings.data.replay_pre_duration_seconds
    || values.replayPostSeconds !== settings.data.replay_post_duration_seconds
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    globalThis.addEventListener("beforeunload", warn);
    return () => globalThis.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => updateOperationalSettings({
      default_session_duration_minutes: values.sessionMinutes,
      replay_pre_duration_seconds: values.replayPreSeconds,
      replay_post_duration_seconds: values.replayPostSeconds,
    }),
    onSuccess: (result) => {
      queryClient.setQueryData(["operational-settings"], result);
      setForm(null);
      toast.success("Configurações salvas com sucesso.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar as configurações."),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && dirty) save.mutate();
  };

  return <AppShell user={currentUser.data}>
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-emerald-700"><Settings size={17} /> ADMINISTRAÇÃO</p>
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-2 text-slate-500">Defina os padrões operacionais usados pela Arena.</p>
      </div>
      {settings.isLoading && <div className="mt-8 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />}
      {settings.isError && <div className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 text-rose-800">Não foi possível carregar as Configurações.</div>}
      {settings.data && <form className="mt-8" onSubmit={submit}>
        <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Clock3 size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Sessões</h2>
          <p className="mt-2 text-sm text-slate-500">Duração padrão usada ao criar uma nova Sessão.</p>
          <label className="mt-6 block text-sm font-semibold text-slate-600">
            Duração padrão de cada Sessão
            <div className="relative mt-2 max-w-xs"><Input className="pr-20" type="number" min="1" step="1" value={displayedForm.sessionMinutes} onChange={(event) => setForm({ ...displayedForm, sessionMinutes: event.target.value })} aria-describedby="session-duration-help" required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">minutos</span></div>
          </label>
          <p id="session-duration-help" className="mt-2 text-xs text-slate-500">Preenche o horário final; o operador poderá ajustá-lo antes de salvar.</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Video size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Replays</h2>
          <p className="mt-2 text-sm text-slate-500">Durações anterior e posterior ao acionamento.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-600">Antes do acionamento<div className="relative mt-2"><Input className="pr-24" type="number" min="0" step="1" value={displayedForm.replayPreSeconds} onChange={(event) => setForm({ ...displayedForm, replayPreSeconds: event.target.value })} required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">segundos</span></div></label>
            <label className="text-sm font-semibold text-slate-600">Depois do acionamento<div className="relative mt-2"><Input className="pr-24" type="number" min="0" step="1" value={displayedForm.replayPostSeconds} onChange={(event) => setForm({ ...displayedForm, replayPostSeconds: event.target.value })} required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">segundos</span></div></label>
          </div>
          <p className={`mt-3 text-xs ${valid ? "text-slate-500" : "text-rose-700"}`}>Duração total do Replay: {Number.isFinite(values.replayPreSeconds + values.replayPostSeconds) ? values.replayPreSeconds + values.replayPostSeconds : 0} segundos.</p>
        </section>
        </div>
        <div className="mt-6 flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500">Última atualização: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(settings.data.updated_at))}</p>
          <Button type="submit" disabled={!valid || !dirty || save.isPending}>{save.isPending ? "Salvando..." : "Salvar configurações"}</Button>
        </div>
      </form>}
    </main>
  </AppShell>;
}
