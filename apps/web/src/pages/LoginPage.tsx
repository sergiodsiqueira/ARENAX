import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Radio } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { login } from "../lib/api";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
  remember: z.boolean(),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const submit = async (data: LoginForm) => {
    setAccessError(null);
    try {
      const user = await login(data);
      navigate("/mission-control", { replace: true, state: { user } });
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)]">
      <section className="brand-panel relative hidden min-h-screen overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="brand-glow brand-glow-one" />
        <div className="brand-glow brand-glow-two" />

        <a className="relative z-10 flex w-fit items-center gap-3" href="/login" aria-label="ARENAX">
          <span className="logo-mark" aria-hidden="true"><span /></span>
          <span className="text-[1.35rem] font-extrabold tracking-[0.22em]">ARENAX</span>
        </a>

        <div className="relative z-10 max-w-2xl pb-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-emerald-100 uppercase backdrop-blur">
            <Radio size={14} aria-hidden="true" />
            Arena em tempo real
          </div>
          <h1 className="max-w-xl text-5xl leading-[1.04] font-semibold tracking-[-0.045em] xl:text-6xl">
            Sua arena inteira, em uma única operação.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-emerald-50/70">
            Sessões, Espaços e Momentos conectados para você operar com clareza — antes, durante e depois do jogo.
          </p>

          <div className="mt-14 flex items-center gap-4 border-t border-white/10 pt-7 text-sm text-emerald-50/60">
            <span className="flex items-center gap-2"><span className="status-dot" /> Sistemas operacionais</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Operação protegida</span>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="w-full max-w-[430px]">
          <a className="mb-16 flex w-fit items-center gap-3 lg:hidden" href="/login" aria-label="ARENAX">
            <span className="logo-mark logo-mark-dark" aria-hidden="true"><span /></span>
            <span className="text-lg font-extrabold tracking-[0.22em]">ARENAX</span>
          </a>

          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold tracking-wide text-emerald-700">BEM-VINDO DE VOLTA</p>
            <h2 className="text-4xl font-semibold tracking-[-0.035em] text-slate-950">Acesse sua arena</h2>
            <p className="mt-3 text-base leading-7 text-slate-500">Entre com suas credenciais para continuar a operação.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <div>
              <label className="field-label" htmlFor="email">E-mail</label>
              <div className={`field-shell ${errors.email ? "field-error" : ""}`}>
                <Mail size={19} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="operador@suaarena.com.br"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="error-message">{errors.email.message}</p>}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="field-label mb-0" htmlFor="password">Senha</label>
                <button className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" type="button">
                  Esqueci minha senha
                </button>
              </div>
              <div className={`field-shell ${errors.password ? "field-error" : ""}`}>
                <LockKeyhole size={19} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                <button
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {errors.password && <p className="error-message">{errors.password.message}</p>}
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-3 text-sm text-slate-600">
              <input className="remember-checkbox" type="checkbox" {...register("remember")} />
              Manter meu acesso neste dispositivo
            </label>

            {accessError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900" role="alert">
                {accessError}
              </div>
            )}

            <button className="primary-button group" type="submit" disabled={isSubmitting}>
              Entrar na ARENAX
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" size={19} aria-hidden="true" />
            </button>
          </form>

          <p className="mt-12 text-center text-sm text-slate-400">
            Precisa de ajuda? <a className="font-semibold text-slate-600 hover:text-emerald-700" href="mailto:suporte@arenax.com.br">Fale com o suporte</a>
          </p>
          <p className="mt-16 text-center text-xs text-slate-400">© 2026 ARENAX · Operação inteligente para arenas</p>
        </div>
      </section>
    </main>
  );
}
