"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProductRouteShell } from "@/components/ProductRouteShell";
import { getApiBaseUrl } from "@/lib/api";
import type { StartupHandshakeResult } from "@/lib/startup-handshake";
import {
  getBootHandshakeTimeoutMs,
  getExpectedApiVersion,
  isApiVersionCheckEnabled,
  isBootHandshakeEnabled,
  probeStartupReadiness,
} from "@/lib/startup-handshake";

type DiagnosticsState =
  | { phase: "loading"; checkedAt: string | null }
  | { phase: "complete"; checkedAt: string; result: StartupHandshakeResult };

type ConfigRow = {
  label: string;
  value: string;
  tone: "positive" | "neutral" | "warning";
};

function readBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === "true";
}

function formatFlag(enabled: boolean): string {
  return enabled ? "Enabled" : "Disabled";
}

function formatCheckName(name: string): string {
  return name
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getStatusTone(row: ConfigRow): string {
  if (row.tone === "positive") {
    return "status-positive";
  }
  if (row.tone === "warning") {
    return "status-negative";
  }
  return "diagnostics-status-neutral";
}

export default function OpsDiagnosticsPage() {
  const timeoutMs = getBootHandshakeTimeoutMs();
  const [state, setState] = useState<DiagnosticsState>({
    phase: "loading",
    checkedAt: null,
  });

  const configRows = useMemo<ConfigRow[]>(() => {
    const apiBaseUrl = getApiBaseUrl();
    const gatewayMode = apiBaseUrl === "/api";
    const serviceWorkerEnabled = readBooleanFlag(
      process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER,
      false
    );
    const requestIdsEnabled = readBooleanFlag(
      process.env.NEXT_PUBLIC_CLIENT_REQUEST_ID_ENABLED,
      true
    );

    return [
      {
        label: "API gateway",
        value: apiBaseUrl,
        tone: gatewayMode ? "positive" : "warning",
      },
      {
        label: "Boot handshake",
        value: formatFlag(isBootHandshakeEnabled()),
        tone: isBootHandshakeEnabled() ? "positive" : "neutral",
      },
      {
        label: "Version contract",
        value: `${formatFlag(isApiVersionCheckEnabled())} - expects ${getExpectedApiVersion()}`,
        tone: isApiVersionCheckEnabled() ? "positive" : "neutral",
      },
      {
        label: "Handshake timeout",
        value: `${timeoutMs} ms`,
        tone: timeoutMs >= 2000 ? "positive" : "warning",
      },
      {
        label: "Request IDs",
        value: formatFlag(requestIdsEnabled),
        tone: requestIdsEnabled ? "positive" : "warning",
      },
      {
        label: "Service worker",
        value: serviceWorkerEnabled ? "Enabled" : "Disabled for live freshness",
        tone: serviceWorkerEnabled ? "neutral" : "positive",
      },
    ];
  }, [timeoutMs]);

  const runDiagnostics = useCallback(async () => {
    setState((current) => ({
      phase: "loading",
      checkedAt: current.checkedAt,
    }));

    const result = await probeStartupReadiness(timeoutMs);
    setState({
      phase: "complete",
      checkedAt: new Date().toLocaleString(),
      result,
    });
  }, [timeoutMs]);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  const result = state.phase === "complete" ? state.result : null;
  const ready = Boolean(result?.ok);
  const statusTitle = state.phase === "loading"
    ? "Checking runtime"
    : ready
      ? "Runtime checks passed"
      : "Runtime needs attention";
  const statusTone = state.phase === "loading"
    ? "diagnostics-status-neutral"
    : ready
      ? "status-positive"
      : "status-negative";

  const readinessChecks = result?.ok && result.payload.checks
    ? Object.entries(result.payload.checks)
    : [];

  return (
    <ProductRouteShell
      className="diagnostics-route"
      status={{
        phase: "Ops diagnostics",
        family: "Deployment health",
        procedure: ready ? "Ready" : state.phase === "loading" ? "Checking" : "Needs review",
        confidence: result?.ok ? `${result.latencyMs} ms` : "Live probe",
        readiness: ready ? "Operational" : "Attention needed",
      }}
    >
      <section className="hero hero-split diagnostics-hero">
        <div className="hero-copy">
          <span className="eyebrow">Ops diagnostics</span>
          <h1>Live deployment readiness</h1>
          <p>
            Confirm the frontend can reach the backend gateway, read contract metadata, and continue with the API version it expects.
          </p>
          <div className="chip-row hero-chip-row">
            <span className="chip chip-hero">Gateway check</span>
            <span className="chip chip-hero">Version contract</span>
            <span className="chip chip-hero">Request trace</span>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-card diagnostics-status-card">
            <span className="eyebrow">Current result</span>
            <span className={`status-badge ${statusTone}`}>{statusTitle}</span>
            <p className="body-copy">
              Last checked: {state.checkedAt || "Running now"}
            </p>
            <div className="action-grid">
              <button
                className="primary-button inline-action"
                disabled={state.phase === "loading"}
                onClick={runDiagnostics}
                type="button"
              >
                {state.phase === "loading" ? "Running check..." : "Run check again"}
              </button>
              <Link className="secondary-button inline-action" href="/insights">
                Open insights
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="diagnostics-grid">
        <article className="panel diagnostics-result-panel">
          <div className="panel-header">
            <span className="eyebrow">Runtime probe</span>
            <h3>Gateway and API contract</h3>
          </div>

          {state.phase === "loading" ? (
            <p className="muted-copy" role="status">
              Checking /api/ready and /api/meta with a {timeoutMs} ms budget.
            </p>
          ) : null}

          {result?.ok ? (
            <div className="diagnostics-kv-grid">
              <div>
                <span className="eyebrow">API version</span>
                <strong>{result.meta?.api_version || "Not checked"}</strong>
              </div>
              <div>
                <span className="eyebrow">Schema version</span>
                <strong>{result.meta?.schema_version || "Not checked"}</strong>
              </div>
              <div>
                <span className="eyebrow">Build</span>
                <strong>{result.meta?.build || "Unavailable"}</strong>
              </div>
              <div>
                <span className="eyebrow">Latency</span>
                <strong>{result.latencyMs} ms</strong>
              </div>
              <div>
                <span className="eyebrow">Request ID</span>
                <strong>{result.requestId || "Unavailable"}</strong>
              </div>
              <div>
                <span className="eyebrow">Readiness</span>
                <strong>{result.payload.status}</strong>
              </div>
            </div>
          ) : null}

          {result && !result.ok ? (
            <div className="diagnostics-failure">
              <p className="error-banner" role="alert">
                {result.message}
              </p>
              <div className="diagnostics-kv-grid">
                <div>
                  <span className="eyebrow">Failure type</span>
                  <strong>{formatCheckName(result.reason)}</strong>
                </div>
                <div>
                  <span className="eyebrow">HTTP status</span>
                  <strong>{result.statusCode ?? "No response"}</strong>
                </div>
                <div>
                  <span className="eyebrow">Request ID</span>
                  <strong>{result.requestId || "Unavailable"}</strong>
                </div>
                <div>
                  <span className="eyebrow">Expected API</span>
                  <strong>{result.expectedApiVersion || getExpectedApiVersion()}</strong>
                </div>
                <div>
                  <span className="eyebrow">Backend API</span>
                  <strong>{result.actualApiVersion || "Unavailable"}</strong>
                </div>
              </div>
            </div>
          ) : null}

          {result?.ok && result.versionWarning ? (
            <p className="error-banner" role="alert">
              {result.versionWarning}
            </p>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-header">
            <span className="eyebrow">Deployment flags</span>
            <h3>Frontend runtime configuration</h3>
          </div>
          <div className="diagnostics-config-list">
            {configRows.map((row) => (
              <div className="diagnostics-config-row" key={row.label}>
                <span>
                  <strong>{row.label}</strong>
                  <small>{row.value}</small>
                </span>
                <span className={`status-badge ${getStatusTone(row)}`}>
                  {row.tone === "warning" ? "Review" : row.tone === "positive" ? "Good" : "Set"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="eyebrow">Readiness checks</span>
          <h3>Backend service signals</h3>
        </div>
        {readinessChecks.length ? (
          <div className="diagnostics-check-list">
            {readinessChecks.map(([name, check]) => (
              <div className="diagnostics-config-row" key={name}>
                <span>
                  <strong>{formatCheckName(name)}</strong>
                  <small>{check === "ok" ? "Backend reported healthy." : "Backend reported a failed check."}</small>
                </span>
                <span className={`status-badge ${check === "ok" ? "status-positive" : "status-negative"}`}>
                  {check}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">
            {result?.ok
              ? "The backend returned a healthy readiness response without per-service details."
              : "Run a successful probe to view service-level readiness."}
          </p>
        )}
      </section>
    </ProductRouteShell>
  );
}
