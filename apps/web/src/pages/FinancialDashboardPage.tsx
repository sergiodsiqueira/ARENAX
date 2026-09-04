import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Banknote, CalendarDays, CircleDollarSign, CreditCard, HandCoins, Landmark, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "../components/AppShell";
import { Input } from "../components/ui/input";
import { getClients, getCurrentUser, getSessionDossier, getSessions } from "../lib/api";

const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const methodLabels = { cash: "Dinheiro", pix: "PIX", debit_card: "Débito", credit_card: "Crédito", other: "Outro" };
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export function FinancialDashboardPage() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const user = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const [year, month] = selectedMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const finance = useQuery({
    queryKey: ["financial-dashboard", start.toISOString()],
    enabled: Boolean(user.data && user.data.role !== "operador"),
    queryFn: async () => Promise.all((await getSessions(start, end)).filter((session) => !["cancelled", "no_show"].includes(session.status)).map((session) => getSessionDossier(session.id))),
  });
  useEffect(() => { if (user.isError || user.data?.role === "operador") navigate("/mission-control", { replace: true }); }, [navigate, user.data?.role, user.isError]);
  const names = new Map((clients.data ?? []).map((client) => [client.id, client.name]));
  const rows = (finance.data ?? []).map((session) => { const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0); return { session, paid, balance: Math.max(0, session.expected_amount_cents - paid) }; });
  const expected = rows.reduce((sum, row) => sum + row.session.expected_amount_cents, 0);
  const received = rows.reduce((sum, row) => sum + row.paid, 0);
  const pending = rows.filter((row) => row.balance > 0).sort((a, b) => b.balance - a.balance);
  const methods = Object.entries(methodLabels).map(([method, label]) => ({ method, label, total: rows.flatMap((row) => row.session.payments).filter((payment) => payment.method === method).reduce((sum, payment) => sum + payment.amount_cents, 0) })).filter((item) => item.total > 0);
  return <AppShell user={user.data}><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
    <header><p className="text-sm font-semibold text-emerald-700">FINANCEIRO</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard financeiro</h1><p className="mt-2 text-slate-500">Recebimentos e valores em aberto no período selecionado.</p></header>
    {finance.isLoading ? <div className="mt-8 h-72 animate-pulse rounded-2xl bg-white" /> : <>
      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(250px,1fr)]">
        <div className="rounded-2xl bg-secondary p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-[minmax(190px,.85fr)_minmax(0,2.15fr)] lg:items-stretch"><div className="flex flex-col justify-center"><h2 className="text-2xl font-semibold tracking-tight">Visão financeira do período</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Acompanhe o que foi previsto, quanto já entrou e o saldo que ainda precisa ser recebido.</p></div><div className="grid gap-4 sm:grid-cols-3">{[
          { label: "Receita recebida", value: currency(received), Icon: CircleDollarSign }, { label: "Receita prevista", value: currency(expected), Icon: TrendingUp }, { label: "Saldo a receber", value: currency(Math.max(0, expected - received)), Icon: Banknote },
        ].map(({ label, value, Icon }) => <article key={label} className="rounded-2xl border border-white/70 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-slate-600">{label}</p><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon size={18} /></span></div><p className="mt-7 text-2xl font-semibold text-primary">{value}</p></article>)}</div></div></div>
        <article className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Sessões pendentes</p><p className="mt-2 text-4xl font-semibold text-primary">{pending.length}</p></div><span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CreditCard size={20} /></span></div><label className="mt-auto pt-7 text-sm font-semibold text-slate-600"><span className="flex items-center gap-2"><CalendarDays size={16} /> Mês e ano</span><Input className="mt-2 bg-white" type="month" value={selectedMonth} onChange={(event) => event.target.value && setSelectedMonth(event.target.value)} required /></label></article>
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]"><article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-semibold"><Landmark size={19} /> Recebimentos por método</h2><div className="mt-5 space-y-4">{methods.length ? methods.map((item) => <div key={item.method}><div className="flex justify-between text-sm"><span>{item.label}</span><strong>{currency(item.total)}</strong></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${received ? item.total / received * 100 : 0}%` }} /></div></div>) : <p className="text-sm text-slate-500">Nenhum Pagamento registrado no mês.</p>}</div></article>
      <article className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-start justify-between gap-4 p-5"><div><h2 className="text-lg font-semibold">Sessões com pagamento pendente</h2><p className="mt-1 text-sm text-slate-500">Fila de cobrança ordenada pelo maior saldo.</p></div><Link className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to="/administracao/financeiro/pendencias" aria-label="Ver todos os pagamentos pendentes" title="Ver todas as pendências"><HandCoins size={21} /></Link></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Sessão</th><th className="px-5 py-3">Previsto</th><th className="px-5 py-3">Pago</th><th className="px-5 py-3">Saldo</th><th /></tr></thead><tbody>{pending.map(({ session, paid, balance }) => <tr key={session.id} className="border-t"><td className="px-5 py-4 font-semibold">{names.get(session.responsible_client_id) ?? "Cliente desconhecido"}</td><td className="px-5 py-4 text-slate-500">{date(session.scheduled_start)}</td><td className="px-5 py-4">{currency(session.expected_amount_cents)}</td><td className="px-5 py-4">{currency(paid)}</td><td className="px-5 py-4 font-semibold text-rose-700">{currency(balance)}</td><td className="px-5 py-4"><Link className="inline-flex items-center gap-1 text-emerald-700" to={`/sessoes/${session.id}`}>Cobrar <ArrowRight size={14} /></Link></td></tr>)}{!pending.length && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>Nenhuma Sessão com saldo pendente neste mês.</td></tr>}</tbody></table></div></article></section>
    </>}
  </main></AppShell>;
}
