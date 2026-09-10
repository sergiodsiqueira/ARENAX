import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Radio } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { FormModal } from "../components/ui/form-modal";
import { Input } from "../components/ui/input";
import { ModalCloseButton } from "../components/ui/modal-close-button";
import { forgotPassword, login, type ForgotPasswordResult } from "../lib/api";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
  remember: z.boolean(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido."),
});

type LoginForm = z.infer<typeof loginSchema>;
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotResult, setForgotResult] = useState<ForgotPasswordResult | null>(null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const forgotForm = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const submit = async (data: LoginForm) => {
    try {
      const user = await login(data);
      navigate("/mission-control", { replace: true, state: { user } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  };

  const openForgotModal = () => {
    forgotForm.reset({ email: getValues("email") });
    setForgotResult(null);
    setForgotModalOpen(true);
  };

  const submitForgotPassword = async (data: ForgotPasswordForm) => {
    try {
      setForgotResult(await forgotPassword(data.email));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível solicitar a redefinição.");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)]">
      <section className="brand-panel relative hidden min-h-screen overflow-hidden p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="brand-glow brand-glow-one" />
        <div className="brand-glow brand-glow-two" />

        <a className="relative z-10 block w-fit" href="/login" aria-label="ARENAX">
          <img
            className="h-[5.2rem] w-auto max-w-[15.6rem] object-contain"
            src="/branding/ARENAX_BRANCO.png"
            alt="ARENAX"
          />
        </a>

        <div className="relative z-10 max-w-2xl pb-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-card/14 bg-card/8 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase backdrop-blur">
            <Radio size={14} aria-hidden="true" />
            Arena em tempo real
          </div>
          <h1 className="max-w-xl text-5xl leading-[1.04] font-semibold tracking-[-0.045em] xl:text-6xl">
            Sua arena inteira, em uma única operação.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-primary-foreground/70">
            Sessões, Espaços e Momentos conectados para você operar com clareza — antes, durante e depois do jogo.
          </p>

          <div className="mt-14 flex items-center gap-4 border-t border-card/10 pt-7 text-sm text-primary-foreground/60">
            <span className="flex items-center gap-2"><span className="status-dot" /> Sistemas operacionais</span>
            <span className="h-1 w-1 rounded-full bg-card/20" />
            <span>Operação protegida</span>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="w-full max-w-[430px]">
          <a className="mx-auto mb-12 block w-fit lg:hidden" href="/login" aria-label="ArenaX">
            <img
              className="h-[12.6rem] w-auto object-contain"
              src="/branding/LOGOTIPO_TRANSPARENTE.png"
              alt="ArenaX"
            />
          </a>

          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold tracking-wide text-primary">BEM-VINDO DE VOLTA</p>
            <h2 className="text-4xl font-semibold tracking-[-0.035em] text-foreground">Acesse sua arena</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">Entre com suas credenciais para continuar a operação.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <div>
              <label className="field-label" htmlFor="email">E-mail</label>
              <div className={`field-shell ${errors.email ? "field-error" : ""}`}>
                <Mail size={19} aria-hidden="true" />
                <Input
                  className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
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
                <Button className="h-auto p-0" variant="link" type="button" onClick={openForgotModal}>
                  Esqueci minha senha
                </Button>
              </div>
              <div className={`field-shell ${errors.password ? "field-error" : ""}`}>
                <LockKeyhole size={19} aria-hidden="true" />
                <Input
                  className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </Button>
              </div>
              {errors.password && <p className="error-message">{errors.password.message}</p>}
            </div>

            <div className="flex w-fit items-center gap-3">
              <Controller
                name="remember"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="remember"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
              <label className="cursor-pointer text-sm text-foreground" htmlFor="remember">
                Manter meu acesso neste dispositivo
              </label>
            </div>

            <Button className="group h-13 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/15" size="lg" type="submit" disabled={isSubmitting}>
              Entrar na ARENAX
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" size={19} aria-hidden="true" />
            </Button>
          </form>

          <p className="mt-12 text-center text-sm text-muted-foreground">
            Precisa de ajuda? <a className="font-semibold text-foreground hover:text-primary" href="mailto:suporte@arenax.com.br">Fale com o suporte</a>
          </p>
          <p className="mt-16 text-center text-xs text-muted-foreground">© 2026 ARENAX · Operação inteligente para arenas</p>
        </div>
      </section>
      {forgotModalOpen && (
        <FormModal title="Redefinir senha" onClose={() => setForgotModalOpen(false)} size="sm">
          <form
            className="w-full p-6"
            onSubmit={forgotForm.handleSubmit(submitForgotPassword)}
            noValidate
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-secondary p-2.5 text-primary">
                  <Mail size={20} aria-hidden="true" />
                </span>
                <h2 className="text-xl font-semibold">Redefinir senha</h2>
              </div>
              <ModalCloseButton onClick={() => setForgotModalOpen(false)} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Informe seu e-mail para receber as instruções de redefinição.
            </p>
            <label className="mt-5 block text-sm font-semibold">
              E-mail
              <Input
                className="mt-2"
                type="email"
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(forgotForm.formState.errors.email)}
                {...forgotForm.register("email")}
              />
            </label>
            {forgotForm.formState.errors.email && (
              <p className="error-message">{forgotForm.formState.errors.email.message}</p>
            )}
            {forgotResult && (
              <div className="mt-5 rounded-xl border border-border bg-secondary p-4 text-sm text-foreground">
                <p>{forgotResult.message}</p>
                {forgotResult.reset_url && (
                  <a
                    className="mt-3 block break-all font-semibold text-primary hover:underline"
                    href={forgotResult.reset_url}
                  >
                    Abrir link local de redefinição
                  </a>
                )}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button className="operation-button" type="button" onClick={() => setForgotModalOpen(false)}>
                Fechar
              </button>
              <button className="operation-button operation-button-primary" disabled={forgotForm.formState.isSubmitting}>
                Enviar instruções
              </button>
            </div>
          </form>
        </FormModal>
      )}
    </main>
  );
}
