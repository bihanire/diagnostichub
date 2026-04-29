import { TriageSession } from "@/lib/types";

const STORAGE_KEY = "relational-encyclopedia-session";

export function loadSession(): TriageSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TriageSession>;
    return {
      ...parsed,
      history: parsed.history || [],
      dispatchGateConfirmed: parsed.dispatchGateConfirmed || []
    } as TriageSession;
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
