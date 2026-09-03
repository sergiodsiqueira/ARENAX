import { useQuery } from "@tanstack/react-query";
import { Activity, Camera, Check, CircleAlert, Copy, Database, HardDrive, Radio, RefreshCw, Server, Video } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { getCurrentUser, getHealthCenter, type HealthStatus } from "../lib/api";

const statusInfo: Record<HealthStatus, { label: string; classes: string; dot: string }> = {
  healthy: { label: "Saudável", classes: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  attention: { label: "Atenção", classes: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  degraded: { label: "Atenção", classes: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  critical: { label: "Crítico", classes: "bg-rose-50 text-rose-800", dot: "bg-rose-500" },
  unavailable: { label: "Indisponível", classes: "bg-rose-50 text-rose-800", dot: "bg-rose-500" },
  unknown: { label: "Sem sinal", classes: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  inactive: { label: "Inativa", classes: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

const icons = { api: Server, database: Database, mediamtx: Video, "capture-service": Camera, "replay-worker": Radio, storage: HardDrive };
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "Nenhum sinal recebido";
const formatBytes = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }).format(value / 1024 ** 3);

function StatusBadge({ status }: { status: HealthStatus }) {
  const info = statusInfo[status];
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${info.classes}`}><span className={`h-2 w-2 rounded-full ${info.dot}`} />{info.label}</span>;
}

export function HealthCenterPage() {
  const navigate = useNavigate();
  const user = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const health = useQuery({
    queryKey: ["health-center"],
    queryFn: getHealthCenter,
    enabled: Boolean(user.data),
    refetchInterval: 15_000,
  });
  useEffect(() => {
    if (user.isError) navigate("/login", { replace: true });
  }, [navigate, user.isError]);

  const activeCameras = health.data?.cameras.filter((item) => item.administrative_status === "active") ?? [];
  const affected = activeCameras.filter((item) => item.status !== "healthy").length;
  const headline = health.data?.status === "healthy" ? "Infraestrutura operacional" : health.data?.status === "attention" ? "Infraestrutura requer atenção" : "Falhas afetam a operação";
  const configuredAxDeviceUrl = health.data?.ax_device_api_url;
  const axDeviceUrl = configuredAxDeviceUrl ?? "Endereço não configurado";

  async function copyAxDeviceUrl() {
    if (!configuredAxDeviceUrl) {
      toast.error("Configure ARENAX_AX_DEVICE_API_URL com o IP do servidor na rede local.");
      return;
    }
    try {
      await navigator.clipboard.writeText(axDeviceUrl);
      toast.success("Endereço do AX Device copiado.");
    } catch {
      toast.error("Não foi possível copiar o endereço. Selecione-o e copie manualmente.");
    }
  }

  return <AppShell user={user.data}>
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Activity size={17} /> OPERAÇÃO</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Health Center</h1><p className="mt-2 text-slate-500">Saúde dos serviços e equipamentos que sustentam a operação da Arena.</p></div>
        <Button variant="outline" onClick={() => health.refetch()} disabled={health.isFetching}><RefreshCw className={health.isFetching ? "animate-spin" : ""} size={16} /> Atualizar</Button>
      </header>

      {health.isLoading && <div className="mt-8 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />}
      {health.isError && <div className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 text-rose-800"><strong>Não foi possível consultar a infraestrutura.</strong><p className="mt-1 text-sm">Verifique a conexão com a API e tente novamente.</p></div>}
      {health.data && <>
        <section className={`mt-8 flex flex-col gap-5 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between ${health.data.status === "healthy" ? "border-emerald-200 bg-emerald-50" : health.data.status === "attention" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"}`}>
          <div className="flex items-start gap-4"><span className="rounded-xl bg-white p-3 shadow-sm">{health.data.status === "healthy" ? <Activity className="text-emerald-700" /> : <CircleAlert className={health.data.status === "critical" ? "text-rose-700" : "text-amber-700"} />}</span><div><h2 className="text-xl font-semibold">{headline}</h2><p className="mt-1 text-sm text-slate-600">{affected ? `${affected} Câmera${affected > 1 ? "s" : ""} ativa${affected > 1 ? "s" : ""} requer${affected > 1 ? "em" : ""} atenção.` : "Nenhuma Câmera ativa apresenta falha."}</p></div></div>
          <div className="text-sm text-slate-500">Verificado em {formatDate(health.data.checked_at)}</div>
        </section>

        <section className="mt-8"><h2 className="text-lg font-semibold">Serviços e infraestrutura</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{health.data.services.map((service) => { const Icon = icons[service.name as keyof typeof icons] ?? Server; return <article key={service.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Icon size={21} /></span><StatusBadge status={service.status} /></div><h3 className="mt-4 font-semibold">{service.label}</h3><p className="mt-1 min-h-5 text-xs text-slate-500">{service.detail ?? formatDate(service.checked_at)}</p>{service.name === "api" && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-600">Endereço para configurar o AX Device</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 select-all break-all text-xs text-slate-700">{axDeviceUrl}</code><Button type="button" variant="outline" size="icon" className="shrink-0" onClick={copyAxDeviceUrl} aria-label="Copiar endereço do AX Device" title="Copiar endereço"><Copy size={15} /><Check className="hidden" size={15} /></Button></div></div>}{service.name === "storage" && <div className="mt-4"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>{service.used_percent ?? 0}% utilizado</span><span>{formatBytes(service.free_bytes)} livres</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${(service.used_percent ?? 0) >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(service.used_percent ?? 0, 100)}%` }} /></div></div>}{service.response_time_ms !== null && <p className="mt-3 text-xs text-slate-400">Resposta em {service.response_time_ms} ms</p>}</article>; })}</div></section>

        <section className="mt-8"><div className="flex items-end justify-between"><div><h2 className="text-lg font-semibold">Câmeras por Espaço</h2><p className="mt-1 text-sm text-slate-500">O sinal indica se a captura contínua está disponível para gerar Replays.</p></div><span className="text-sm text-slate-500">{activeCameras.length} ativa{activeCameras.length !== 1 ? "s" : ""}</span></div><div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{health.data.cameras.map((camera) => <div key={camera.camera_id} className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="rounded-xl bg-slate-50 p-2.5 text-emerald-700"><Camera size={20} /></span><div><p className="font-semibold">{camera.external_id}</p><p className="text-xs text-slate-500">{camera.space_name} · {camera.detail ?? formatDate(camera.checked_at)}</p></div></div><StatusBadge status={camera.status} /></div>)}{health.data.cameras.length === 0 && <p className="p-10 text-center text-slate-500">Nenhuma Câmera cadastrada.</p>}</div></section>
      </>}
    </main>
  </AppShell>;
}
