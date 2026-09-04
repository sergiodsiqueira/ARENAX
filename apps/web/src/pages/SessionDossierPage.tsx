import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  ArrowLeft,
  CalendarClock,
  CirclePlay,
  Clock3,
  DollarSign,
  Download,
  Film,
  MapPin,
  Pencil,
  ReceiptText,
  RefreshCw,
  Share2,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Combobox } from "../components/ui/combobox";
import { Input } from "../components/ui/input";
import { ModalCloseButton } from "../components/ui/modal-close-button";
import { useModalEscape } from "../hooks/use-modal-escape";
import {
  changeExpectedAmount,
  getClients,
  getCurrentUser,
  getReplayFile,
  getSessionDossier,
  getSpaces,
  recalculateExpectedAmount,
  registerPayment,
  registerReplayShare,
  replayUrl,
  type PaymentMethod,
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
  ReplayExpired: "Replay removido pela política de retenção",
  ReplayShared: "Replay compartilhado",
  PaymentRegistered: "Pagamento registrado",
  ExpectedAmountChanged: "Valor previsto alterado",
  ExpectedAmountRecalculated: "Valor recalculado",
};
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const formatPhone = (value: string) => value.replace(/\D/g, "").slice(0, 11)
  .replace(/^(\d{2})(\d)/, "($1) $2")
  .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
const currency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  other: "Outro",
};

