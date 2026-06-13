import {
  AdminActionResponse,
  AdminUserListResponse,
  AppUser,
  AuthStatusResponse,
  BranchFeedbackBreakdownResponse,
  CaseCreateRequest,
  CaseListResponse,
  CaseResponse,
  CaseStatusUpdateResponse,
  DeviceListResponse,
  DispatchRouteRequest,
  DispatchRouteResponse,
  ECLocationListResponse,
  FeedbackCreateRequest,
  FeedbackCreateResponse,
  FeedbackLanguageCandidateResponse,
  FeedbackSummaryResponse,
  FeedbackTagBreakdownResponse,
  InteractionTelemetryPayload,
  InteractionTelemetryResponse,
  OpsSessionResponse,
  OpsTelemetrySummaryResponse,
  PartsPredictionResponse,
  ProcedureFeedbackBreakdownResponse,
  RegisterRequest,
  RepairFamilyDetail,
  RepairFamilyLearningModule,
  RepairFamilySummary,
  RelatedResponse,
  SearchResponse,
  TriageNextResponse,
  TriageStartResponse,
  WarrantyNextRequest,
  WarrantyNextResponse
} from "@/lib/types";

export type SearchOutputMode = "issue_interpretation" | "diagnostic_path" | "sop_action";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
const effectiveApiBaseUrl = configuredApiBaseUrl || "/api";
const enforceGatewayInProduction =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_ENFORCE_API_GATEWAY !== "false"
    : process.env.NEXT_PUBLIC_ENFORCE_API_GATEWAY === "true";

if (enforceGatewayInProduction && process.env.NODE_ENV === "production" && effectiveApiBaseUrl !== "/api") {
  throw new Error(
    "Invalid NEXT_PUBLIC_API_BASE_URL for production. Set NEXT_PUBLIC_API_BASE_URL=/api so all frontend traffic flows through the Next.js gateway."
  );
}

const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/$/, "")
  : "/api";
const API_TIMEOUT_MS = 15000;
const FAMILY_CACHE_KEY = "diaghub-family-summaries";
const FAMILY_DETAIL_CACHE_PREFIX = "diaghub-family-detail-";
const FAMILY_MODULE_CACHE_PREFIX = "diaghub-family-module-";
const clientRequestCorrelationEnabled =
  process.env.NEXT_PUBLIC_CLIENT_REQUEST_ID_ENABLED !== "false";

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export class ApiError extends Error {
  status: number;
  requestId: string | null;
  code: string | null;
  detail: string | null;

  constructor(
    message: string,
    status: number,
    options?: { requestId?: string | null; code?: string | null; detail?: string | null }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = options?.requestId || null;
    this.code = options?.code || null;
    this.detail = options?.detail || null;
  }
}

type ApiRequestOptions = RequestInit & {
  authenticated?: boolean;
};

function createClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.round(Math.random() * 1000000)}`;
}

function formatSupportRequestIdHint(requestId: string | null): string {
  return `Request ID: ${requestId || "Unavailable"} - copy this for support.`;
}

type ParsedApiError = {
  message: string;
  detail: string | null;
  code: string | null;
  requestId: string | null;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function parseApiError(
  response: Response,
  fallbackMessage = "Something went wrong. Please try again."
): Promise<ParsedApiError> {
  const headerRequestId = response.headers.get("X-Request-ID");
  let code: string | null = null;
  let message: string | null = null;
  let detail: string | null = null;
  let envelopeRequestId: string | null = null;

  try {
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.toLowerCase().includes("application/json")) {
      const payload = (await response.json()) as unknown;
      if (isObjectRecord(payload)) {
        code = pickStringField(payload, "code");
        message = pickStringField(payload, "message");
        detail = pickStringField(payload, "detail");
        envelopeRequestId = pickStringField(payload, "request_id");
      }
    } else {
      const rawText = await response.text();
      if (rawText.trim().startsWith("{")) {
        try {
          const payload = JSON.parse(rawText) as unknown;
          if (isObjectRecord(payload)) {
            code = pickStringField(payload, "code");
            message = pickStringField(payload, "message");
            detail = pickStringField(payload, "detail");
            envelopeRequestId = pickStringField(payload, "request_id");
          }
        } catch {
          // Ignore malformed text bodies and use fallback messaging below.
        }
      }
    }
  } catch {
    // Ignore parse errors entirely so this helper never throws.
  }

  const normalizedDetail = detail || message || fallbackMessage;
  return {
    message: normalizedDetail,
    detail,
    code,
    requestId: envelopeRequestId || headerRequestId
  };
}

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
  const clientRequestId = clientRequestCorrelationEnabled ? createClientRequestId() : null;
  if (clientRequestId && !headers.has("X-Client-Request-ID")) {
    headers.set("X-Client-Request-ID", clientRequestId);
  }
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
    const parsedError = await parseApiError(response, fallbackMessage);
    const supportHint = formatSupportRequestIdHint(parsedError.requestId);
    console.error(supportHint);
    throw new ApiError(`${parsedError.message} ${supportHint}`, response.status, {
      requestId: parsedError.requestId,
      code: parsedError.code,
      detail: parsedError.detail
    });
  }

  return (await response.json()) as T;
}

type SearchProceduresOptions = {
  signal?: AbortSignal;
  outputMode?: SearchOutputMode;
};

export function searchProcedures(
  query: string,
  options?: SearchProceduresOptions
): Promise<SearchResponse> {
  const payload: Record<string, string> = { query };
  if (options?.outputMode) {
    payload.output_mode = options.outputMode;
  }
  return apiRequest<SearchResponse>("/search", {
    method: "POST",
    body: JSON.stringify(payload),
    signal: options?.signal
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

export function getRepairFamilyLearningModule(familyId: string): Promise<RepairFamilyLearningModule> {
  return withOfflineCache(`${FAMILY_MODULE_CACHE_PREFIX}${familyId}`, () =>
    apiRequest<RepairFamilyLearningModule>(`/families/${familyId}/module`)
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

export function warrantyNext(payload: WarrantyNextRequest): Promise<WarrantyNextResponse> {
  return apiRequest<WarrantyNextResponse>("/triage/warranty", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function dispatchRoute(payload: DispatchRouteRequest): Promise<DispatchRouteResponse> {
  return apiRequest<DispatchRouteResponse>("/triage/dispatch-route", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getDevices(): Promise<DeviceListResponse> {
  return apiRequest<DeviceListResponse>("/triage/devices");
}

export function getPartsPrediction(
  tCode: string,
  warrantyDirection?: string | null,
): Promise<PartsPredictionResponse> {
  const params = new URLSearchParams({ t_code: tCode });
  if (warrantyDirection) {
    params.set("warranty_direction", warrantyDirection);
  }
  return apiRequest<PartsPredictionResponse>(`/triage/parts-prediction?${params.toString()}`);
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

export function getOpsFeedbackSummary(days: number): Promise<FeedbackSummaryResponse> {
  return apiRequest<FeedbackSummaryResponse>(`/feedback/summary?days=${days}`, {
    authenticated: true
  });
}

export function getOpsFeedbackByProcedure(
  days: number
): Promise<ProcedureFeedbackBreakdownResponse> {
  return apiRequest<ProcedureFeedbackBreakdownResponse>(`/feedback/by-procedure?days=${days}`, {
    authenticated: true
  });
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

export function getOpsTelemetrySummary(): Promise<OpsTelemetrySummaryResponse> {
  return apiRequest<OpsTelemetrySummaryResponse>("/ops/telemetry/summary", {
    authenticated: true,
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function getAuthStatus(): Promise<AuthStatusResponse> {
  return apiRequest<AuthStatusResponse>("/auth/me", { credentials: "include" });
}

export function getECLocations(): Promise<ECLocationListResponse> {
  return apiRequest<ECLocationListResponse>("/auth/locations");
}

export function registerUser(payload: RegisterRequest): Promise<AuthStatusResponse> {
  return apiRequest<AuthStatusResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export function logoutUser(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function getGoogleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google`;
}

export function listAdminUsers(): Promise<AdminUserListResponse> {
  return apiRequest<AdminUserListResponse>("/admin/users", { credentials: "include" });
}

export function approveUser(userId: number): Promise<AdminActionResponse> {
  return apiRequest<AdminActionResponse>(`/admin/users/${userId}/approve`, {
    method: "POST",
    credentials: "include",
  });
}

export function suspendUser(userId: number): Promise<AdminActionResponse> {
  return apiRequest<AdminActionResponse>(`/admin/users/${userId}/suspend`, {
    method: "POST",
    credentials: "include",
  });
}

export function submitCase(payload: CaseCreateRequest): Promise<CaseResponse> {
  return apiRequest<CaseResponse>("/cases", {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export function listCases(): Promise<CaseListResponse> {
  return apiRequest<CaseListResponse>("/cases", { credentials: "include" });
}

export function getCase(reference: string): Promise<CaseResponse> {
  return apiRequest<CaseResponse>(`/cases/${encodeURIComponent(reference)}`, {
    credentials: "include",
  });
}

export function updateCaseStatus(
  reference: string,
  status: string,
  waybill_number?: string
): Promise<CaseStatusUpdateResponse> {
  return apiRequest<CaseStatusUpdateResponse>(
    `/cases/${encodeURIComponent(reference)}/status`,
    {
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ status, waybill_number: waybill_number ?? null }),
    }
  );
}

export function recordInteractionTelemetry(
  payload: InteractionTelemetryPayload
): Promise<InteractionTelemetryResponse> {
  return apiRequest<InteractionTelemetryResponse>("/telemetry/interaction", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
