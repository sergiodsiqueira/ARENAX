const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type LoginInput = {
  email: string;
  password: string;
  remember: boolean;
};

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "proprietario" | "administrador" | "operador";
};

export async function login(input: LoginInput): Promise<AuthenticatedUser> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("E-mail ou senha inválidos.");
  }
  const result = (await response.json()) as { user: AuthenticatedUser };
  return result.user;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const response = await fetch(`${API_URL}/api/v1/auth/me`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Acesso não autenticado");
  }
  return response.json() as Promise<AuthenticatedUser>;
}
