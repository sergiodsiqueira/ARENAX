import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { getLicenseStatus } from "../lib/api";

const reasonMessage = {
  license_blocked: "A liberação desta instalação foi suspensa.",
  license_expired: "A validade da liberação desta instalação terminou.",
  license_unverified: "Não foi possível validar esta instalação dentro do prazo de tolerância.",
};

export function LicenseGuard({ children }: { children: ReactNode }) {
  const license = useQuery({
    queryKey: ["license-status"],
    queryFn: getLicenseStatus,
    retry: 1,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const blocked = license.data && !license.data.allowed ? license.data : null;

  return <>
    {children}
    {blocked && <div className="fixed inset-0 z-[100] grid place-items-center bg-foreground/60 px-5 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-2xl border border-danger-border bg-card p-7 text-center shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="license-block-title" aria-describedby="license-block-description">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-muted text-destructive"><ShieldAlert size={28} /></span>
        <h2 id="license-block-title" className="mt-5 text-2xl font-semibold text-foreground">Acesso à ARENAX bloqueado</h2>
        <p id="license-block-description" className="mt-3 text-sm leading-6 text-foreground">{reasonMessage[blocked.reason as keyof typeof reasonMessage] ?? "Esta instalação não possui uma liberação válida."}</p>
        <p className="mt-2 text-sm text-foreground">Entre em contato com o suporte para regularizar o acesso.</p>
        <div className="mt-6 rounded-xl bg-muted p-4 text-left">
          <p className="font-semibold text-foreground">{blocked.support_company}</p>
          <div className="mt-3 grid gap-2 text-sm">
            <a className="flex items-center gap-2 rounded-lg p-2 text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="https://wa.me/5519997778318" target="_blank" rel="noreferrer"><MessageCircle size={17} /> {blocked.support_whatsapp}</a>
            <a className="flex items-center gap-2 rounded-lg p-2 text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`mailto:${blocked.support_email}`}><Mail size={17} /> {blocked.support_email}</a>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
