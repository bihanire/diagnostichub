import {
  BranchFeedbackBreakdownResponse,
  FeedbackCreateRequest,
  FeedbackCreateResponse,
  FeedbackLanguageCandidateResponse,
  FeedbackSummaryResponse,
  FeedbackTagBreakdownResponse,
  InteractionTelemetryPayload,
  InteractionTelemetryResponse,
  OpsSessionResponse,
  ProcedureFeedbackBreakdownResponse,
  RepairFamilyDetail,
  RepairFamilySummary,
  RelatedResponse,
  SearchResponse,
  TriageNextResponse,
  TriageStartResponse
} from "@/lib/types";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/$/, "")
  : "/api";
const API_TIMEOUT_MS = 15000;
const FAMILY_CACHE_KEY = "diaghub-family-summaries";
const FAMILY_DETAIL_CACHE_PREFIX = "diaghub-family-detail-";

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiRequestOptions = RequestInit & {
  authenticated?: boolean;
};

async function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError(
      "You appear to be offline. Reconnect to continue with search, triage, or feedback.",
      0
    );
  }

  const controller = new AbortController();
  const externalSignal = options?.signal;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  const abortFromCaller = () => {
    controller.abort();
  };
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && options.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: options?.authenticated ? "include" : options?.credentials,
      headers,
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (timedOut) {
        throw new ApiError(
          "The request is taking too long. Check the network and try again.",
          0
        );
      }
      throw new ApiError("Request cancelled.", 499);
    }
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        throw new ApiError(
          "The request is taking too long. Check the network and try again.",
          0
        );
      }
      throw new ApiError("Request cancelled.", 499);
    }
    if (controller.signal.aborted && !timedOut) {
      throw new ApiError("Request cancelled.", 499);
    }
    if (controller.signal.aborted && timedOut) {
      throw new ApiError(
        "The request is taking too long. Check the network and try again.",
        0
      );
    }

    throw new ApiError(
      "The app could not reach the server. Check the network and try again.",
      0
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    const fallbackMessage = "Something went wrong. Please try again.";
    let detail = fallbackMessage;

    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      detail = payload.detail || payload.message || fallbackMessage;
    } catch {
      detail = fallbackMessage;
    }

    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export function searchProcedures(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return apiRequest<SearchResponse>("/search", {
    method: "POST",
    body: JSON.stringify({ query }),
    signal
  });
}

export function getRepairFamilies(): Promise<RepairFamilySummary[]> {
  return withOfflineCache(FAMILY_CACHE_KEY, () => apiRequest<RepairFamilySummary[]>("/families"));
}

export function getCachedRepairFamilies(): RepairFamilySummary[] | null {
  return readCache<RepairFamilySummary[]>(FAMILY_CACHE_KEY);
}

export function clearCachedRepairFamilies(): void {
  removeCache(FAMILY_CACHE_KEY);
}

export function getRepairFamilyDetail(familyId: string): Promise<RepairFamilyDetail> {
  return withOfflineCache(`${FAMILY_DETAIL_CACHE_PREFIX}${familyId}`, () =>
    apiRequest<RepairFamilyDetail>(`/families/${familyId}`)
  );
}

async function withOfflineCache<T>(cacheKey: string, request: () => Promise<T>): Promise<T> {
  try {
    const response = await request();
    writeCache(cacheKey, response);
    return response;
  } catch (error) {
    const cached = readCache<T>(cacheKey);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

function writeCache<T>(cacheKey: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(value));
  } catch {
    // Ignore cache write failures so the live request always remains primary.
  }
}

function readCache<T>(cacheKey: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function removeCache(cacheKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(cacheKey);
  } catch {
    // Cache cleanup is best-effort and must not affect diagnosis flow.
  }
}

export function startTriage(procedureId: number): Promise<TriageStartResponse> {
  return apiRequest<TriageStartResponse>("/triage/start", {
    method: "POST",
    body: JSON.stringify({ procedure_id: procedureId })
  });
}

export function nextTriage(nodeId: number, answer: "yes" | "no"): Promise<TriageNextResponse> {
  return apiRequest<TriageNextResponse>("/triage/next", {
    method: "POST",
    body: JSON.stringify({ node_id: nodeId, answer })
  });
}

export function getRelated(procedureId: number): Promise<RelatedResponse> {
  return apiRequest<RelatedResponse>(`/related/${procedureId}`);
}

export function submitFeedback(payload: FeedbackCreateRequest): Promise<FeedbackCreateResponse> {
  return apiRequest<FeedbackCreateResponse>("/feedback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getFeedbackSummary(days: number): Promise<FeedbackSummaryResponse> {
  return apiRequest<FeedbackSummaryResponse>(`/feedback/summary?days=${days}`);
}

export function getOpsFeedbackSummary(days: number): Promise<FeedbackSummaryResponse> {
  return apiRequest<FeedbackSummaryResponse>(`/feedback/summary?days=${days}`, {
    authenticated: true
  });
}

export function getFeedbackByProcedure(days: number): Promise<ProcedureFeedbackBreakdownResponse> {
  return apiRequest<ProcedureFeedbackBreakdownResponse>(`/feedback/by-procedure?days=${days}`);
}

export function getOpsFeedbackByProcedure(
  days: number
): Promise<ProcedureFeedbackBreakdownResponse> {
  return apiRequest<ProcedureFeedbackBreakdownResponse>(`/feedback/by-procedure?days=${days}`, {
    authenticated: true
  });
}

export function getFeedbackByBranch(days: number): Promise<BranchFeedbackBreakdownResponse> {
  return apiRequest<BranchFeedbackBreakdownResponse>(`/feedback/by-branch?days=${days}`);
}

export function getOpsFeedbackByBranch(days: number): Promise<BranchFeedbackBreakdownResponse> {
  return apiRequest<BranchFeedbackBreakdownResponse>(`/feedback/by-branch?days=${days}`, {
    authenticated: true
  });
}

export function getOpsFeedbackLanguageCandidates(
  days: number,
  limit = 20
): Promise<FeedbackLanguageCandidateResponse> {
  return apiRequest<FeedbackLanguageCandidateResponse>(
    `/feedback/language-candidates?days=${days}&limit=${limit}`,
    {
      authenticated: true
    }
  );
}

export function getOpsFeedbackByTag(days: number): Promise<FeedbackTagBreakdownResponse> {
  return apiRequest<FeedbackTagBreakdownResponse>(`/feedback/by-tag?days=${days}`, {
    authenticated: true
  });
}

export function getOpsSession(): Promise<OpsSessionResponse> {
  return apiRequest<OpsSessionResponse>("/ops/session", {
    authenticated: true
  });
}

export function loginOps(password: string): Promise<OpsSessionResponse> {
  return apiRequest<OpsSessionResponse>("/ops/login", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ password })
  });
}

export function logoutOps(): Promise<OpsSessionResponse> {
  return apiRequest<OpsSessionResponse>("/ops/logout", {
    method: "POST",
    authenticated: true
  });
}

export function getOpsFeedbackExportUrl(days: number): string {
  return `${API_BASE_URL}/feedback/export.csv?days=${days}`;
}

export function getOpsFeedbackLanguageExportUrl(days: number, limit = 50): string {
  return `${API_BASE_URL}/feedback/language-candidates/export.csv?days=${days}&limit=${limit}`;
}

export function recordInteractionTelemetry(
  payload: InteractionTelemetryPayload
): Promise<InteractionTelemetryResponse> {
  return apiRequest<InteractionTelemetryResponse>("/telemetry/interaction", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
