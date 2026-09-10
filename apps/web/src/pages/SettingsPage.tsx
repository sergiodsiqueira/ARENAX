import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock3, CloudAlert, CloudCheck, CloudOff, FolderOpen, HardDrive, Network, RefreshCw, Video } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Combobox } from "../components/ui/combobox";
import { ConfirmationAlertDialog } from "../components/ui/confirmation-alert-dialog";
import { Input } from "../components/ui/input";
import { applyReplayStorageFolder, getCurrentUser, getLicenseStatus, getNetworkInterfaces, getOperationalSettings, lookupPostalCode, selectReplayStorageFolder, updateOperationalSettings } from "../lib/api";

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
  axDeviceNetworkInterfaceId: string;
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
  const license = useQuery({
    queryKey: ["license-status"],
    queryFn: getLicenseStatus,
    retry: false,
  });
  const networkInterfaces = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: getNetworkInterfaces,
    enabled: Boolean(currentUser.data && currentUser.data.role !== "operador"),
    retry: false,
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
    axDeviceNetworkInterfaceId: settings.data?.ax_device_network_interface_id ?? "",
  };
  const networkOptions = (networkInterfaces.data ?? []).map((item) => ({
    value: item.id,
    label: item.name,
    detail: item.address,
  }));
  if (
    displayedForm.axDeviceNetworkInterfaceId
    && !networkOptions.some((item) => item.value === displayedForm.axDeviceNetworkInterfaceId)
  ) {
    networkOptions.push({
      value: displayedForm.axDeviceNetworkInterfaceId,
      label: settings.data?.ax_device_network_interface_name || "Interface indisponível",
      detail: settings.data?.ax_device_network_address || "Sem endereço IPv4",
    });
  }

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
    axDeviceNetworkInterfaceId: displayedForm.axDeviceNetworkInterfaceId,
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
    || values.axDeviceNetworkInterfaceId !== settings.data.ax_device_network_interface_id
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
      ax_device_network_interface_id: values.axDeviceNetworkInterfaceId,
      ax_device_network_interface_name: networkInterfaces.data?.find((item) => item.id === values.axDeviceNetworkInterfaceId)?.name ?? settings.data?.ax_device_network_interface_name ?? "",
      ax_device_network_address: networkInterfaces.data?.find((item) => item.id === values.axDeviceNetworkInterfaceId)?.address ?? settings.data?.ax_device_network_address ?? "",
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
    <main className="page-shell">
      <div>
        <p className="mb-2 text-sm font-semibold tracking-wide text-primary">ADMINISTRAÇÃO</p>
        <h1 className="page-heading">Configurações</h1>
        <p className="mt-2 text-muted-foreground">Defina os padrões operacionais usados pela Arena.</p>
      </div>
      {settings.isLoading && <div className="mt-8 h-72 animate-pulse rounded-2xl border border-border bg-card" />}
      {settings.isError && <div className="mt-8 rounded-2xl border border-danger-border bg-card p-6 text-destructive">Não foi possível carregar as Configurações.</div>}
      {settings.data && <form className="mt-8" onSubmit={submit}>
        <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-secondary p-2.5 text-primary"><Clock3 size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Sessões</h2>
          <p className="mt-2 text-sm text-muted-foreground">Duração padrão usada ao criar uma nova Sessão.</p>
          <label className="mt-6 block text-sm font-semibold text-foreground">
            Duração padrão de cada Sessão
            <div className="relative mt-2 max-w-xs"><Input className="pr-20" type="number" min="1" step="1" value={displayedForm.sessionMinutes} onChange={(event) => setForm({ ...displayedForm, sessionMinutes: event.target.value })} aria-describedby="session-duration-help" required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">minutos</span></div>
          </label>
          <p id="session-duration-help" className="mt-2 text-xs text-muted-foreground">Preenche o horário final; o operador poderá ajustá-lo antes de salvar.</p>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm">
            <Checkbox checked={displayedForm.calculateActualTime} onCheckedChange={(checked) => setForm({ ...displayedForm, calculateActualTime: checked === true })} />
            <span><strong className="block text-foreground">Calcular pelo tempo real de uso</strong><span className="mt-1 block text-xs font-normal text-muted-foreground">Ativado: usa os minutos entre início e fim reais. Desativado: usa o período previsto.</span></span>
          </label>
        </section>
        <section className="order-first rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-secondary p-2.5 text-primary"><Building2 size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Dados da Empresa</h2>
          <p className="mt-2 text-sm text-muted-foreground">Informações cadastrais que serão usadas futuramente na emissão de notas fiscais.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-foreground">CNPJ<Input className="mt-2 uppercase" maxLength={18} placeholder="00.000.000/0000-00" value={displayedForm.companyTaxId} onChange={(event) => setForm({ ...displayedForm, companyTaxId: formatCnpj(event.target.value) })} /></label>
            <label className="text-sm font-semibold text-foreground">Nome<Input className="mt-2" maxLength={180} placeholder="Razão social" value={displayedForm.companyLegalName} onChange={(event) => setForm({ ...displayedForm, companyLegalName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-foreground">Nome Fantasia<Input className="mt-2" maxLength={180} value={displayedForm.companyTradeName} onChange={(event) => setForm({ ...displayedForm, companyTradeName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-foreground">Telefone<Input className="mt-2" inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" value={displayedForm.companyPhone} onChange={(event) => setForm({ ...displayedForm, companyPhone: formatPhone(event.target.value) })} /></label>
            <label className="text-sm font-semibold text-foreground">CEP<div className="mt-2 flex gap-2"><Input inputMode="numeric" maxLength={9} placeholder="00000-000" value={displayedForm.companyPostalCode} onChange={(event) => setForm({ ...displayedForm, companyPostalCode: formatPostalCode(event.target.value) })} /><Button type="button" variant="outline" disabled={values.companyPostalCode.length !== 8 || postalCodeLookup.isPending} onClick={() => postalCodeLookup.mutate()}>{postalCodeLookup.isPending ? "Buscando..." : "Buscar CEP"}</Button></div></label>
            <div className="hidden md:block" aria-hidden="true" />
            <label className="text-sm font-semibold text-foreground md:col-span-2">Endereço<Input className="mt-2" maxLength={250} placeholder="Logradouro, número e complemento" value={displayedForm.companyAddress} onChange={(event) => setForm({ ...displayedForm, companyAddress: event.target.value })} /></label>
            <label className="flex flex-col text-sm font-semibold text-foreground">Cidade<Input className="mt-2" maxLength={120} value={displayedForm.companyCity} onChange={(event) => setForm({ ...displayedForm, companyCity: event.target.value })} /></label>
            <label className="flex flex-col text-sm font-semibold text-foreground">UF<Input className="mt-2 w-24 uppercase" maxLength={2} placeholder="SP" value={displayedForm.companyState} onChange={(event) => setForm({ ...displayedForm, companyState: event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() })} /></label>
          </div>
          {!companyValid && <p className="mt-3 text-xs text-destructive">Confira o CNPJ (12 letras ou números e 2 dígitos verificadores), o CEP (8 dígitos), o telefone (10 ou 11 dígitos) e a UF (2 letras).</p>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-secondary p-2.5 text-primary"><Network size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Rede dos AX Devices</h2>
          <p className="mt-2 text-sm text-muted-foreground">Escolha a interface da máquina ARENAX conectada à mesma rede dos AX Devices.</p>
          <div className="mt-6 max-w-xl">
            <label className="text-sm font-semibold text-foreground">
              Interface de rede
              <Combobox
                value={displayedForm.axDeviceNetworkInterfaceId}
                onValueChange={(value) => setForm({ ...displayedForm, axDeviceNetworkInterfaceId: value })}
                options={networkOptions}
                placeholder={networkInterfaces.isLoading ? "Detectando interfaces..." : "Selecione uma interface"}
                searchPlaceholder="Buscar interface..."
                emptyText="Nenhuma interface IPv4 ativa foi encontrada."
                disabled={networkInterfaces.isLoading}
              />
            </label>
            <Button type="button" variant="ghost" className="mt-2" disabled={networkInterfaces.isFetching} onClick={() => networkInterfaces.refetch()}>
              <RefreshCw className={networkInterfaces.isFetching ? "animate-spin" : ""} size={16} /> Detectar novamente
            </Button>
          </div>
          {networkInterfaces.isError && <p className="mt-3 text-xs text-destructive">Não foi possível consultar as interfaces. Verifique se o ARENAX Local Agent está ativo.</p>}
          {settings.data.ax_device_network_address && <div className="mt-4 rounded-xl border border-secondary bg-secondary p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Endereço atual do AX Device</p><code className="mt-1 block break-all text-xs text-foreground">http://{settings.data.ax_device_network_address}:8000/api/v1/events/button-pressed</code></div>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-secondary p-2.5 text-primary"><HardDrive size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Armazenamento de Replays</h2>
          <p className="mt-2 text-sm text-muted-foreground">Por padrão, nenhum Replay é removido automaticamente.</p>
          <label className="mt-6 block text-sm font-semibold text-foreground">Local atual<Input className="mt-2 font-mono text-xs" value={settings.data.media_storage_path} readOnly /></label>
          <div className="mt-4 flex flex-col items-start gap-3">
            <Button type="button" variant="outline" disabled={chooseStorage.isPending || applyStorage.isPending} onClick={() => chooseStorage.mutate()}>
              <FolderOpen size={17} />{chooseStorage.isPending ? "Aguardando escolha..." : "Escolher outra pasta"}
            </Button>
            {selectedStoragePath && <div className="w-full max-w-2xl rounded-xl border border-secondary bg-secondary p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Nova pasta escolhida</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{selectedStoragePath}</p>
              <div className="mt-3 flex gap-2">
                <ConfirmationAlertDialog trigger={<Button type="button">Usar esta pasta</Button>} title="Alterar o armazenamento dos Replays?" description="Os processos de vídeo serão pausados, os arquivos atuais serão copiados e os componentes serão reiniciados. A pasta anterior será preservada." confirmLabel="Alterar armazenamento" pending={applyStorage.isPending} onConfirm={() => applyStorage.mutate()} />
                <Button type="button" variant="ghost" onClick={() => setSelectedStoragePath(null)}>Cancelar</Button>
              </div>
            </div>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">A janela de escolha abre na máquina onde a ARENAX está instalada. Nenhum comando manual é necessário.</p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm">
            <Checkbox checked={!displayedForm.removeAutomatically} onCheckedChange={(checked) => setForm({ ...displayedForm, removeAutomatically: checked !== true })} />
            <span><strong className="block text-foreground">Não remover automaticamente</strong><span className="mt-1 block text-xs font-normal text-muted-foreground">Os arquivos permanecem até uma alteração explícita desta política.</span></span>
          </label>
          <label className="mt-5 block max-w-xs text-sm font-semibold text-foreground">Remover Replays depois de<div className="relative mt-2"><Input className="pr-16" type="number" min="1" step="1" disabled={!displayedForm.removeAutomatically} value={displayedForm.retentionDays} onChange={(event) => setForm({ ...displayedForm, retentionDays: event.target.value })} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">dias</span></div></label>
          {!retentionValid && <p className="mt-2 text-xs text-destructive">Informe uma quantidade de dias maior que zero.</p>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
          <span className="inline-flex rounded-xl bg-secondary p-2.5 text-primary"><Video size={21} /></span>
          <h2 className="mt-4 text-lg font-semibold">Replays</h2>
          <p className="mt-2 text-sm text-muted-foreground">Durações anterior e posterior ao acionamento.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-foreground">Antes do acionamento<div className="relative mt-2"><Input className="pr-24" type="number" min="0" step="1" value={displayedForm.replayPreSeconds} onChange={(event) => setForm({ ...displayedForm, replayPreSeconds: event.target.value })} required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">segundos</span></div></label>
            <label className="text-sm font-semibold text-foreground">Depois do acionamento<div className="relative mt-2"><Input className="pr-24" type="number" min="0" step="1" value={displayedForm.replayPostSeconds} onChange={(event) => setForm({ ...displayedForm, replayPostSeconds: event.target.value })} required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">segundos</span></div></label>
          </div>
          <p className={`mt-3 text-xs ${valid ? "text-muted-foreground" : "text-destructive"}`}>Duração total do Replay: {Number.isFinite(values.replayPreSeconds + values.replayPostSeconds) ? values.replayPreSeconds + values.replayPostSeconds : 0} segundos.</p>
        </section>
        </div>
        <div className="mt-6 flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{license.isError || license.data?.check_status === "unavailable" ? <CloudOff className="text-destructive" size={16} aria-label="API de licença indisponível" /> : license.data?.check_status === "consulted" ? <CloudCheck className="text-primary" size={16} aria-label="API de licença consultada" /> : <CloudAlert className="text-warning-foreground" size={16} aria-label="API de licença ainda não consultada" />}<span>Última atualização: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(settings.data.updated_at))}</span></p>
          <Button type="submit" disabled={!valid || !retentionValid || !companyValid || !dirty || save.isPending}>{save.isPending ? "Salvando..." : "Salvar configurações"}</Button>
        </div>
      </form>}
    </main>
  </AppShell>;
}
