import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Building2, Pencil, Plus, Trash2, User } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { StatusCounterCard } from "../components/StatusCounterCard";
import { ConfirmationAlertDialog } from "../components/ui/confirmation-alert-dialog";
import { Combobox } from "../components/ui/combobox";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { SearchInput } from "../components/ui/search-input";
import { Textarea } from "../components/ui/textarea";
import {
  createClient,
  deleteClient,
  getClients,
  getCurrentUser,
  lookupPostalCode,
  updateClient,
  type Client,
} from "../lib/api";
type Filter = "active" | "inactive" | "all";
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
const formatCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11)
  .replace(/^(\d{3})(\d)/, "$1.$2")
  .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const normalizeDocument = (type: Client["client_type"], value: string) => type === "F"
  ? value.replace(/\D/g, "").slice(0, 11)
  : normalizeCnpj(value);
const formatDocument = (type: Client["client_type"], value: string) => type === "F"
  ? formatCpf(value)
  : formatCnpj(value);
const formatPostalCode = (value: string) => value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const formatPhone = (value: string) => value.replace(/\D/g, "").slice(0, 11)
  .replace(/^(\d{2})(\d)/, "($1) $2")
  .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
export function ClientsAdministrationPage() {
  const navigate = useNavigate(),
    qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active"),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<Client | "new" | null>(null),
    [name, setName] = useState(""),
    [clientType, setClientType] = useState<Client["client_type"]>("F"),
    [document, setDocument] = useState(""),
    [postalCode, setPostalCode] = useState(""),
    [address, setAddress] = useState(""),
    [city, setCity] = useState(""),
    [state, setState] = useState(""),
    [notes, setNotes] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [whatsapp, setWhatsapp] = useState(false),
    [status, setStatus] = useState<Client["administrative_status"]>("active");
  const user = useQuery({
      queryKey: ["current-user"],
      queryFn: getCurrentUser,
      retry: false,
    }),
    clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  useEffect(() => {
    if (user.isError) navigate("/login", { replace: true });
  }, [navigate, user.isError]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["clients"] });
  const save = useMutation({
    mutationFn: async () =>
      modal === "new"
        ? createClient({ name: name.trim(), client_type: clientType, document: normalizeDocument(clientType, document), postal_code: postalCode.replace(/\D/g, ""), address: address.trim(), city: city.trim(), state, notes: notes.trim(), phone: phone.replace(/\D/g, ""), email: email.trim(), whatsapp, administrative_status: status })
        : updateClient(modal!.id, {
            name: name.trim(),
            client_type: clientType,
            document: normalizeDocument(clientType, document),
            postal_code: postalCode.replace(/\D/g, ""),
            address: address.trim(),
            city: city.trim(),
            state,
            notes: notes.trim(),
            phone: phone.replace(/\D/g, ""),
            email: email.trim(),
            whatsapp,
            administrative_status: status,
          }),
    onSuccess: () => {
      setModal(null);
      toast.success("Cliente salvo com sucesso.");
      refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const remove = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      toast.success("Cliente excluído.");
      refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });
  const postalCodeLookup = useMutation({
    mutationFn: () => lookupPostalCode(postalCode.replace(/\D/g, "")),
    onSuccess: (result) => {
      setPostalCode(formatPostalCode(result.postal_code));
      setAddress([result.street, result.neighborhood].filter(Boolean).join(", "));
      setCity(result.city);
      setState(result.state);
      toast.success("Endereço encontrado pelo CEP.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP."),
  });
  const counts = {
    active:
      clients.data?.filter((x) => x.administrative_status === "active")
        .length ?? 0,
    inactive:
      clients.data?.filter((x) => x.administrative_status === "inactive")
        .length ?? 0,
    all: clients.data?.length ?? 0,
  };
  const rows = useMemo(
    () =>
      (clients.data ?? []).filter((x) => {
        const term = search.trim().toLocaleLowerCase("pt-BR");
        const matchesStatus = Boolean(term) || filter === "all" || x.administrative_status === filter;
        const matchesSearch = !term || [x.name, x.document, x.phone, x.email, x.postal_code, x.address, x.city, x.state]
          .some((value) => value.toLocaleLowerCase("pt-BR").includes(term));
        return matchesStatus && matchesSearch;
      }),
    [clients.data, filter, search],
  );
  const open = (item: Client | "new") => {
    setModal(item);
    setName(item === "new" ? "" : item.name);
    setClientType(item === "new" ? "F" : item.client_type);
    setDocument(item === "new" ? "" : formatDocument(item.client_type, item.document));
    setPostalCode(item === "new" ? "" : formatPostalCode(item.postal_code));
    setAddress(item === "new" ? "" : item.address);
    setCity(item === "new" ? "" : item.city);
    setState(item === "new" ? "" : item.state);
    setNotes(item === "new" ? "" : item.notes);
    setPhone(item === "new" ? "" : formatPhone(item.phone));
    setEmail(item === "new" ? "" : item.email);
    setWhatsapp(item === "new" ? false : item.whatsapp);
    setStatus(item === "new" ? "active" : item.administrative_status);
  };
  const normalizedDocument = normalizeDocument(clientType, document);
  const documentValid = !normalizedDocument || (clientType === "F"
    ? /^\d{11}$/.test(normalizedDocument)
    : /^[A-Z0-9]{12}\d{2}$/.test(normalizedDocument));
  const postalCodeValid = !postalCode || postalCode.replace(/\D/g, "").length === 8;
  return (
    <AppShell user={user.data}>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">CLIENTES</p>
            <h1 className="mt-2 text-3xl font-semibold">
              Cadastro de Clientes
            </h1>
          </div>
          <button
            className="operation-button operation-button-primary"
            onClick={() => open("new")}
          >
            <Plus size={17} /> Cadastrar
          </button>
        </header>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <StatusCounterCard
            kind="active"
            label="Ativos"
            value={counts.active}
            selected={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <StatusCounterCard
            kind="inactive"
            label="Inativos"
            value={counts.inactive}
            selected={filter === "inactive"}
            onClick={() => setFilter("inactive")}
          />
          <StatusCounterCard
            kind="all"
            label="Todos"
            value={counts.all}
            selected={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </div>
        <SearchInput className="mt-6" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar Clientes" aria-label="Pesquisar Clientes" />
        <section className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-w-[840px] border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500" style={{ gridTemplateColumns: "64px 300px 170px minmax(220px, 1fr) 100px" }}>
            <span>Tipo</span>
            <span>Nome</span>
            <span>Telefone</span>
            <span>E-mail</span>
            <span>Ações</span>
          </div>
          {rows.map((item) => (
            <div
              key={item.id}
              className="grid min-w-[840px] items-center border-b px-4 py-4 last:border-0"
              style={{ gridTemplateColumns: "64px 300px 170px minmax(220px, 1fr) 100px" }}
            >
              <span
                className="text-emerald-700"
                title={item.client_type === "F" ? "Pessoa Física" : "Pessoa Jurídica"}
                aria-label={item.client_type === "F" ? "Pessoa Física" : "Pessoa Jurídica"}
              >
                {item.client_type === "F" ? <User size={21} /> : <Building2 size={21} />}
              </span>
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-slate-400">
                  {item.administrative_status === "active"
                    ? "Ativo"
                    : "Inativo"}
                </p>
              </div>
              <span className="flex items-center gap-2 text-sm text-slate-600">{item.phone ? formatPhone(item.phone) : "Não informado"}{item.whatsapp && item.phone ? <FontAwesomeIcon className="text-base text-emerald-700" icon={faWhatsapp} title="WhatsApp" aria-label="WhatsApp" /> : null}</span>
              <span className="truncate pr-4 text-sm text-slate-600">{item.email || "Não informado"}</span>
              <div className="flex gap-1">
                <button
                  className="rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => open(item)}
                  aria-label="Editar"
                >
                  <Pencil size={17} />
                </button>
                <ConfirmationAlertDialog
                  title="Excluir Cliente?"
                  description={`O Cliente ${item.name} será removido definitivamente. A exclusão será bloqueada se ele for Responsável por alguma Sessão.`}
                  confirmLabel="Excluir Cliente"
                  pending={remove.isPending}
                  onConfirm={() => remove.mutate(item.id)}
                  trigger={<button className="rounded-lg p-2 hover:bg-rose-50 hover:text-rose-700" aria-label={`Excluir ${item.name}`}><Trash2 size={17} /></button>}
                />
              </div>
            </div>
          ))}
          {!rows.length && (
            <p className="p-10 text-center text-slate-500">
              Nenhum Cliente nesta seleção.
            </p>
          )}
        </section>
        {modal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-5">
            <form
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <h2 className="text-xl font-semibold">
                {modal === "new" ? "Cadastrar Cliente" : "Editar Cliente"}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end">
                <label className="block text-sm font-semibold">
                  Tipo
                  <Combobox
                    value={clientType}
                    onValueChange={(value) => {
                      setClientType(value as Client["client_type"]);
                      setDocument("");
                    }}
                    options={[{ value: "F", label: "Física" }, { value: "J", label: "Jurídica" }]}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Documento
                  <Input
                    className="mt-2 uppercase"
                    inputMode={clientType === "F" ? "numeric" : "text"}
                    maxLength={clientType === "F" ? 14 : 18}
                    placeholder={clientType === "F" ? "000.000.000-00" : "00.000.000/0000-00"}
                    value={document}
                    onChange={(event) => setDocument(formatDocument(clientType, event.target.value))}
                  />
                </label>
                <label className="flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold">
                  <Checkbox
                    checked={status === "active"}
                    onCheckedChange={(checked) => setStatus(checked === true ? "active" : "inactive")}
                  />
                  Ativo
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold">
                Nome
                <Input
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="block text-sm font-semibold">
                  Telefone
                  <Input className="mt-2" inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} />
                </label>
                <label className="flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold">
                  <Checkbox checked={whatsapp} onCheckedChange={(checked) => setWhatsapp(checked === true)} />
                  WhatsApp
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold">
                E-mail
                <Input className="mt-2" type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                CEP
                <div className="mt-2 flex gap-2">
                  <Input inputMode="numeric" maxLength={9} placeholder="00000-000" value={postalCode} onChange={(event) => setPostalCode(formatPostalCode(event.target.value))} />
                  <button type="button" className="operation-button whitespace-nowrap" disabled={postalCode.replace(/\D/g, "").length !== 8 || postalCodeLookup.isPending} onClick={() => postalCodeLookup.mutate()}>{postalCodeLookup.isPending ? "Buscando..." : "Buscar CEP"}</button>
                </div>
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Endereço
                <Input className="mt-2" maxLength={250} placeholder="Logradouro, número e complemento" value={address} onChange={(event) => setAddress(event.target.value)} />
              </label>
              <div className="mt-4 grid grid-cols-[1fr_88px] gap-3">
                <label className="block text-sm font-semibold">Cidade<Input className="mt-2" maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} /></label>
                <label className="block text-sm font-semibold">UF<Input className="mt-2 uppercase" maxLength={2} value={state} onChange={(event) => setState(event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())} /></label>
              </div>
              <label className="mt-4 block text-sm font-semibold">
                Observações
                <Textarea
                  className="mt-2 min-h-14 resize-none"
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Informações adicionais sobre o Cliente"
                />
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="operation-button"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="operation-button operation-button-primary"
                  disabled={!name.trim() || !documentValid || !postalCodeValid || save.isPending}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </AppShell>
  );
}