export function SessionDossierPage() {
  const { sessionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const agendaDate = searchParams.get("agendaDate");
  const agendaHref = agendaDate && /^\d{4}-\d{2}-\d{2}$/.test(agendaDate)
    ? `/agenda?date=${encodeURIComponent(agendaDate)}`
    : "/agenda";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [note, setNote] = useState("");
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  useModalEscape(priceModalOpen, () => setPriceModalOpen(false));
  const [expectedAmountInput, setExpectedAmountInput] = useState("");
  const user = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const dossier = useQuery({
    queryKey: ["session-dossier", sessionId],
    queryFn: () => getSessionDossier(sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: (query) =>
      query.state.data?.status === "in_progress" && query.state.data.calculate_actual_time
        ? 30_000
        : query.state.data?.moments.some(
        (moment) => !["ready", "failed"].includes(moment.status),
      )
        ? 3000
        : false,
  });
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const spaces = useQuery({ queryKey: ["spaces"], queryFn: getSpaces });
  useEffect(() => {
    if (user.isError) navigate("/login", { replace: true });
  }, [navigate, user.isError]);
  const clientsById = useMemo(
    () => new Map((clients.data ?? []).map((client) => [client.id, client])),
    [clients.data],
  );
  const spaceNames = useMemo(
    () => new Map((spaces.data ?? []).map((space) => [space.id, space.name])),
    [spaces.data],
  );
  const paidAmountCents = (dossier.data?.payments ?? []).reduce(
    (total, item) => total + item.amount_cents,
    0,
  );
  const remainingAmountCents = Math.max(
    0,
    (dossier.data?.expected_amount_cents ?? 0) - paidAmountCents,
  );
  const suggestedAmount =
    remainingAmountCents > 0
      ? (remainingAmountCents / 100).toFixed(2).replace(".", ",")
      : "";
  const payment = useMutation({
    mutationFn: (amountCents: number) =>
      registerPayment(sessionId, {
        amount_cents: amountCents,
        method,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setAmount(null);
      setNote("");
      toast.success("Pagamento registrado.");
      queryClient.invalidateQueries({
        queryKey: ["session-dossier", sessionId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o Pagamento.",
      ),
  });
  const expectedAmount = useMutation({
    mutationFn: () =>
      changeExpectedAmount(sessionId, parseCurrencyInput(expectedAmountInput)),
    onSuccess: () => {
      setPriceModalOpen(false);
      toast.success("Valor previsto alterado.");
      queryClient.invalidateQueries({
        queryKey: ["session-dossier", sessionId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o valor previsto.",
      ),
  });
  const recalculate = useMutation({
    mutationFn: () => recalculateExpectedAmount(sessionId),
    onSuccess: () => {
      setAmount(null);
      toast.success("Valor previsto recalculado.");
      queryClient.invalidateQueries({
        queryKey: ["session-dossier", sessionId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível recalcular o valor previsto.",
      ),
  });
  const shareReplay = async (momentId: string) => {
    try {
      const file = await getReplayFile(momentId);
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Replay ARENAX",
          text: "Replay da sua Sessão na ARENAX",
        });
      } else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
        globalThis.open(
          "https://wa.me/?text=Replay%20ARENAX%20baixado.%20Anexe%20o%20vídeo%20a%20esta%20conversa.",
          "_blank",
          "noopener,noreferrer",
        );
      }
      await registerReplayShare(momentId);
      toast.success("Compartilhamento registrado na Timeline.");
      queryClient.invalidateQueries({ queryKey: ["session-dossier", sessionId] });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(
        error instanceof Error ? error.message : "Não foi possível compartilhar o Replay.",
      );
    }
  };
  const submitPayment = (event: FormEvent) => {
    event.preventDefault();
    const normalized = (amount ?? suggestedAmount)
      .replace(/\s/g, "")
      .replace(".", "")
      .replace(",", ".");
    const amountCents = Math.round(Number(normalized) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast.error("Informe um valor de Pagamento válido.");
      return;
    }
    payment.mutate(amountCents);
  };

  if (dossier.isLoading || user.isLoading)
    return (
      <AppShell user={user.data}>
        <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </main>
      </AppShell>
    );
  if (dossier.isError || !dossier.data)
    return (
      <AppShell user={user.data}>
        <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <Link className="operation-button" to={agendaHref}>
            <ArrowLeft size={16} /> Agenda
          </Link>
          <div className="mt-6 rounded-2xl border border-rose-200 bg-white p-8 text-rose-800">
            Não foi possível carregar o Dossiê da Sessão.
          </div>
        </main>
      </AppShell>
    );
  const session = dossier.data;
  const responsibleClient = clientsById.get(session.responsible_client_id);
  const sessionPayments = session.payments ?? [];
  return (
    <AppShell user={user.data}>
      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
        to={agendaHref}
        >
          <ArrowLeft size={16} /> Voltar para Agenda
        </Link>
        <header className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold tracking-wide text-emerald-700">
              DOSSIÊ DA SESSÃO
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Sessão #{session.id.slice(0, 8).toUpperCase()}
            </h1>
          </div>
          <span className="w-fit rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
            {statusLabels[session.status]}
          </span>
        </header>
        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info
            icon={<UserRound size={19} />}
            label="Responsável"
            value={responsibleClient?.name ?? "Cliente desconhecido"}
            detail={<span className="inline-flex items-center gap-2">{responsibleClient?.phone ? formatPhone(responsibleClient.phone) : "Telefone não informado"}{responsibleClient?.whatsapp && responsibleClient.phone ? <FontAwesomeIcon className="text-base text-emerald-700" icon={faWhatsapp} title="WhatsApp" aria-label="WhatsApp" /> : null}</span>}
          />
          <Info
            icon={<MapPin size={19} />}
            label="Espaços"
            value={session.space_ids
              .map((id) => spaceNames.get(id) ?? "Espaço desconhecido")
              .join(" · ")}
          />
          <Info
            icon={<CalendarClock size={19} />}
            label="Período previsto"
            value={`${dateTime(session.scheduled_start)} — ${dateTime(session.scheduled_end)}`}
          />
          <Info
            icon={<Clock3 size={19} />}
            label="Período real"
            value={`${dateTime(session.actual_start)} — ${dateTime(session.actual_end)}`}
          />
        </section>
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2">
              <DollarSign className="mt-0.5 shrink-0 text-emerald-700" size={21} />
              <div>
                <h2 className="text-xl font-semibold">Pagamentos</h2>
                <div className="mt-1 flex flex-wrap items-center">
                  <p className="text-sm text-slate-500">
                    Previsto:{" "}
                    <strong className="text-slate-800">
                      {currency(session.expected_amount_cents ?? 0)}
                    </strong>
                    {session.expected_amount_is_manual ? (
                      <span className="ml-1 text-xs text-amber-700">
                        (manual)
                      </span>
                    ) : null}{" "}
                    · Pago:{" "}
                    <strong className="text-slate-800">
                      {currency(paidAmountCents)}
                    </strong>{" "}
                    · Saldo:{" "}
                    <strong
                      className={
                        remainingAmountCents > 0
                          ? "text-rose-700"
                          : "text-slate-800"
                      }
                    >
                      {currency(remainingAmountCents)}
                    </strong>
                  </p>
                  <div className="ml-[30px] flex items-center gap-[10px]">
                    <button
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      type="button"
                      title="Alterar valor previsto"
                      aria-label="Alterar valor previsto"
                      onClick={() => {
                        setExpectedAmountInput(
                          ((session.expected_amount_cents ?? 0) / 100)
                            .toFixed(2)
                            .replace(".", ","),
                        );
                        setPriceModalOpen(true);
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      type="button"
                        title="Recalcular com o valor histórico da Sessão"
                      aria-label="Recalcular valor previsto"
                      disabled={recalculate.isPending}
                      onClick={() => recalculate.mutate()}
                    >
                      <RefreshCw
                        className={recalculate.isPending ? "animate-spin" : ""}
                        size={17}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {sessionPayments.length} registro
              {sessionPayments.length !== 1 ? "s" : ""}
            </span>
          </div>
          <form
            className="mt-5 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-[.7fr_1fr_1.5fr_auto] md:items-end"
            onSubmit={submitPayment}
          >
            <label className="text-sm font-medium text-slate-700">
              Valor (R$)
              <Input
                className="mt-2"
                value={amount ?? suggestedAmount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Método
              <Combobox
                className="mt-2"
                value={method}
                onValueChange={(value) => setMethod(value as PaymentMethod)}
                options={Object.entries(paymentLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
                searchPlaceholder="Buscar método..."
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Observação (opcional)
              <Input
                className="mt-2"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="Ex.: sinal da Sessão"
              />
            </label>
            <button
              className="operation-button operation-button-primary h-9"
              disabled={payment.isPending}
              type="submit"
            >
              {payment.isPending ? "Registrando..." : "Registrar"}
            </button>
          </form>
          {!sessionPayments.length ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Nenhum Pagamento registrado nesta Sessão.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {sessionPayments.map((item) => (
                <article
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                  key={item.id}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                      <ReceiptText size={18} />
                    </span>
                    <div>
                      <p className="font-semibold">
                        {currency(item.amount_cents)} ·{" "}
                        {paymentLabels[item.method]}
                      </p>
                      <p className="text-xs text-slate-500">
                        {dateTime(item.registered_at)}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        {priceModalOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-5">
            <form
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onSubmit={(event) => {
                event.preventDefault();
                expectedAmount.mutate();
              }}
            >
              <div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold">Alterar valor previsto</h2><ModalCloseButton onClick={() => setPriceModalOpen(false)} /></div>
              <p className="mt-2 text-sm text-slate-500">
                Este valor substituirá o cálculo automático desta Sessão até que
                ele seja recalculado.
              </p>
              <label className="mt-5 block text-sm font-semibold">
                Valor previsto (R$)
                <Input
                  className="mt-2"
                  value={expectedAmountInput}
                  onChange={(event) =>
                    setExpectedAmountInput(event.target.value)
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                  autoFocus
                />
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className="operation-button"
                  type="button"
                  onClick={() => setPriceModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="operation-button operation-button-primary"
                  disabled={expectedAmount.isPending}
                  type="submit"
                >
                  {expectedAmount.isPending ? "Salvando..." : "Salvar valor"}
                </button>
              </div>
            </form>
          </div>
        )}
        <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <section>
            <div className="flex items-center gap-2">
              <Film className="text-emerald-700" size={21} />
              <h2 className="text-xl font-semibold">Momentos e Replays</h2>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                {session.moments.length}
              </span>
            </div>
            {!session.moments.length && (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                Nenhum Momento registrado nesta Sessão.
              </div>
            )}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {session.moments.map((moment) => (
                <article
                  key={moment.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  {moment.status === "ready" ? (
                    <video
                      className="aspect-video w-full bg-black"
                      src={replayUrl(moment.id)}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <div className="grid aspect-video place-items-center bg-slate-950 text-slate-300">
                      <div className="text-center">
                        <CirclePlay className="mx-auto" size={32} />
                        <p className="mt-2 text-sm">
                          {moment.status === "failed"
                            ? "Falha no processamento"
                            : moment.status === "expired"
                              ? "Replay removido pela retenção"
                            : "Replay em processamento"}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-semibold">
                      Momento às{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }).format(new Date(moment.occurred_at))}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {spaceNames.get(moment.space_id) ?? "Espaço desconhecido"}{" "}
                      · {moment.status}
                    </p>
                    {moment.status === "ready" && <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                      <a className="operation-button" href={replayUrl(moment.id)} download><Download size={16} /> Baixar</a>
                      <button className="operation-button operation-button-primary" type="button" onClick={() => shareReplay(moment.id)}><Share2 size={16} /> Compartilhar</button>
                    </div>}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-xl font-semibold">Timeline</h2>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {!session.timeline.length && (
                <p className="text-sm text-slate-500">
                  Nenhum evento registrado.
                </p>
              )}
              <ol className="space-y-5">
                {session.timeline.map((entry, index) => (
                  <li
                    key={`${entry.kind}-${entry.occurred_at}-${index}`}
                    className="relative flex gap-3 before:absolute before:left-[5px] before:top-5 before:h-[calc(100%+4px)] before:w-px before:bg-slate-200 last:before:hidden"
                  >
                    <span className="relative mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-600 ring-4 ring-emerald-50" />
                    <div>
                      <p className="text-sm font-semibold">
                        {eventLabels[entry.kind] ?? entry.kind}
                      </p>
                      <time className="mt-1 block text-xs text-slate-400">
                        {dateTime(entry.occurred_at)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function parseCurrencyInput(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(".", "")
    .replace(",", ".");
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents < 0)
    throw new Error("Informe um valor previsto válido.");
  return cents;
}

function Info({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-emerald-700">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-800">
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </article>
  );
}
