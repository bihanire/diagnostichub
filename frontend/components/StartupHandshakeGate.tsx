"use client";

import { useEffect, useMemo, useState } from "react";

import {
  HandshakeFailureReason,
  getBootHandshakeTimeoutMs,
  isBootHandshakeEnabled,
  probeStartupReadiness,
} from "@/lib/startup-handshake";

type GateState =
  | { phase: "loading"; startedAt: number }
  | {
      phase: "failed";
      reason: HandshakeFailureReason;
      message: string;
      requestId: string | null;
      statusCode: number | null;
    }
  | { phase: "ready" };

function reasonLabel(reason: HandshakeFailureReason): string {
  if (reason === "unhealthy") {
    return "Backend unhealthy";
  }
  if (reason === "version_mismatch") {
    return "Version mismatch";
  }
  return "Backend unreachable";
}

export function StartupHandshakeGate({ children }: { children: React.ReactNode }) {
  const enabled = isBootHandshakeEnabled();
  const timeoutMs = getBootHandshakeTimeoutMs();
  const [state, setState] = useState<GateState>(() =>
    enabled ? { phase: "loading", startedAt: Date.now() } : { phase: "ready" }
  );
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!enabled || state.phase !== "loading") {
      return;
    }

    let mounted = true;

    void probeStartupReadiness(timeoutMs).then((result) => {
      if (!mounted) {
        return;
      }

      if (result.ok) {
        setState({ phase: "ready" });
        return;
      }

      setState({
        phase: "failed",
        reason: result.reason,
        message: result.message,
        requestId: result.requestId,
        statusCode: result.statusCode,
      });
    });

    return () => {
      mounted = false;
    };
  }, [enabled, timeoutMs, state.phase]);

  useEffect(() => {
    if (state.phase !== "loading") {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - state.startedAt);
    }, 200);

    return () => {
      window.clearInterval(interval);
    };
  }, [state]);

  const takingLong = state.phase === "loading" && elapsedMs > Math.min(timeoutMs - 400, 2500);

  const loadingMessage = useMemo(() => {
    if (state.phase !== "loading") {
      return "";
    }
    if (takingLong) {
      return "Connection check is taking longer than expected.";
    }
    return "Checking backend readiness before loading the workspace.";
  }, [state, takingLong]);

  if (state.phase === "ready") {
    return <>{children}</>;
  }

  if (state.phase === "failed") {
    return (
      <main className="startup-gate" role="alert" aria-live="assertive">
        <section className="startup-gate-card">
          <h1>DiagnosticHub is not ready yet</h1>
          <p className="startup-gate-reason">{reasonLabel(state.reason)}</p>
          <p>{state.message}</p>
          <p className="startup-gate-meta">
            Status: {state.statusCode ?? "No HTTP response"}
          </p>
          <p className="startup-gate-meta">
            Request ID: {state.requestId || "Unavailable"}
          </p>
          <button
            className="startup-gate-retry"
            onClick={() =>
              setState({ phase: "loading", startedAt: Date.now() })
            }
            type="button"
          >
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="startup-gate" aria-busy="true" aria-live="polite">
      <section className="startup-gate-card">
        <h1>Preparing DiagnosticHub</h1>
        <p>{loadingMessage}</p>
        <p className="startup-gate-meta">
          Timeout budget: {Math.round(timeoutMs / 1000)}s
        </p>
      </section>
    </main>
  );
}
