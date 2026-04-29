type ClientDiagnosticSeverity = "info" | "warn" | "error";

type ClientDiagnosticEntry = {
  event: string;
  severity: ClientDiagnosticSeverity;
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
};

const DIAGNOSTIC_CACHE_KEY = "diaghub-client-diagnostics";
const MAX_DIAGNOSTIC_ENTRIES = 30;

export function recordClientDiagnostic(
  event: string,
  options: {
    severity?: ClientDiagnosticSeverity;
    message: string;
    details?: Record<string, unknown>;
  }
): void {
  if (typeof window === "undefined") {
    return;
  }

  const entry: ClientDiagnosticEntry = {
    event,
    severity: options.severity || "warn",
    message: options.message,
    details: options.details,
    created_at: new Date().toISOString()
  };

  try {
    const current = readClientDiagnostics();
    const nextEntries = [entry, ...current].slice(0, MAX_DIAGNOSTIC_ENTRIES);
    window.localStorage.setItem(
      DIAGNOSTIC_CACHE_KEY,
      JSON.stringify(nextEntries)
    );
    window.dispatchEvent(
      new CustomEvent("diaghub:diagnostic", {
        detail: entry
      })
    );
  } catch {
    // Diagnostics must never interrupt the user workflow.
  }
}

export function readClientDiagnostics(): ClientDiagnosticEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(DIAGNOSTIC_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
