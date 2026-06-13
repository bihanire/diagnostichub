import { TriageSession } from "@/lib/types";

const STORAGE_KEY = "relational-encyclopedia-session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeTriageSession(value: unknown): TriageSession | null {
  if (!isRecord(value) || !isRecord(value.procedure) || !isRecord(value.progress)) {
    return null;
  }

  if (
    !isFiniteNumber(value.procedure.id) ||
    !hasText(value.procedure.title) ||
    !hasText(value.procedure.category) ||
    !hasText(value.procedure.description) ||
    !isFiniteNumber(value.progress.step) ||
    !isFiniteNumber(value.progress.total)
  ) {
    return null;
  }

  const session = value as Partial<TriageSession>;
  return {
    ...session,
    query: hasText(session.query) ? session.query : session.procedure?.title,
    currentNode: session.currentNode || null,
    outcome: session.outcome || null,
    related: Array.isArray(session.related) ? session.related : [],
    history: Array.isArray(session.history) ? session.history : [],
    dispatchGateConfirmed: Array.isArray(session.dispatchGateConfirmed)
      ? session.dispatchGateConfirmed
      : [],
    warrantyAutoSkipped: typeof session.warrantyAutoSkipped === "boolean" ? session.warrantyAutoSkipped : undefined,
    warrantyAnswers: Array.isArray(session.warrantyAnswers) ? session.warrantyAnswers : undefined,
    device: isRecord(session.device) && typeof (session.device as Record<string, unknown>).id === "number"
      ? session.device as TriageSession["device"]
      : undefined,
    updatedAt: hasText(session.updatedAt) ? session.updatedAt : new Date().toISOString(),
  } as TriageSession;
}

export function loadSession(): TriageSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const session = normalizeTriageSession(parsed);
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: TriageSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
