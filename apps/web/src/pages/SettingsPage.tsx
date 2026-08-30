import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock3, FolderOpen, HardDrive, Settings, Video } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { ConfirmationAlertDialog } from "../components/ui/confirmation-alert-dialog";
import { Input } from "../components/ui/input";
import { applyReplayStorageFolder, getCurrentUser, getOperationalSettings, lookupPostalCode, selectReplayStorageFolder, updateOperationalSettings } from "../lib/api";

type FormValues = {
  sessionMinutes: string;
  replayPreSeconds: string;
  replayPostSeconds: string;
  calculateActualTime: boolean;
  removeAutomatically: boolean;
  retentionDays: string;
  companyTaxId: string;
  companyLegalName: string;
  companyTradeName: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  companyState: string;
  companyPhone: string;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const normalizeCnpj = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
const formatCnpj = (value: string) => {
  const normalized = normalizeCnpj(value);
  let formatted = normalized.slice(0, 2);
  if (normalized.length > 2) formatted += `.${normalized.slice(2, 5)}`;
  if (normalized.length > 5) formatted += `.${normalized.slice(5, 8)}`;
  if (normalized.length > 8) formatted += `/${normalized.slice(8, 12)}`;
  if (normalized.length > 12) formatted += `-${normalized.slice(12, 14)}`;
  return formatted;
};
const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};
const formatPostalCode = (value: string) => onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues | null>(null);
  const [selectedStoragePath, setSelectedStoragePath] = useState<string | null>(null);
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
    calculateActualTime: settings.data?.calculate_actual_time ?? true,
    removeAutomatically: settings.data?.replay_retention_days !== null,
    retentionDays: settings.data?.replay_retention_days ? String(settings.data.replay_retention_days) : "30",
    companyTaxId: formatCnpj(settings.data?.company_tax_id ?? ""),
    companyLegalName: settings.data?.company_legal_name ?? "",
    companyTradeName: settings.data?.company_trade_name ?? "",
    companyAddress: settings.data?.company_address ?? "",
    companyPostalCode: formatPostalCode(settings.data?.company_postal_code ?? ""),
    companyCity: settings.data?.company_city ?? "",
    companyState: settings.data?.company_state ?? "",
    companyPhone: formatPhone(settings.data?.company_phone ?? ""),
  };

  const values = {
    sessionMinutes: Number(displayedForm.sessionMinutes),
    replayPreSeconds: Number(displayedForm.replayPreSeconds),
    replayPostSeconds: Number(displayedForm.replayPostSeconds),
    calculateActualTime: displayedForm.calculateActualTime,
    retentionDays: displayedForm.removeAutomatically ? Number(displayedForm.retentionDays) : null,
    companyTaxId: normalizeCnpj(displayedForm.companyTaxId),
    companyLegalName: displayedForm.companyLegalName.trim(),
    companyTradeName: displayedForm.companyTradeName.trim(),
    companyAddress: displayedForm.companyAddress.trim(),
    companyPostalCode: onlyDigits(displayedForm.companyPostalCode),
    companyCity: displayedForm.companyCity.trim(),
    companyState: displayedForm.companyState.trim().toUpperCase(),
    companyPhone: onlyDigits(displayedForm.companyPhone),
  };
  const valid = Number.isInteger(values.sessionMinutes) && values.sessionMinutes > 0
    && Number.isInteger(values.replayPreSeconds) && values.replayPreSeconds >= 0
    && Number.isInteger(values.replayPostSeconds) && values.replayPostSeconds >= 0
    && values.replayPreSeconds + values.replayPostSeconds > 0;
  const retentionValid = values.retentionDays === null
    || (Number.isInteger(values.retentionDays) && values.retentionDays > 0);
  const companyValid = (!values.companyTaxId || /^[A-Z0-9]{12}\d{2}$/.test(values.companyTaxId))
    && (!values.companyPhone || [10, 11].includes(values.companyPhone.length))
    && (!values.companyPostalCode || values.companyPostalCode.length === 8)
    && (!values.companyState || values.companyState.length === 2);
  const dirty = settings.data !== undefined && (
    values.sessionMinutes !== settings.data.default_session_duration_minutes
    || values.replayPreSeconds !== settings.data.replay_pre_duration_seconds
    || values.replayPostSeconds !== settings.data.replay_post_duration_seconds
    || values.calculateActualTime !== settings.data.calculate_actual_time
    || values.retentionDays !== settings.data.replay_retention_days
    || values.companyTaxId !== settings.data.company_tax_id
    || values.companyLegalName !== settings.data.company_legal_name
    || values.companyTradeName !== settings.data.company_trade_name
    || values.companyAddress !== settings.data.company_address
    || values.companyPostalCode !== settings.data.company_postal_code
    || values.companyCity !== settings.data.company_city
    || values.companyState !== settings.data.company_state
    || values.companyPhone !== settings.data.company_phone
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
      calculate_actual_time: values.calculateActualTime,
      replay_retention_days: values.retentionDays,
      company_tax_id: values.companyTaxId,
      company_legal_name: values.companyLegalName,
      company_trade_name: values.companyTradeName,
      company_address: values.companyAddress,
      company_postal_code: values.companyPostalCode,
      company_city: values.companyCity,
      company_state: values.companyState,
      company_phone: values.companyPhone,
    }),
    onSuccess: (result) => {
      queryClient.setQueryData(["operational-settings"], result);
      setForm(null);
      toast.success("Configurações salvas com sucesso.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar as configurações."),
  });

  const chooseStorage = useMutation({
    mutationFn: selectReplayStorageFolder,
    onSuccess: (result) => {
      if (!result.cancelled && result.path) setSelectedStoragePath(result.path);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "O Agente Local não está disponível."),
  });

  const postalCodeLookup = useMutation({
    mutationFn: () => lookupPostalCode(values.companyPostalCode),
    onSuccess: (result) => {
      const address = [result.street, result.neighborhood].filter(Boolean).join(", ");
      setForm({
        ...displayedForm,
        companyPostalCode: formatPostalCode(result.postal_code),
        companyAddress: address,
        companyCity: result.city,
        companyState: result.state,
      });
      toast.success("Endereço encontrado pelo CEP.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP."),
  });

  const applyStorage = useMutation({
    mutationFn: () => applyReplayStorageFolder(selectedStoragePath ?? ""),
    onSuccess: (result) => {
      queryClient.setQueryData(["operational-settings"], (current: typeof settings.data) => current ? { ...current, media_storage_path: result.path } : current);
      setSelectedStoragePath(null);
      toast.success("Alteração iniciada. Os Replays estão sendo copiados; o sistema pode ficar indisponível por alguns instantes.", { duration: 8000 });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível alterar o armazenamento."),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && retentionValid && companyValid && dirty) save.mutate();
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
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Clock3 size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Sessões</h2>
          <p className="mt-2 text-sm text-slate-500">Duração padrão usada ao criar uma nova Sessão.</p>
          <label className="mt-6 block text-sm font-semibold text-slate-600">
            Duração padrão de cada Sessão
            <div className="relative mt-2 max-w-xs"><Input className="pr-20" type="number" min="1" step="1" value={displayedForm.sessionMinutes} onChange={(event) => setForm({ ...displayedForm, sessionMinutes: event.target.value })} aria-describedby="session-duration-help" required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">minutos</span></div>
          </label>
          <p id="session-duration-help" className="mt-2 text-xs text-slate-500">Preenche o horário final; o operador poderá ajustá-lo antes de salvar.</p>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <Checkbox checked={displayedForm.calculateActualTime} onCheckedChange={(checked) => setForm({ ...displayedForm, calculateActualTime: checked === true })} />
            <span><strong className="block text-slate-700">Calcular pelo tempo real de uso</strong><span className="mt-1 block text-xs font-normal text-slate-500">Ativado: usa os minutos entre início e fim reais. Desativado: usa o período previsto.</span></span>
          </label>
        </section>
        <section className="order-first rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Building2 size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Dados da Empresa</h2>
          <p className="mt-2 text-sm text-slate-500">Informações cadastrais que serão usadas futuramente na emissão de notas fiscais.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-600">CNPJ<Input className="mt-2 uppercase" maxLength={18} placeholder="00.000.000/0000-00" value={displayedForm.companyTaxId} onChange={(event) => setForm({ ...displayedForm, companyTaxId: formatCnpj(event.target.value) })} /></label>
            <label className="text-sm font-semibold text-slate-600">Nome<Input className="mt-2" maxLength={180} placeholder="Razão social" value={displayedForm.companyLegalName} onChange={(event) => setForm({ ...displayedForm, companyLegalName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-slate-600">Nome Fantasia<Input className="mt-2" maxLength={180} value={displayedForm.companyTradeName} onChange={(event) => setForm({ ...displayedForm, companyTradeName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-slate-600">Telefone<Input className="mt-2" inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" value={displayedForm.companyPhone} onChange={(event) => setForm({ ...displayedForm, companyPhone: formatPhone(event.target.value) })} /></label>
            <label className="text-sm font-semibold text-slate-600">CEP<div className="mt-2 flex gap-2"><Input inputMode="numeric" maxLength={9} placeholder="00000-000" value={displayedForm.companyPostalCode} onChange={(event) => setForm({ ...displayedForm, companyPostalCode: formatPostalCode(event.target.value) })} /><Button type="button" variant="outline" disabled={values.companyPostalCode.length !== 8 || postalCodeLookup.isPending} onClick={() => postalCodeLookup.mutate()}>{postalCodeLookup.isPending ? "Buscando..." : "Buscar CEP"}</Button></div></label>
            <div className="hidden md:block" aria-hidden="true" />
            <label className="text-sm font-semibold text-slate-600 md:col-span-2">Endereço<Input className="mt-2" maxLength={250} placeholder="Logradouro, número e complemento" value={displayedForm.companyAddress} onChange={(event) => setForm({ ...displayedForm, companyAddress: event.target.value })} /></label>
            <label className="flex flex-col text-sm font-semibold text-slate-600">Cidade<Input className="mt-2" maxLength={120} value={displayedForm.companyCity} onChange={(event) => setForm({ ...displayedForm, companyCity: event.target.value })} /></label>
            <label className="flex flex-col text-sm font-semibold text-slate-600">UF<Input className="mt-2 w-24 uppercase" maxLength={2} placeholder="SP" value={displayedForm.companyState} onChange={(event) => setForm({ ...displayedForm, companyState: event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() })} /></label>
          </div>
          {!companyValid && <p className="mt-3 text-xs text-rose-700">Confira o CNPJ (12 letras ou números e 2 dígitos verificadores), o CEP (8 dígitos), o telefone (10 ou 11 dígitos) e a UF (2 letras).</p>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><HardDrive size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Armazenamento de Replays</h2>
          <p className="mt-2 text-sm text-slate-500">Por padrão, nenhum Replay é removido automaticamente.</p>
          <label className="mt-6 block text-sm font-semibold text-slate-600">Local atual<Input className="mt-2 font-mono text-xs" value={settings.data.media_storage_path} readOnly /></label>
          <div className="mt-4 flex flex-col items-start gap-3">
            <Button type="button" variant="outline" disabled={chooseStorage.isPending || applyStorage.isPending} onClick={() => chooseStorage.mutate()}>
              <FolderOpen size={17} />{chooseStorage.isPending ? "Aguardando escolha..." : "Escolher outra pasta"}
            </Button>
            {selectedStoragePath && <div className="w-full max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Nova pasta escolhida</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{selectedStoragePath}</p>
              <div className="mt-3 flex gap-2">
                <ConfirmationAlertDialog trigger={<Button type="button">Usar esta pasta</Button>} title="Alterar o armazenamento dos Replays?" description="Os processos de vídeo serão pausados, os arquivos atuais serão copiados e os componentes serão reiniciados. A pasta anterior será preservada." confirmLabel="Alterar armazenamento" pending={applyStorage.isPending} onConfirm={() => applyStorage.mutate()} />
                <Button type="button" variant="ghost" onClick={() => setSelectedStoragePath(null)}>Cancelar</Button>
              </div>
            </div>}
          </div>
          <p className="mt-2 text-xs text-slate-500">A janela de escolha abre na máquina onde a ARENAX está instalada. Nenhum comando manual é necessário.</p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <Checkbox checked={!displayedForm.removeAutomatically} onCheckedChange={(checked) => setForm({ ...displayedForm, removeAutomatically: checked !== true })} />
            <span><strong className="block text-slate-700">Não remover automaticamente</strong><span className="mt-1 block text-xs font-normal text-slate-500">Os arquivos permanecem até uma alteração explícita desta política.</span></span>
          </label>
          <label className="mt-5 block max-w-xs text-sm font-semibold text-slate-600">Remover Replays depois de<div className="relative mt-2"><Input className="pr-16" type="number" min="1" step="1" disabled={!displayedForm.removeAutomatically} value={displayedForm.retentionDays} onChange={(event) => setForm({ ...displayedForm, retentionDays: event.target.value })} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">dias</span></div></label>
          {!retentionValid && <p className="mt-2 text-xs text-rose-700">Informe uma quantidade de dias maior que zero.</p>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
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
          <Button type="submit" disabled={!valid || !retentionValid || !companyValid || !dirty || save.isPending}>{save.isPending ? "Salvando..." : "Salvar configurações"}</Button>
        </div>
      </form>}
    </main>
  </AppShell>;
}
