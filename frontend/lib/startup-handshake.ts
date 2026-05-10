export type HandshakeFailureReason = "unreachable" | "unhealthy" | "version_mismatch";

export type ReadyProbePayload = {
  status: "ok" | "degraded";
  checks?: Record<string, "ok" | "failed">;
  failed?: string[];
  latency_ms?: number;
};

export type MetaProbePayload = {
  api_version: string;
  schema_version: string;
  build: string;
};

export type StartupHandshakeResult =
  | {
      ok: true;
      requestId: string | null;
      payload: ReadyProbePayload;
      latencyMs: number;
      meta: MetaProbePayload | null;
      versionWarning: string | null;
    }
  | {
      ok: false;
      reason: HandshakeFailureReason;
      message: string;
      requestId: string | null;
      statusCode: number | null;
      expectedApiVersion?: string;
      actualApiVersion?: string | null;
    };

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === "true";
}

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
const effectiveApiBaseUrl = configuredApiBaseUrl || "/api";
const enforceGatewayInProduction =
  process.env.NODE_ENV === "production"
    ? parseBooleanFlag(process.env.NEXT_PUBLIC_ENFORCE_API_GATEWAY, true)
    : parseBooleanFlag(process.env.NEXT_PUBLIC_ENFORCE_API_GATEWAY, false);
const clientRequestCorrelationEnabled =
  parseBooleanFlag(process.env.NEXT_PUBLIC_CLIENT_REQUEST_ID_ENABLED, true);

if (enforceGatewayInProduction && process.env.NODE_ENV === "production" && effectiveApiBaseUrl !== "/api") {
  throw new Error(
    "Invalid NEXT_PUBLIC_API_BASE_URL for production startup. Set NEXT_PUBLIC_API_BASE_URL=/api so all frontend requests flow through the Next.js gateway."
  );
}

export function isBootHandshakeEnabled(): boolean {
  const defaultEnabled = process.env.NODE_ENV === "production";
  return parseBooleanFlag(process.env.NEXT_PUBLIC_BOOT_HANDSHAKE_ENABLED, defaultEnabled);
}

export function isApiVersionCheckEnabled(): boolean {
  const defaultEnabled = true;
  return parseBooleanFlag(process.env.NEXT_PUBLIC_API_VERSION_CHECK_ENABLED, defaultEnabled);
}

export function getBootHandshakeTimeoutMs(): number {
  const configured = Number(process.env.NEXT_PUBLIC_BOOT_HANDSHAKE_TIMEOUT_MS || "5000");
  if (!Number.isFinite(configured) || configured < 500) {
    return 5000;
  }
  return Math.round(configured);
}

export function getExpectedApiVersion(): string {
  return process.env.NEXT_PUBLIC_EXPECTED_API_VERSION?.trim() || "1.0.0";
}

type ParsedSemVer = {
  major: number;
  minor: number;
  patch: number;
};

function createClientRequestId(prefix: string): string | null {
  if (!clientRequestCorrelationEnabled) {
    return null;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

function parseSemVer(version: string): ParsedSemVer | null {
  const trimmed = version.trim();
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export async function probeStartupReadiness(timeoutMs: number): Promise<StartupHandshakeResult> {
  const startedAt = performance.now();
  const expectedApiVersion = getExpectedApiVersion();
  const readinessController = new AbortController();
  const readinessTimeout = window.setTimeout(() => readinessController.abort(), timeoutMs);

  try {
    const readyHeaders = new Headers();
    const readyClientRequestId = createClientRequestId("boot-ready");
    if (readyClientRequestId) {
      readyHeaders.set("X-Client-Request-ID", readyClientRequestId);
    }

    const response = await fetch("/api/ready", {
      method: "GET",
      cache: "no-store",
      headers: readyHeaders,
      signal: readinessController.signal,
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

    if (!isApiVersionCheckEnabled()) {
      return {
        ok: true,
        requestId,
        payload: payload || { status: "ok" },
        latencyMs,
        meta: null,
        versionWarning: null,
      };
    }

    const metaController = new AbortController();
    const metaTimeout = window.setTimeout(() => metaController.abort(), timeoutMs);
    let metaResponse: Response;
    try {
      const metaHeaders = new Headers();
      const metaClientRequestId = createClientRequestId("boot-meta");
      if (metaClientRequestId) {
        metaHeaders.set("X-Client-Request-ID", metaClientRequestId);
      }

      metaResponse = await fetch("/api/meta", {
        method: "GET",
        cache: "no-store",
        headers: metaHeaders,
        signal: metaController.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          ok: false,
          reason: "version_mismatch",
          message: "API contract check timed out while reading backend metadata.",
          requestId,
          statusCode: null,
          expectedApiVersion,
          actualApiVersion: null,
        };
      }
      return {
        ok: false,
        reason: "version_mismatch",
        message: "Backend readiness passed, but API contract metadata could not be read.",
        requestId,
        statusCode: null,
        expectedApiVersion,
        actualApiVersion: null,
      };
    } finally {
      window.clearTimeout(metaTimeout);
    }

    const metaRequestId = metaResponse.headers.get("X-Request-ID") || requestId;
    let metaPayload: MetaProbePayload | null = null;
    try {
      metaPayload = (await metaResponse.json()) as MetaProbePayload;
    } catch {
      metaPayload = null;
    }

    if (!metaResponse.ok || !metaPayload?.api_version) {
      return {
        ok: false,
        reason: "version_mismatch",
        message: "Backend metadata is missing or invalid. An update is required before the workspace can load.",
        requestId: metaRequestId,
        statusCode: metaResponse.status,
        expectedApiVersion,
        actualApiVersion: metaPayload?.api_version ?? null,
      };
    }

    const expectedSemVer = parseSemVer(expectedApiVersion);
    const actualSemVer = parseSemVer(metaPayload.api_version);
    if (!expectedSemVer || !actualSemVer) {
      return {
        ok: false,
        reason: "version_mismatch",
        message:
          "API version format is invalid. Expected semantic versions like 1.0.0 for both frontend and backend.",
        requestId: metaRequestId,
        statusCode: metaResponse.status,
        expectedApiVersion,
        actualApiVersion: metaPayload.api_version,
      };
    }

    if (expectedSemVer.major !== actualSemVer.major) {
      return {
        ok: false,
        reason: "version_mismatch",
        message:
          "The workspace requires a backend with the same major API version. Please update and redeploy both services together.",
        requestId: metaRequestId,
        statusCode: metaResponse.status,
        expectedApiVersion,
        actualApiVersion: metaPayload.api_version,
      };
    }

    const versionWarning =
      expectedSemVer.minor !== actualSemVer.minor
        ? `Frontend expects API ${expectedApiVersion}, backend reports ${metaPayload.api_version}. Continuing with caution because major versions match.`
        : null;

    if (versionWarning) {
      console.warn(versionWarning);
    }

    return {
      ok: true,
      requestId: metaRequestId,
      payload: payload || { status: "ok" },
      latencyMs,
      meta: metaPayload,
      versionWarning,
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
    window.clearTimeout(readinessTimeout);
  }
}
