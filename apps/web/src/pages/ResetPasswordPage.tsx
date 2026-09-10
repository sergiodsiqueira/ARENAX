import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { resetPassword } from "../lib/api";

const resetPasswordSchema = z
  .object({
    password: z.string().min(12, "A senha deve possuir ao menos 12 caracteres."),
    confirmation: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "As senhas informadas não conferem.",
    path: ["confirmation"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [completed, setCompleted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
  });

  const submit = async (data: ResetPasswordForm) => {
    if (!token) {
      toast.error("Link de redefinição inválido.");
      return;
    }
    try {
      await resetPassword(token, data.password);
      setCompleted(true);
      toast.success("Senha redefinida com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground sm:px-12">
      <section className="w-full max-w-[430px]">
        <Link className="mx-auto mb-10 block w-fit" to="/login" aria-label="ArenaX">
          <img
            className="h-[10rem] w-auto object-contain"
            src="/branding/LOGOTIPO_TRANSPARENTE.png"
            alt="ArenaX"
          />
        </Link>

        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold tracking-wide text-primary">ACESSO ARENAX</p>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] text-foreground">Redefinir senha</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Crie uma nova senha para voltar a acessar sua arena.
          </p>
        </div>

        {!token && (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Este link de redefinição está incompleto. Solicite um novo link na tela de login.
          </div>
        )}

        {completed ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Sua senha foi atualizada. Use a nova senha para entrar novamente.
            </p>
            <Button className="mt-5 w-full" onClick={() => navigate("/login", { replace: true })}>
              Voltar para o login
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <div>
              <label className="field-label" htmlFor="password">Nova senha</label>
              <div className={`field-shell ${errors.password ? "field-error" : ""}`}>
                <LockKeyhole size={19} aria-hidden="true" />
                <Input
                  className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Informe a nova senha"
                  aria-invalid={Boolean(errors.password)}
                  disabled={!token}
                  {...register("password")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  disabled={!token}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </Button>
              </div>
              {errors.password && <p className="error-message">{errors.password.message}</p>}
            </div>

            <div>
              <label className="field-label" htmlFor="confirmation">Confirmar senha</label>
              <div className={`field-shell ${errors.confirmation ? "field-error" : ""}`}>
                <LockKeyhole size={19} aria-hidden="true" />
                <Input
                  className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  id="confirmation"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  aria-invalid={Boolean(errors.confirmation)}
                  disabled={!token}
                  {...register("confirmation")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  type="button"
                  onClick={() => setShowConfirmation((value) => !value)}
                  aria-label={showConfirmation ? "Ocultar senha" : "Mostrar senha"}
                  disabled={!token}
                >
                  {showConfirmation ? <EyeOff size={19} /> : <Eye size={19} />}
                </Button>
              </div>
              {errors.confirmation && <p className="error-message">{errors.confirmation.message}</p>}
            </div>

            <Button className="h-13 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/15" size="lg" type="submit" disabled={!token || isSubmitting}>
              Salvar nova senha
              <ArrowRight size={19} aria-hidden="true" />
            </Button>

            <Link
              className="ui-button mx-auto h-auto p-0 text-primary underline-offset-4 hover:underline"
              to="/login"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar para o login
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
