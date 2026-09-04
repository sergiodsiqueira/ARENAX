import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "../components/AppShell";
import { Combobox } from "../components/ui/combobox";
import { getClients, getCurrentUser, getSessionDossier, getSessions } from "../lib/api";

const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function PendingPaymentsPage() {
  const navigate = useNavigate();
  const [clientFilter, setClientFilter] = useState("all");
  const user = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const finance = useQuery({ queryKey: ["all-payment-pendencies"], enabled: Boolean(user.data && user.data.role !== "operador"), queryFn: async () => Promise.all((await getSessions(new Date(2000, 0, 1), new Date(2100, 0, 1))).filter((session) => !["cancelled", "no_show"].includes(session.status)).map((session) => getSessionDossier(session.id))) });
  useEffect(() => { if (user.isError || user.data?.role === "operador") navigate("/mission-control", { replace: true }); }, [navigate, user.data?.role, user.isError]);
  const names = new Map((clients.data ?? []).map((client) => [client.id, client.name]));
  const allPending = (finance.data ?? []).map((session) => { const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0); return { session, paid, balance: Math.max(0, session.expected_amount_cents - paid) }; }).filter((row) => row.balance > 0).sort((a, b) => b.balance - a.balance);
  const pending = allPending.filter((row) => clientFilter === "all" || row.session.responsible_client_id === clientFilter);
  const totals = pending.reduce((result, row) => ({ expected: result.expected + row.session.expected_amount_cents, paid: result.paid + row.paid, balance: result.balance + row.balance }), { expected: 0, paid: 0, balance: 0 });
  const clientOptions = [...new Set(allPending.map((row) => row.session.responsible_client_id))].map((clientId) => ({ value: clientId, label: names.get(clientId) ?? "Cliente desconhecido" })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return <AppShell user={user.data}><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700" to="/administracao/financeiro"><ArrowLeft size={16} /> Voltar ao Financeiro</Link><header className="mt-5"><p className="text-sm font-semibold text-emerald-700">COBRANÇAS</p><h1 className="mt-2 text-3xl font-semibold">Pagamentos pendentes</h1><p className="mt-2 text-slate-500">Todas as Sessões com saldo em aberto, independentemente da data.</p></header>
  <div className="mt-8 flex justify-end"><label className="w-full max-w-sm text-sm font-semibold text-slate-600">Cliente<Combobox value={clientFilter} onValueChange={setClientFilter} options={[{ value: "all", label: `Todos os Clientes (${allPending.length})` }, ...clientOptions]} searchPlaceholder="Buscar Cliente..." /></label></div>
  <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="p-5"><h2 className="text-lg font-semibold">Sessões com pagamento pendente</h2><p className="mt-1 text-sm text-slate-500">{pending.length} cobrança{pending.length !== 1 ? "s" : ""} em aberto, ordenada{pending.length !== 1 ? "s" : ""} pelo maior saldo.</p></div>{finance.isLoading ? <div className="h-56 animate-pulse bg-slate-50" /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Sessão</th><th className="px-5 py-3">Previsto</th><th className="px-5 py-3">Pago</th><th className="px-5 py-3">Saldo</th><th /></tr></thead><tbody>{pending.map(({ session, paid, balance }) => <tr key={session.id} className="border-t"><td className="px-5 py-4 font-semibold">{names.get(session.responsible_client_id) ?? "Cliente desconhecido"}</td><td className="px-5 py-4 text-slate-500">{date(session.scheduled_start)}</td><td className="px-5 py-4">{currency(session.expected_amount_cents)}</td><td className="px-5 py-4">{currency(paid)}</td><td className="px-5 py-4 font-semibold text-rose-700">{currency(balance)}</td><td className="px-5 py-4"><Link className="inline-flex items-center gap-1 text-emerald-700" to={`/sessoes/${session.id}`}>Cobrar <ArrowRight size={14} /></Link></td></tr>)}{!pending.length && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>Nenhuma Sessão com saldo pendente para o Cliente selecionado.</td></tr>}</tbody>{pending.length > 0 && <tfoot className="border-t-2 bg-emerald-50/70 font-semibold"><tr><td className="px-5 py-4" colSpan={2}>Totais</td><td className="px-5 py-4">{currency(totals.expected)}</td><td className="px-5 py-4">{currency(totals.paid)}</td><td className="px-5 py-4 text-rose-700">{currency(totals.balance)}</td><td /></tr></tfoot>}</table></div>}</section></main></AppShell>;
}
