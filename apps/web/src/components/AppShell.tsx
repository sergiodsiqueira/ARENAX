import { Activity, CalendarDays, Cpu, LayoutDashboard, LogOut, MapPin, Menu, Settings, ShieldUser, Users, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { logout, type AuthenticatedUser } from "../lib/api";

type AppShellProps = { user: AuthenticatedUser | undefined; children: ReactNode };

export function AppShell({ user, children }: AppShellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    globalThis.addEventListener("keydown", close);
    return () => globalThis.removeEventListener("keydown", close);
  }, []);

  const leave = async () => {
    await logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const sidebar = <>
    <div className="flex h-32 shrink-0 items-center justify-between px-5">
      <NavLink className="flex items-center gap-3" to="/mission-control" onClick={() => setOpen(false)} aria-label="ARENAX">
        <span className="sidebar-logotype" role="img" aria-label="ARENAX Smart Arena Management" />
      </NavLink>
      <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
    </div>
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2" aria-label="Navegação principal">
      <p className="px-3 pb-1 pt-1 text-[.68rem] font-semibold tracking-[.16em] text-muted-foreground uppercase">Operação</p>
      <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/mission-control" onClick={() => setOpen(false)}><LayoutDashboard size={19} /> Mission Control</NavLink>
      <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/agenda" onClick={() => setOpen(false)}><CalendarDays size={19} /> Agenda</NavLink>
      <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/health-center" onClick={() => setOpen(false)}><Activity size={19} /> Health Center</NavLink>
      <p className="px-3 pb-1 pt-4 text-[.68rem] font-semibold tracking-[.16em] text-muted-foreground uppercase">Cadastros</p>
      <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/cadastros/clientes" onClick={() => setOpen(false)}><Users size={19} /> Clientes</NavLink>
      <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/cadastros/espacos" onClick={() => setOpen(false)}><MapPin size={19} /> Espaços</NavLink>
      {user?.role !== "operador" && <><p className="px-3 pb-1 pt-4 text-[.68rem] font-semibold tracking-[.16em] text-muted-foreground uppercase">Administração</p><NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/administracao/equipamentos" onClick={() => setOpen(false)}><Cpu size={19} /> Equipamentos</NavLink><NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/administracao/acessos" onClick={() => setOpen(false)}><ShieldUser size={19} /> Acessos</NavLink><NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to="/administracao/configuracoes" onClick={() => setOpen(false)}><Settings size={19} /> Configurações</NavLink></>}
    </nav>
    <div className="shrink-0 border-t border-border p-3">
      <div className="mb-2 px-3"><p className="truncate text-sm font-semibold text-foreground">{user?.name ?? "Carregando..."}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{user?.role}</p></div>
      <button className="sidebar-link w-full" onClick={leave}><LogOut size={18} /> Sair</button>
    </div>
  </>;

  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-66 flex-col border-r border-border bg-card lg:flex">{sidebar}</aside>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:hidden">
      <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}><Menu size={22} /></button>
      <span className="text-base font-extrabold tracking-[.2em]">ARENAX</span>
      <span className="h-9 w-9 rounded-full bg-emerald-100 text-center text-sm font-bold leading-9 text-emerald-800">{user?.name?.charAt(0).toUpperCase() ?? "A"}</span>
    </header>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-slate-950/35" onClick={() => setOpen(false)} aria-label="Fechar menu" /><aside className="relative flex h-full w-[min(82vw,300px)] flex-col bg-card text-foreground shadow-2xl">{sidebar}</aside></div>}
    <div className="lg:pl-66">{children}</div>
  </div>;
}
