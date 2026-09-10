import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  Landmark,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { MonthPicker } from "../components/ui/month-picker";
import { Hint } from "../components/ui/tooltip";
import { useUrlFilter } from "../hooks/use-url-filter";
import { getClients, getCurrentUser, getSessionDossier, getSessions } from "../lib/api";

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

const methodLabels = {
  cash: "Dinheiro",
  pix: "PIX",
  debit_card: "Débito",
  credit_card: "Crédito",
  other: "Outro",
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export function FinancialDashboardPage() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useUrlFilter(
    "month",
    currentMonth(),
    (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value),
  );
  const user = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients, enabled: Boolean(user.data) });
  const [year, month] = selectedMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const authorized = Boolean(user.data && user.data.role !== "operador");
  const finance = useQuery({
    queryKey: ["financial-dashboard", start.toISOString()],
    enabled: authorized,
    queryFn: async () =>
      Promise.all(
        (await getSessions(start, end))
          .filter((session) => !["cancelled", "no_show"].includes(session.status))
          .map((session) => getSessionDossier(session.id)),
      ),
  });

  useEffect(() => {
    if (user.isError || user.data?.role === "operador") navigate("/mission-control", { replace: true });
  }, [navigate, user.data?.role, user.isError]);

  const loading = user.isLoading || (authorized && (clients.isLoading || finance.isLoading));
  const loadError = finance.isError || clients.isError;
  const names = new Map((clients.data ?? []).map((client) => [client.id, client.name]));
  const rows = (finance.data ?? []).map((session) => {
    const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    return { session, paid, balance: Math.max(0, session.expected_amount_cents - paid) };
  });
  const expected = rows.reduce((sum, row) => sum + row.session.expected_amount_cents, 0);
  const received = rows.reduce((sum, row) => sum + row.paid, 0);
  const balance = Math.max(0, expected - received);
  const pending = rows.filter((row) => row.balance > 0).sort((a, b) => b.balance - a.balance);
  const monthlyRows = [...rows].sort(
    (a, b) => new Date(a.session.scheduled_start).getTime() - new Date(b.session.scheduled_start).getTime(),
  );
  const methods = Object.entries(methodLabels)
    .map(([method, label]) => ({
      method,
      label,
      total: rows
        .flatMap((row) => row.session.payments)
        .filter((payment) => payment.method === method)
        .reduce((sum, payment) => sum + payment.amount_cents, 0),
    }))
    .filter((item) => item.total > 0);

  return (
    <AppShell user={user.data}>
      <main className="page-shell lg:flex lg:min-h-dvh lg:flex-col">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">FINANCEIRO</p>
            <h1 className="mt-2 page-heading">Dashboard financeiro</h1>
            <p className="mt-2 text-muted-foreground">
              Recebimentos e valores em aberto no período selecionado.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          </div>
        </header>

        {loading && <div className="mt-8 h-72 animate-pulse rounded-2xl bg-card" />}

        {!loading && loadError && (
          <section className="mt-8 rounded-2xl border border-danger-border bg-card p-6 text-foreground shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-danger-muted text-destructive">
                  <AlertTriangle size={22} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Não foi possível carregar o Financeiro.</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Verifique a conexão com a API e tente novamente. Os indicadores ficam ocultos
                    até os dados reais serem carregados.
                  </p>
                </div>
              </div>
              <Button
                className="w-full sm:w-auto"
                type="button"
                variant="outline"
                onClick={() => {
                  void clients.refetch();
                  void finance.refetch();
                }}
              >
                Tentar novamente
              </Button>
            </div>
          </section>
        )}

        {!loading && !loadError && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinancialKpiCard label="Receita recebida" value={currency(received)} Icon={CircleDollarSign} />
              <FinancialKpiCard label="Receita prevista" value={currency(expected)} Icon={TrendingUp} />
              <FinancialKpiCard label="Saldo a receber" value={currency(balance)} Icon={Banknote} />
              <FinancialKpiCard label="Sessões pendentes" value={String(pending.length)} Icon={CreditCard} />
            </section>

            <section className="mt-6 grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_2fr]">
              <article className="flex min-h-[28rem] flex-col rounded-2xl border bg-card p-5 shadow-sm lg:min-h-0">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Landmark size={19} aria-hidden="true" /> Recebimentos por método
                </h2>
                <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
                  {methods.length ? (
                    methods.map((item) => (
                      <div key={item.method}>
                        <div className="flex justify-between gap-4 text-sm">
                          <span>{item.label}</span>
                          <strong>{currency(item.total)}</strong>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-mint"
                            style={{ width: `${received ? (item.total / received) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum Pagamento registrado no mês.</p>
                  )}
                </div>
              </article>

              <article className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm lg:min-h-0">
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <h2 className="text-lg font-semibold">Sessões do mês</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Todas as Sessões consideradas nos indicadores do topo.
                    </p>
                  </div>
                  <Hint label="Ver todas as pendências">
                    <Link
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      to={`/administracao/financeiro/pendencias?month=${selectedMonth}`}
                      aria-label="Ver todos os pagamentos pendentes"
                    >
                      <HandCoins size={21} aria-hidden="true" />
                    </Link>
                  </Hint>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-5 py-3">Cliente</th>
                        <th className="px-5 py-3">Sessão</th>
                        <th className="px-5 py-3">Previsto</th>
                        <th className="px-5 py-3">Pago</th>
                        <th className="px-5 py-3">Saldo</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map(({ session, paid, balance: pendingBalance }) => (
                        <tr key={session.id} className="border-t">
                          <td className="px-5 py-4 font-semibold">
                            {names.get(session.responsible_client_id) ?? "Cliente desconhecido"}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{date(session.scheduled_start)}</td>
                          <td className="px-5 py-4">{currency(session.expected_amount_cents)}</td>
                          <td className="px-5 py-4">{currency(paid)}</td>
                          <td className={`px-5 py-4 font-semibold ${pendingBalance > 0 ? "text-destructive" : "text-primary"}`}>
                            {currency(pendingBalance)}
                          </td>
                          <td className="px-5 py-4">
                            {pendingBalance > 0 ? (
                              <Link
                                className="inline-flex items-center gap-1 text-primary"
                                to={`/sessoes/${session.id}?returnTo=${encodeURIComponent(`/administracao/financeiro?month=${selectedMonth}`)}`}
                              >
                                Cobrar <ArrowRight size={14} aria-hidden="true" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Quitado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!monthlyRows.length && (
                        <tr>
                          <td className="px-5 py-10 text-center text-muted-foreground" colSpan={6}>
                            Nenhuma Sessão financeira neste mês.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}

function FinancialKpiCard({ label, value, Icon }: { label: string; value: string; Icon: LucideIcon }) {
  return (
    <article className="flex min-h-24 items-center gap-4 rounded-2xl border border-transparent bg-muted px-4 py-3.5 shadow-none">
      <span className="grid size-13 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
        <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <strong className="mt-1 block truncate text-2xl leading-none font-semibold text-primary">
          {value}
        </strong>
      </div>
    </article>
  );
}
