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

export type Space = { id: string; name: string; administrative_status: string; minute_rate_cents: number };
export type Client = { id: string; name: string; administrative_status: "active" | "inactive" };
export type SessionStatus = "scheduled" | "confirmed" | "in_progress" | "finished" | "archived" | "cancelled" | "no_show";
export type ArenaSession = {
  id: string;
  responsible_client_id: string;
  space_ids: string[];
  scheduled_start: string;
  scheduled_end: string;
  status: SessionStatus;
  actual_start: string | null;
  actual_end: string | null;
};

export type OperationalEvent = {
  resource: "sessions" | "spaces" | "clients";
  occurred_at: string;
  entity_id: string | null;
};

export function subscribeToOperationalEvents(
  onEvent: (event: OperationalEvent) => void,
  onConnectionChange: (connected: boolean) => void,
) {
  const source = new EventSource(`${API_URL}/api/v1/operational-events`, {
    withCredentials: true,
  });
  source.addEventListener("ready", () => onConnectionChange(true));
  source.addEventListener("operational-update", (message) => {
    try {
      onEvent(JSON.parse(message.data) as OperationalEvent);
    } catch {
      // Ignore malformed signals; the fallback polling still refreshes server state.
    }
  });
  source.onerror = () => onConnectionChange(false);
  return () => {
    source.close();
    onConnectionChange(false);
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string; message?: string } | null;
    throw new Error(body?.message ?? body?.detail ?? "Não foi possível concluir a operação.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

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

export const getSpaces = () => apiRequest<Space[]>("/api/v1/spaces");
export const getClients = () => apiRequest<Client[]>("/api/v1/clients");
export const createClient = (name: string) => apiRequest<{ id: string }>("/api/v1/clients", { method: "POST", body: JSON.stringify({ name }) });
export const updateClient = (clientId: string, input: Pick<Client, "name" | "administrative_status">) => apiRequest<Client>(`/api/v1/clients/${clientId}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteClient = (clientId: string) => apiRequest<void>(`/api/v1/clients/${clientId}`, { method: "DELETE" });
export const createSpace = (input: Pick<Space, "name" | "minute_rate_cents">) => apiRequest<{ id: string }>("/api/v1/spaces", { method: "POST", body: JSON.stringify(input) });
export const updateSpace = (spaceId: string, input: Pick<Space, "name" | "administrative_status" | "minute_rate_cents">) => apiRequest<Space>(`/api/v1/spaces/${spaceId}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteSpace = (spaceId: string) => apiRequest<void>(`/api/v1/spaces/${spaceId}`, { method: "DELETE" });

export function getSessions(start: Date, end: Date): Promise<ArenaSession[]> {
  const query = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  return apiRequest<ArenaSession[]>(`/api/v1/sessions?${query}`);
}

export const getInProgressSessions = () =>
  apiRequest<ArenaSession[]>("/api/v1/sessions/in-progress");

export function transitionSession(sessionId: string, action: "confirm" | "start" | "finish" | "cancel" | "no_show") {
  return apiRequest<ArenaSession | undefined>(`/api/v1/sessions/${sessionId}/actions/${action}`, { method: "POST" });
}

export function extendSession(session: ArenaSession, minutes = 30) {
  const scheduledEnd = new Date(session.scheduled_end);
  scheduledEnd.setMinutes(scheduledEnd.getMinutes() + minutes);
  return apiRequest<ArenaSession>(`/api/v1/sessions/${session.id}/extend`, {
    method: "POST",
    body: JSON.stringify({ scheduled_end: scheduledEnd.toISOString() }),
  });
}

export type ManagedUser = AuthenticatedUser & {
  status: "ativo" | "bloqueado" | "desativado";
  created_at: string;
  updated_at: string;
  last_access_at: string | null;
};

export const getUsers = () => apiRequest<ManagedUser[]>("/api/v1/users");

export function createUser(input: { name: string; email: string; password: string; role: AuthenticatedUser["role"] }) {
  return apiRequest<ManagedUser>("/api/v1/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(userId: string, input: Pick<ManagedUser, "role" | "status">) {
  return apiRequest<ManagedUser>(`/api/v1/users/${userId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function resetUserPassword(userId: string, password: string) {
  return apiRequest<void>(`/api/v1/users/${userId}/reset-password`, { method: "POST", body: JSON.stringify({ password }) });
}

export type Equipment = { id: string; space_id: string; kind: "camera" | "ax_device"; external_id: string; configuration: Record<string, unknown>; administrative_status: "active" | "inactive" };
export type SessionMoment = {
  id: string;
  space_id: string;
  occurred_at: string;
  status: string;
  replay_path: string | null;
};
export type TimelineEntry = { kind: string; occurred_at: string; data: Record<string, unknown> };
export type PaymentMethod = "cash" | "pix" | "debit_card" | "credit_card" | "other";
export type SessionPayment = {
  id: string;
  amount_cents: number;
  method: PaymentMethod;
  note: string | null;
  registered_at: string;
  registered_by: string;
};
export type SessionDossier = ArenaSession & { expected_amount_cents: number; expected_amount_is_manual: boolean; calculate_actual_time: boolean; moments: SessionMoment[]; payments: SessionPayment[]; timeline: TimelineEntry[] };

export const getEquipments = (spaceId?: string) => apiRequest<Equipment[]>(`/api/v1/equipments${spaceId ? `?space_id=${spaceId}` : ""}`);
export const createEquipment = (input: Omit<Equipment, "id">) => apiRequest<{ id: string }>("/api/v1/equipments", { method: "POST", body: JSON.stringify(input) });
export const updateEquipment = (equipmentId: string, input: Omit<Equipment, "id">) => apiRequest<Equipment>(`/api/v1/equipments/${equipmentId}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteEquipment = (equipmentId: string) => apiRequest<void>(`/api/v1/equipments/${equipmentId}`, { method: "DELETE" });
export const getCameraLive = (cameraId: string) => apiRequest<{ url: string }>(`/api/v1/cameras/${cameraId}/live`, { method: "POST" });
export const getSessionDossier = (sessionId: string) => apiRequest<SessionDossier>(`/api/v1/sessions/${sessionId}`);
export const registerPayment = (sessionId: string, input: { amount_cents: number; method: PaymentMethod; note?: string }) =>
  apiRequest<SessionPayment>(`/api/v1/sessions/${sessionId}/payments`, { method: "POST", body: JSON.stringify(input) });
export const changeExpectedAmount = (sessionId: string, amountCents: number) =>
  apiRequest<{ amount_cents: number }>(`/api/v1/sessions/${sessionId}/expected-amount`, { method: "PUT", body: JSON.stringify({ amount_cents: amountCents }) });
export const recalculateExpectedAmount = (sessionId: string) =>
  apiRequest<{ amount_cents: number }>(`/api/v1/sessions/${sessionId}/expected-amount/recalculate`, { method: "POST" });

export function createSession(input: { responsible_client_id: string; space_ids: string[]; scheduled_start: string; scheduled_end: string }) {
  return apiRequest<ArenaSession>("/api/v1/sessions", { method: "POST", body: JSON.stringify(input) });
}

export const replayUrl = (momentId: string) => `${API_URL}/api/v1/moments/${momentId}/replay`;

export type OperationalSettings = {
  default_session_duration_minutes: number;
  replay_pre_duration_seconds: number;
  replay_post_duration_seconds: number;
  calculate_actual_time: boolean;
  updated_at: string;
};

export type OperationalSettingsInput = Omit<OperationalSettings, "updated_at">;

export const getOperationalSettings = () =>
  apiRequest<OperationalSettings>("/api/v1/settings");

export const updateOperationalSettings = (input: OperationalSettingsInput) =>
  apiRequest<OperationalSettings>("/api/v1/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
