export type HandshakeFailureReason = "unreachable" | "unhealthy" | "version_mismatch";

export type ReadyProbePayload = {
  status: "ok" | "degraded";
  checks?: Record<string, "ok" | "failed">;
  failed?: string[];
  latency_ms?: number;
};

export type StartupHandshakeResult =
  | {
      ok: true;
      requestId: string | null;
      payload: ReadyProbePayload;
      latencyMs: number;
    }
  | {
      ok: false;
      reason: HandshakeFailureReason;
      message: string;
      requestId: string | null;
      statusCode: number | null;
    };

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === "true";
}

export function isBootHandshakeEnabled(): boolean {
  const defaultEnabled = process.env.NODE_ENV === "production";
  return parseBooleanFlag(process.env.NEXT_PUBLIC_BOOT_HANDSHAKE_ENABLED, defaultEnabled);
}

export function getBootHandshakeTimeoutMs(): number {
  const configured = Number(process.env.NEXT_PUBLIC_BOOT_HANDSHAKE_TIMEOUT_MS || "5000");
  if (!Number.isFinite(configured) || configured < 500) {
    return 5000;
  }
  return Math.round(configured);
}

export async function probeStartupReadiness(timeoutMs: number): Promise<StartupHandshakeResult> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/ready", {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-Client-Request-ID":
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `boot-${Date.now()}`,
      },
      signal: controller.signal,
    });
    const requestId = response.headers.get("X-Request-ID");
    const latencyMs = Math.round(performance.now() - startedAt);

    let payload: ReadyProbePayload | null = null;
    try {
      payload = (await response.json()) as ReadyProbePayload;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: payload?.status === "degraded" ? "unhealthy" : "unreachable",
        message:
          payload?.status === "degraded"
            ? "Backend reachable, but one or more readiness checks failed."
            : "Readiness probe did not complete successfully.",
        requestId,
        statusCode: response.status,
      };
    }

    return {
      ok: true,
      requestId,
      payload: payload || { status: "ok" },
      latencyMs,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        reason: "unreachable",
        message: "The readiness probe timed out before the backend responded.",
        requestId: null,
        statusCode: null,
      };
    }
    return {
      ok: false,
      reason: "unreachable",
      message: "The app could not reach /api/ready. Check gateway and backend services.",
      requestId: null,
      statusCode: null,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
