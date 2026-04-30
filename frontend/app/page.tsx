"use client";

import { FormEvent, KeyboardEvent, PointerEvent, startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FamilyExplorer } from "@/components/FamilyExplorer";
import { ProcedureMatchCard } from "@/components/ProcedureMatchCard";
import { RepairFamilyGrid } from "@/components/RepairFamilyGrid";
import { SearchAssistDropdown } from "@/components/SearchAssistDropdown";
import { SuggestionList } from "@/components/SuggestionList";
import {
  ApiError,
  clearCachedRepairFamilies,
  getCachedRepairFamilies,
  getRelated,
  getRepairFamilies,
  getRepairFamilyDetail,
  recordInteractionTelemetry,
  searchProcedures,
  startTriage
} from "@/lib/api";
import { recordClientDiagnostic } from "@/lib/client-diagnostics";
import { uiCopy } from "@/lib/copy";
import {
  BUILT_IN_REPAIR_FAMILIES,
  resolveRepairFamilies
} from "@/lib/repair-families";
import { getSearchAssistSuggestions, SearchAssistSuggestion } from "@/lib/search-assist";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import {
  InteractionTelemetryEvent,
  ProcedureSummary,
  RepairFamilyDetail,
  RepairFamilySummary,
  SearchResponse,
  TriageSession,
} from "@/lib/types";

const FAMILY_LOAD_TIMEOUT_MS = 4500;
const SEARCH_ASSIST_DEBOUNCE_MS = 200;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
  };
};

type FamilyRequestResult =
  | { kind: "success"; value: RepairFamilySummary[] }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };

type QuickDrillOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const ISSUE_TYPE_TO_FAMILY_ID: Record<string, string> = {
  "Display & Vision": "display",
  "Power & Thermal": "power",
  "Logic & Software": "logic",
  "Security & Access": "security",
  "Connectivity & I/O": "connectivity",
  "Physical & Liquid": "physical",
};

function getFamilyPrimaryProcedure(familyDetail: RepairFamilyDetail | null): ProcedureSummary | null {
  if (!familyDetail) {
    return null;
  }

  const categoryProcedure = familyDetail.common_categories
    .map((category) => category.primary_procedure)
    .find((procedure) => Boolean(procedure?.id));
  if (categoryProcedure) {
    return categoryProcedure;
  }

  return familyDetail.procedures.find((procedure) => Boolean(procedure?.id)) || null;
}

function loadFamiliesWithTimeout(request: Promise<RepairFamilySummary[]>): Promise<FamilyRequestResult> {
  const safeRequest = request
    .then((value): FamilyRequestResult => ({ kind: "success", value }))
    .catch((error): FamilyRequestResult => ({ kind: "error", error }));
  const timeout = new Promise<FamilyRequestResult>((resolve) => {
    window.setTimeout(() => resolve({ kind: "timeout" }), FAMILY_LOAD_TIMEOUT_MS);
  });

  return Promise.race([safeRequest, timeout]);
}

function applyVisualTransition(update: () => void) {
  if (typeof document === "undefined") {
    update();
    return;
  }

  const transitionDocument = document as ViewTransitionDocument;
  if (typeof transitionDocument.startViewTransition === "function") {
    transitionDocument.startViewTransition(() => {
      update();
    });
    return;
  }

  update();
}

function uniqueProcedures(items: ProcedureSummary[]): ProcedureSummary[] {
  const seen = new Set<number>();
  const ordered: ProcedureSummary[] = [];
  for (const item of items) {
    if (!item || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    ordered.push(item);
  }
  return ordered;
}

function buildReviewCandidates(result: SearchResponse): ProcedureSummary[] {
  const best = result.best_match ? [result.best_match] : [];
  const alternatives = result.alternatives.slice(0, 3);
  return uniqueProcedures([...best, ...alternatives]);
}

function pickHighestSignalIssueType(
  signals: Record<string, number> | undefined
): string | null {
  if (!signals) {
    return null;
  }

  const entries = Object.entries(signals);
  if (entries.length === 0) {
    return null;
  }
  entries.sort((left, right) => right[1] - left[1]);
  if (entries[0][1] <= 0) {
    return null;
  }
  return entries[0][0];
}

function getRecoveryFamily(
  result: SearchResponse,
  families: RepairFamilySummary[]
): RepairFamilySummary | null {
  const directIssue = result.structured_intent.issue_type || null;
  const inferredIssue =
    pickHighestSignalIssueType(result.semantic_insight?.matched_category_signals) || null;
  const targetIssue = directIssue || inferredIssue;
  const mappedFamilyId = targetIssue ? ISSUE_TYPE_TO_FAMILY_ID[targetIssue] : null;

  if (mappedFamilyId) {
    const match = families.find((family) => family.id === mappedFamilyId);
    if (match) {
      return match;
    }
  }

  return families[0] || null;
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [resumeSession, setResumeSession] = useState<TriageSession | null>(null);
  const [families, setFamilies] = useState<RepairFamilySummary[]>(BUILT_IN_REPAIR_FAMILIES);
  const [activeFamily, setActiveFamily] = useState<RepairFamilyDetail | null>(null);
  const [familyLoadingId, setFamilyLoadingId] = useState<string | null>(null);
  const [familiesError, setFamiliesError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchAssistOpen, setSearchAssistOpen] = useState(false);
  const [searchAssistLoading, setSearchAssistLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchAssistSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [searchResultKey, setSearchResultKey] = useState(0);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [quickDrillFamily, setQuickDrillFamily] = useState<RepairFamilySummary | null>(null);
  const [quickDrillOrigin, setQuickDrillOrigin] = useState<QuickDrillOrigin | null>(null);
  const [quickDrillDetail, setQuickDrillDetail] = useState<RepairFamilyDetail | null>(null);
  const [quickDrillLoading, setQuickDrillLoading] = useState(false);
  const [quickDrillError, setQuickDrillError] = useState<string | null>(null);
  const [quickDrillPrompt, setQuickDrillPrompt] = useState<string | null>(null);
  const [quickDrillPreheat, setQuickDrillPreheat] = useState(false);
  const [quickDrillClosing, setQuickDrillClosing] = useState(false);
  const [reviewCandidates, setReviewCandidates] = useState<ProcedureSummary[]>([]);
  const [reviewSelectedProcedureId, setReviewSelectedProcedureId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const familyExplorerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLTextAreaElement | null>(null);
  const quickDrillPanelRef = useRef<HTMLDivElement | null>(null);
  const quickDrillShroudRef = useRef<HTMLButtonElement | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const assistDebounceRef = useRef<number | null>(null);
  const assistBlurTimeoutRef = useRef<number | null>(null);
  const quickDrillCloseTimeoutRef = useRef<number | null>(null);
  const quickDrillPreheatTimeoutRef = useRef<number | null>(null);
  const quickDrillRequestIdRef = useRef(0);
  const quickDrillPointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const quickDrillActive = Boolean(quickDrillFamily);
  const intakeFocusActive = searching || searchAssistOpen || query.trim().length > 0;
  const quickDrillPrimaryProcedure = getFamilyPrimaryProcedure(quickDrillDetail);
  const quickDrillPrompts =
    quickDrillDetail?.common_categories
      .flatMap((category) => category.search_examples)
      .filter((prompt, index, allPrompts) => Boolean(prompt?.trim()) && allPrompts.indexOf(prompt) === index)
      .slice(0, 8) ||
    quickDrillFamily?.symptom_prompts.slice(0, 8) ||
    [];
  const reviewGateOpen = reviewCandidates.length > 1;
  const selectedReviewProcedure =
    reviewCandidates.find((item) => item.id === reviewSelectedProcedureId) || null;
  const recoveryFamily = searchResult ? getRecoveryFamily(searchResult, families) : null;

  useEffect(() => {
    setResumeSession(loadSession());
  }, []);

  useEffect(() => {
    router.prefetch("/triage");
    router.prefetch("/result");
  }, [router]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("intake-focus-mode", intakeFocusActive);
    return () => {
      document.body.classList.remove("intake-focus-mode");
    };
  }, [intakeFocusActive]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("quick-drill-open", quickDrillActive);
    return () => {
      document.body.classList.remove("quick-drill-open");
    };
  }, [quickDrillActive]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      if (assistDebounceRef.current !== null) {
        window.clearTimeout(assistDebounceRef.current);
      }
      if (assistBlurTimeoutRef.current !== null) {
        window.clearTimeout(assistBlurTimeoutRef.current);
      }
      if (quickDrillCloseTimeoutRef.current !== null) {
        window.clearTimeout(quickDrillCloseTimeoutRef.current);
      }
      if (quickDrillPreheatTimeoutRef.current !== null) {
        window.clearTimeout(quickDrillPreheatTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearchAssistLoading(false);
      setSearchSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }

    setSearchAssistLoading(true);
    if (assistDebounceRef.current !== null) {
      window.clearTimeout(assistDebounceRef.current);
    }

    assistDebounceRef.current = window.setTimeout(() => {
      const nextSuggestions = getSearchAssistSuggestions(query, families, 5);
      setSearchSuggestions(nextSuggestions);
      setActiveSuggestionIndex(-1);
      setSearchAssistLoading(false);
    }, SEARCH_ASSIST_DEBOUNCE_MS);

    return () => {
      if (assistDebounceRef.current !== null) {
        window.clearTimeout(assistDebounceRef.current);
      }
    };
  }, [families, query]);

  useEffect(() => {
    let cancelled = false;

    function applyLiveFamilies(value: unknown, source: string) {
      const response = resolveRepairFamilies(value, source, { log: true });
      if (cancelled) {
        return;
      }

      setFamilies(response.items);
      setFamiliesError(response.usedFallback ? "Family library returned no usable categories." : null);
      if (response.usedFallback) {
        clearCachedRepairFamilies();
      }
    }

    async function loadFamilies() {
      const cachedPayload = getCachedRepairFamilies();
      const cachedResolution = resolveRepairFamilies(cachedPayload, "cache", {
        log: cachedPayload !== null
      });
      const hasCachedFamilies = !cachedResolution.usedFallback;

      if (hasCachedFamilies) {
        setFamilies(cachedResolution.items);
      } else {
        setFamilies(BUILT_IN_REPAIR_FAMILIES);
        clearCachedRepairFamilies();
      }
      setFamiliesError(null);

      const liveRequest = getRepairFamilies();
      const firstResult = await loadFamiliesWithTimeout(liveRequest);

      if (firstResult.kind === "success") {
        applyLiveFamilies(firstResult.value, "api");
        return;
      }

      if (firstResult.kind === "error") {
        if (!cancelled) {
          if (!hasCachedFamilies) {
            setFamilies(BUILT_IN_REPAIR_FAMILIES);
          }
          setFamiliesError(
            firstResult.error instanceof Error
              ? firstResult.error.message
              : "Could not load the visual family workspace."
          );
          recordClientDiagnostic("visual_families_fetch_failed", {
            message: "Live visual family fetch failed; fallback family guide remains active.",
            details: {
              error: firstResult.error instanceof Error ? firstResult.error.message : String(firstResult.error),
              source: "api"
            }
          });
        }
        return;
      }

      if (!cancelled) {
        if (!hasCachedFamilies) {
          setFamilies(BUILT_IN_REPAIR_FAMILIES);
        }
        setFamiliesError("Live family data is still refreshing. The built-in family guide is ready to use.");
        recordClientDiagnostic("visual_families_fetch_slow", {
          severity: "info",
          message: "Visual family fetch exceeded the UI wait budget; fallback remained visible.",
          details: { source: "api", timeout_ms: FAMILY_LOAD_TIMEOUT_MS }
        });
      }

      void liveRequest
        .then((value) => applyLiveFamilies(value, "api-late"))
        .catch((requestError) => {
          if (cancelled) {
            return;
          }
          recordClientDiagnostic("visual_families_late_fetch_failed", {
            message: "Late visual family fetch failed after fallback was already visible.",
            details: {
              error: requestError instanceof Error ? requestError.message : String(requestError),
              source: "api-late"
            }
          });
        });
    }

    loadFamilies();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadFamilies() {
    clearCachedRepairFamilies();
    setFamilies(BUILT_IN_REPAIR_FAMILIES);
    setFamiliesError(null);

    const liveRequest = getRepairFamilies();
    const result = await loadFamiliesWithTimeout(liveRequest);

    if (result.kind === "success") {
      const response = resolveRepairFamilies(result.value, "manual-refresh", { log: true });
      setFamilies(response.items);
      setFamiliesError(response.usedFallback ? "Family library returned no usable categories." : null);
      return;
    }

    if (result.kind === "timeout") {
      setFamiliesError("Live family data is still refreshing. The built-in family guide is ready to use.");
      recordClientDiagnostic("visual_families_manual_refresh_slow", {
        severity: "info",
        message: "Manual visual family refresh exceeded the UI wait budget.",
        details: { source: "manual-refresh", timeout_ms: FAMILY_LOAD_TIMEOUT_MS }
      });
      void liveRequest
        .then((value) => {
          const response = resolveRepairFamilies(value, "manual-refresh-late", { log: true });
          setFamilies(response.items);
          setFamiliesError(response.usedFallback ? "Family library returned no usable categories." : null);
        })
        .catch((requestError) => {
          recordClientDiagnostic("visual_families_manual_late_refresh_failed", {
            message: "Late manual visual family refresh failed after fallback was already visible.",
            details: {
              error: requestError instanceof Error ? requestError.message : String(requestError),
              source: "manual-refresh-late"
            }
          });
        });
      return;
    }

    if (result.kind === "error") {
      setFamiliesError(
        result.error instanceof Error
          ? result.error.message
          : "Could not load the visual family workspace."
      );
      recordClientDiagnostic("visual_families_manual_refresh_failed", {
        message: "Manual visual family refresh failed; current rendered family guide remains active.",
        details: {
          error: result.error instanceof Error ? result.error.message : String(result.error),
          source: "manual-refresh"
        }
      });
    }
  }

  useEffect(() => {
    if (!searchResult || searching) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = resultsRef.current;
      if (!target) {
        return;
      }
      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
        inline: "nearest",
      });
    }, 170);

    return () => window.clearTimeout(timer);
  }, [searchResult, searching]);

  useEffect(() => {
    if (!activeFamily) {
      return;
    }

    const timer = window.setTimeout(() => {
      familyExplorerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 90);

    return () => window.clearTimeout(timer);
  }, [activeFamily]);

  useEffect(() => {
    if (!quickDrillFamily || quickDrillClosing) {
      return;
    }

    const panel = quickDrillPanelRef.current;
    const shroud = quickDrillShroudRef.current;
    if (!panel || !quickDrillOrigin) {
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      panel.style.removeProperty("transform");
      panel.style.removeProperty("opacity");
      if (shroud) {
        shroud.style.removeProperty("opacity");
      }
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const sourceCenterX = quickDrillOrigin.left + quickDrillOrigin.width / 2;
    const sourceCenterY = quickDrillOrigin.top + quickDrillOrigin.height / 2;
    const panelCenterX = panelRect.left + panelRect.width / 2;
    const panelCenterY = panelRect.top + panelRect.height / 2;
    const offsetX = sourceCenterX - panelCenterX;
    const offsetY = sourceCenterY - panelCenterY;
    const scaleX = Math.max(0.22, Math.min(1, quickDrillOrigin.width / panelRect.width));
    const scaleY = Math.max(0.2, Math.min(1, quickDrillOrigin.height / panelRect.height));

    const panelAnimation =
      typeof panel.animate === "function"
        ? panel.animate(
            [
              {
                transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scaleX}, ${scaleY})`,
                opacity: 0.18,
                filter: "blur(0.8px)"
              },
              {
                transform: "translate3d(0, 0, 0) scale(1)",
                opacity: 1,
                filter: "blur(0)"
              }
            ],
            {
              duration: 420,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "both"
            }
          )
        : null;

    const shroudAnimation =
      shroud && typeof shroud.animate === "function"
        ? shroud.animate(
            [
              { opacity: 0 },
              { opacity: 1 }
            ],
            {
              duration: 280,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "both"
            }
          )
        : null;

    return () => {
      panelAnimation?.cancel();
      shroudAnimation?.cancel();
    };
  }, [quickDrillClosing, quickDrillFamily, quickDrillOrigin]);

  useEffect(() => {
    if (!quickDrillFamily) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      requestCloseQuickDrill();
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [quickDrillFamily]);

  async function runSearch(nextQuery: string) {
    const cleanQuery = nextQuery.trim();
    if (!cleanQuery) {
      setError(uiCopy.home.search.emptyQuery);
      return;
    }

    searchAbortRef.current?.abort();
    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    setSearching(true);
    setError(null);
    closeReviewGate();
    setSearchAssistOpen(false);
    setSearchAssistLoading(false);
    setActiveFamily(null);

    try {
      const response = await searchProcedures(cleanQuery, abortController.signal);
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      startTransition(() => {
        applyVisualTransition(() => {
          setSearchResult(response);
          setQuery(cleanQuery);
          setSearchResultKey((current) => current + 1);
        });
      });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 499) {
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : uiCopy.home.search.searchFailure
      );
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearching(false);
      }
      if (searchAbortRef.current === abortController) {
        searchAbortRef.current = null;
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(query);
  }

  async function applySuggestion(suggestion: SearchAssistSuggestion) {
    if (assistBlurTimeoutRef.current !== null) {
      window.clearTimeout(assistBlurTimeoutRef.current);
      assistBlurTimeoutRef.current = null;
    }
    setError(null);
    setQuery(suggestion.queryValue);
    setSearchAssistOpen(false);

    if (suggestion.action === "link" && suggestion.href) {
      if (typeof window !== "undefined") {
        window.open(suggestion.href, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (suggestion.action === "fill") {
      return;
    }

    await runSearch(suggestion.queryValue);
  }

  function clearSearchInput() {
    if (assistBlurTimeoutRef.current !== null) {
      window.clearTimeout(assistBlurTimeoutRef.current);
      assistBlurTimeoutRef.current = null;
    }
    setQuery("");
    setSearchAssistOpen(false);
    setSearchAssistLoading(false);
    setSearchSuggestions([]);
    setActiveSuggestionIndex(-1);
    setError(null);
    closeReviewGate();
    setSearchResult(null);
    searchInputRef.current?.focus();
  }

  async function handleSearchInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const hasSuggestions = searchSuggestions.length > 0;
    const canNavigate = searchAssistOpen && hasSuggestions;

    if (event.key === "ArrowDown" && hasSuggestions) {
      event.preventDefault();
      setSearchAssistOpen(true);
      setActiveSuggestionIndex((current) =>
        current < 0 ? 0 : (current + 1) % searchSuggestions.length
      );
      return;
    }

    if (event.key === "ArrowUp" && hasSuggestions) {
      event.preventDefault();
      setSearchAssistOpen(true);
      setActiveSuggestionIndex((current) =>
        current <= 0 ? searchSuggestions.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Escape") {
      setSearchAssistOpen(false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canNavigate) {
        const selectedSuggestion =
          activeSuggestionIndex >= 0 ? searchSuggestions[activeSuggestionIndex] : searchSuggestions[0];
        const nextQuery = selectedSuggestion?.queryValue?.trim();

        if (nextQuery) {
          if (assistBlurTimeoutRef.current !== null) {
            window.clearTimeout(assistBlurTimeoutRef.current);
            assistBlurTimeoutRef.current = null;
          }
          setQuery(nextQuery);
          setSearchAssistOpen(false);
          await runSearch(nextQuery);
          return;
        }
      }

      await runSearch(query);
    }
  }

  function trackInteraction(
    event: InteractionTelemetryEvent,
    metadata: Record<string, string> = {},
    status: "info" | "success" | "review" = "info"
  ) {
    void recordInteractionTelemetry({ event, status, metadata }).catch(() => {
      // Interaction telemetry is best-effort and must never block branch operations.
    });
  }

  function closeReviewGate() {
    setReviewCandidates([]);
    setReviewSelectedProcedureId(null);
  }

  function tryOpenReviewGate(result: SearchResponse): boolean {
    const candidates = buildReviewCandidates(result);
    if (!result.needs_review || candidates.length < 2) {
      return false;
    }
    setReviewCandidates(candidates);
    setReviewSelectedProcedureId(result.best_match?.id || candidates[0].id);
    trackInteraction(
      "confidence_gate_shown",
      {
        issue_type: result.structured_intent.issue_type || "unknown",
        candidate_count: String(candidates.length),
        confidence_state: result.confidence_state,
      },
      "review"
    );
    return true;
  }

  function hydrateRelatedForSession(expectedSession: TriageSession) {
    void getRelated(expectedSession.procedure.id)
      .then((response) => {
        const latest = loadSession();
        if (
          !latest ||
          latest.updatedAt !== expectedSession.updatedAt ||
          latest.procedure.id !== expectedSession.procedure.id
        ) {
          return;
        }

        const nextSession: TriageSession = {
          ...latest,
          related: response.items,
          updatedAt: new Date().toISOString()
        };
        saveSession(nextSession);
        startTransition(() => {
          setResumeSession((current) => {
            if (
              !current ||
              current.procedure.id !== expectedSession.procedure.id ||
              current.updatedAt !== expectedSession.updatedAt
            ) {
              return current;
            }
            return nextSession;
          });
        });
      })
      .catch(() => {
        // Keep triage startup non-blocking even when related suggestions fail.
      });
  }

  async function openFlow(procedure: ProcedureSummary, searchQuery?: string) {
    setStartingId(procedure.id);
    setError(null);

    try {
      const response = await startTriage(procedure.id);
      const seededRelated =
        searchResult?.best_match?.id === procedure.id ? searchResult.related : [];

      const session: TriageSession = {
        query: searchQuery || query,
        searchConfidence: searchResult?.confidence ?? null,
        searchConfidenceState: searchResult?.confidence_state ?? null,
        searchConfidenceMargin: searchResult?.confidence_margin ?? null,
        searchNeedsReview: searchResult?.needs_review ?? false,
        procedure: response.procedure,
        currentNode: response.current_node || null,
        progress: response.progress,
        customerCare: response.customer_care,
        sop: response.sop,
        outcome: response.outcome || null,
        related: seededRelated,
        history: [],
        dispatchGateConfirmed: [],
        updatedAt: new Date().toISOString()
      };

      saveSession(session);
      startTransition(() => {
        setResumeSession(session);
      });
      hydrateRelatedForSession(session);

      if (response.status === "complete") {
        startTransition(() => {
          router.push("/result");
        });
        return;
      }

      startTransition(() => {
        router.push("/triage");
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : uiCopy.home.search.flowFailure
      );
    } finally {
      setStartingId(null);
    }
  }

  function handleStartBestMatch() {
    if (!searchResult?.best_match) {
      return;
    }

    if (tryOpenReviewGate(searchResult)) {
      return;
    }

    trackInteraction(
      "best_match_direct_started",
      {
        procedure_id: String(searchResult.best_match.id),
        confidence_state: searchResult.confidence_state,
      },
      "success"
    );
    void openFlow(searchResult.best_match, searchResult.query);
  }

  function handleConfirmReviewSelection() {
    if (!selectedReviewProcedure) {
      return;
    }
    const selectedQuery = searchResult?.query || query;
    trackInteraction(
      "confidence_gate_confirmed",
      {
        procedure_id: String(selectedReviewProcedure.id),
        issue_type: searchResult?.structured_intent.issue_type || "unknown",
      },
      "success"
    );
    closeReviewGate();
    void openFlow(selectedReviewProcedure, selectedQuery);
  }

  function handleReviewCandidateSelect(candidate: ProcedureSummary) {
    setReviewSelectedProcedureId(candidate.id);
    trackInteraction(
      "confidence_gate_option_selected",
      {
        procedure_id: String(candidate.id),
        issue_type: searchResult?.structured_intent.issue_type || "unknown",
      },
      "review"
    );
  }

  function handleDismissReviewGate() {
    trackInteraction(
      "confidence_gate_dismissed",
      {
        issue_type: searchResult?.structured_intent.issue_type || "unknown",
      },
      "review"
    );
    closeReviewGate();
  }

  function handleOpenRecoveryFamily() {
    if (!recoveryFamily) {
      return;
    }
    trackInteraction(
      "no_match_recovery_family_opened",
      {
        family_id: recoveryFamily.id,
        family_title: recoveryFamily.title,
      },
      "review"
    );
    void openFamily(recoveryFamily.id);
  }

  function handleRecoveryPromptSearch(prompt: string) {
    trackInteraction(
      "no_match_recovery_prompt_used",
      {
        prompt,
        family_id: recoveryFamily?.id || "unknown",
      },
      "review"
    );
    void runSearch(prompt);
  }

  function continueSession() {
    if (!resumeSession) {
      return;
    }

    startTransition(() => {
      router.push(resumeSession.outcome ? "/result" : "/triage");
    });
  }

  function resetSession() {
    clearSession();
    setResumeSession(null);
  }

  async function openFamily(familyId: string) {
    setFamilyLoadingId(familyId);
    setError(null);
    setSearchResult(null);

    try {
      const response = await getRepairFamilyDetail(familyId);
      applyVisualTransition(() => {
        setActiveFamily(response);
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not open this repair family."
      );
    } finally {
      setFamilyLoadingId(null);
    }
  }

  function requestCloseQuickDrill() {
    if (!quickDrillFamily || quickDrillClosing) {
      return;
    }
    quickDrillRequestIdRef.current += 1;
    if (quickDrillPreheatTimeoutRef.current !== null) {
      window.clearTimeout(quickDrillPreheatTimeoutRef.current);
      quickDrillPreheatTimeoutRef.current = null;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setQuickDrillClosing(true);

    if (!reducedMotion) {
      if (quickDrillPanelRef.current && typeof quickDrillPanelRef.current.animate === "function") {
        quickDrillPanelRef.current.animate(
          [
            { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
            { transform: "translate3d(0, 20px, 0) scale(0.97)", opacity: 0 }
          ],
          {
            duration: 300,
            easing: "cubic-bezier(0.2, 0.82, 0.22, 1)",
            fill: "forwards"
          }
        );
      }
      if (quickDrillShroudRef.current && typeof quickDrillShroudRef.current.animate === "function") {
        quickDrillShroudRef.current.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          {
            duration: 240,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards"
          }
        );
      }
    }

    if (quickDrillCloseTimeoutRef.current !== null) {
      window.clearTimeout(quickDrillCloseTimeoutRef.current);
    }
    quickDrillCloseTimeoutRef.current = window.setTimeout(() => {
      setQuickDrillFamily(null);
      setQuickDrillOrigin(null);
      setQuickDrillDetail(null);
      setQuickDrillLoading(false);
      setQuickDrillError(null);
      setQuickDrillPrompt(null);
      setQuickDrillPreheat(false);
      setQuickDrillClosing(false);
      quickDrillPointerRef.current = null;
    }, reducedMotion ? 0 : 280);
  }

  async function openQuickDrill(family: RepairFamilySummary, sourceRect: DOMRect) {
    const nextRequestId = quickDrillRequestIdRef.current + 1;
    quickDrillRequestIdRef.current = nextRequestId;

    setQuickDrillFamily(family);
    setQuickDrillOrigin({
      top: sourceRect.top,
      left: sourceRect.left,
      width: sourceRect.width,
      height: sourceRect.height
    });
    setQuickDrillDetail(null);
    setQuickDrillLoading(true);
    setQuickDrillError(null);
    setQuickDrillPrompt(family.symptom_prompts[0] || null);
    setQuickDrillPreheat(false);
    setQuickDrillClosing(false);
    setActiveFamily(null);

    try {
      const detail = await getRepairFamilyDetail(family.id);
      if (quickDrillRequestIdRef.current !== nextRequestId) {
        return;
      }
      setQuickDrillDetail(detail);
      if (detail.symptom_prompts.length > 0) {
        setQuickDrillPrompt(detail.symptom_prompts[0]);
      }
    } catch (requestError) {
      if (quickDrillRequestIdRef.current !== nextRequestId) {
        return;
      }
      setQuickDrillError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load this quick-drill family. You can still open the full family workspace."
      );
    } finally {
      if (quickDrillRequestIdRef.current === nextRequestId) {
        setQuickDrillLoading(false);
      }
    }
  }

  function handleQuickDrillPointerMove(event: PointerEvent<HTMLDivElement>) {
    const now = performance.now();
    const previous = quickDrillPointerRef.current;
    quickDrillPointerRef.current = { x: event.clientX, y: event.clientY, t: now };

    if (!previous) {
      return;
    }

    const deltaTime = Math.max(1, now - previous.t);
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    const speed = Math.hypot(deltaX, deltaY) / deltaTime;
    if (speed < 1.05) {
      return;
    }

    if (!quickDrillPreheat) {
      setQuickDrillPreheat(true);
    }
    if (quickDrillPreheatTimeoutRef.current !== null) {
      window.clearTimeout(quickDrillPreheatTimeoutRef.current);
    }
    quickDrillPreheatTimeoutRef.current = window.setTimeout(() => {
      setQuickDrillPreheat(false);
    }, 150);
  }

  function handleQuickDrillPromptSelect(prompt: string) {
    setQuickDrillPrompt(prompt);
    requestCloseQuickDrill();
    void runSearch(prompt);
  }

  function handleQuickDrillOpenWorkspace() {
    if (!quickDrillFamily) {
      return;
    }

    const familyId = quickDrillFamily.id;
    requestCloseQuickDrill();
    void openFamily(familyId);
  }

  function handleQuickDrillStartTriage() {
    if (quickDrillPrimaryProcedure) {
      requestCloseQuickDrill();
      void openFlow(quickDrillPrimaryProcedure, quickDrillPrompt || quickDrillPrimaryProcedure.title);
      return;
    }

    handleQuickDrillOpenWorkspace();
  }

  return (
    <main
      className={`app-shell ${intakeFocusActive ? "app-shell-intake-focus" : ""}`}
      id="main-content"
    >
      <section className="hero hero-compact hero-world">
        <div className="hero-ambient-map" aria-hidden="true">
          <span className="hero-map-node hero-map-node-search" />
          <span className="hero-map-node hero-map-node-triage" />
          <span className="hero-map-node hero-map-node-action" />
          <span className="hero-map-line hero-map-line-one" />
          <span className="hero-map-line hero-map-line-two" />
        </div>
        <div className="hero-compact-grid">
          <div className="hero-copy">
            <span className="eyebrow">{uiCopy.home.hero.eyebrow}</span>
            <h1 className="home-hero-title">{uiCopy.home.hero.title}</h1>
            <p>{uiCopy.home.hero.description}</p>
            <div className="hero-command-strip" aria-label="Diagnosis workflow">
              <span className="hero-command-chip hero-command-chip-active">
                <strong>01</strong>
                Search
              </span>
              <span className="hero-command-chip">
                <strong>02</strong>
                Triage
              </span>
              <span className="hero-command-chip">
                <strong>03</strong>
                Action
              </span>
            </div>
          </div>
          <div
            className={`hero-search-shell ${searching ? "is-searching" : ""} ${
              intakeFocusActive ? "is-intake-focus" : ""
            } ${searchAssistOpen ? "has-search-assist" : ""}`}
          >
            <div className="search-shell-topline">
              <span>Case intake</span>
              <span>Full sentences work</span>
            </div>
            <form
              className={`search-form ${searchAssistOpen ? "search-form-assist-open" : ""}`}
              onSubmit={handleSubmit}
            >
              <label className="search-label" htmlFor="problem-search">
                Describe the problem
              </label>
              <div className="search-input-wrap">
                <textarea
                  id="problem-search"
                  ref={searchInputRef}
                  className="search-input search-input-enhanced"
                  disabled={searching}
                  value={query}
                  onBlur={() => {
                    if (assistBlurTimeoutRef.current !== null) {
                      window.clearTimeout(assistBlurTimeoutRef.current);
                    }
                    assistBlurTimeoutRef.current = window.setTimeout(() => {
                      setSearchAssistOpen(false);
                    }, 120);
                  }}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setQuery(nextValue);
                    setSearchAssistOpen(Boolean(nextValue.trim()));
                  }}
                  onFocus={() => {
                    if (assistBlurTimeoutRef.current !== null) {
                      window.clearTimeout(assistBlurTimeoutRef.current);
                      assistBlurTimeoutRef.current = null;
                    }
                    setSearchAssistOpen(Boolean(query.trim()));
                  }}
                  onKeyDown={handleSearchInputKeyDown}
                  placeholder={uiCopy.home.search.placeholder}
                  aria-activedescendant={
                    activeSuggestionIndex >= 0
                      ? `search-assist-option-${activeSuggestionIndex}`
                      : undefined
                  }
                  aria-controls="search-assist-listbox"
                  aria-describedby="problem-search-hint"
                  aria-expanded={searchAssistOpen}
                  aria-haspopup="listbox"
                />
                {query.trim() ? (
                  <button
                    aria-label="Clear search"
                    className="search-clear-button"
                    onClick={clearSearchInput}
                    type="button"
                  >
                    x
                  </button>
                ) : null}
                {searchAssistOpen ? (
                  <div className="search-assist-anchor" id="search-assist-listbox">
                    <SearchAssistDropdown
                      activeIndex={activeSuggestionIndex}
                      loading={searchAssistLoading}
                      onHover={setActiveSuggestionIndex}
                      onSelect={(suggestion) => {
                        void applySuggestion(suggestion);
                      }}
                      query={query}
                      suggestions={searchSuggestions}
                    />
                  </div>
                ) : null}
              </div>
              <p
                aria-live="polite"
                className="search-hint"
                id="problem-search-hint"
              >
                <span className="search-hint-primary">
                  Use customer wording, then press Enter to run diagnosis.
                </span>
              </p>
            </form>
            {searching ? (
              <div className="search-handshake" role="status">
                Syncing with the diagnosis engine...
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {searchResult ? (
        <section
          key={`${searchResultKey}-${searchResult.query}`}
          ref={resultsRef}
          aria-label="Search results"
          className={`search-results-stage ${searching ? "search-results-stage-busy" : ""}`}
          tabIndex={-1}
        >
          <section className="panel">
            <div className="panel-header">
              <span className="eyebrow">{uiCopy.home.intent.eyebrow}</span>
              <h3>{uiCopy.home.intent.title}</h3>
            </div>
            <div className="chip-row">
              {searchResult.structured_intent.issue_type ? (
                <span className="chip">{searchResult.structured_intent.issue_type}</span>
              ) : null}
              {searchResult.structured_intent.symptoms.map((symptom) => (
                <span className="chip" key={symptom}>
                  {symptom}
                </span>
              ))}
            </div>
          </section>

          {reviewGateOpen ? (
            <section className="panel panel-compact">
              <div className="panel-header">
                <span className="eyebrow">Quick confirm</span>
                <h3>Pick the closest route before triage</h3>
              </div>
              <p className="body-copy">
                Which one best matches what you can confirm right now?
              </p>
              <div className="family-supporting-list">
                {reviewCandidates.map((candidate) => (
                  <button
                    key={`review-candidate-${candidate.id}`}
                    className={`family-support-chip ${
                      reviewSelectedProcedureId === candidate.id ? "family-support-chip-active" : ""
                    }`}
                    onClick={() => handleReviewCandidateSelect(candidate)}
                    type="button"
                  >
                    {candidate.title}
                  </button>
                ))}
              </div>
              {selectedReviewProcedure ? (
                <p className="muted-copy">{selectedReviewProcedure.description}</p>
              ) : null}
              <div className="action-grid">
                <button
                  className="primary-button"
                  disabled={!selectedReviewProcedure}
                  onClick={handleConfirmReviewSelection}
                  type="button"
                >
                  Continue with selected flow
                </button>
                <button className="secondary-button" onClick={handleDismissReviewGate} type="button">
                  Keep reviewing
                </button>
              </div>
            </section>
          ) : null}

          {searchResult.best_match ? (
            <ProcedureMatchCard
              procedure={searchResult.best_match}
              confidence={searchResult.confidence}
              confidenceState={searchResult.confidence_state}
              confidenceMargin={searchResult.confidence_margin}
              reviewMessage={searchResult.review_message}
              nextStep={searchResult.suggested_next_step}
              customerCare={searchResult.customer_care}
              busy={startingId === searchResult.best_match.id}
              onStart={handleStartBestMatch}
            />
          ) : (
            <section className="panel">
              <div className="panel-header">
                <span className="eyebrow">{uiCopy.home.noMatch.eyebrow}</span>
                <h3>{uiCopy.home.noMatch.title}</h3>
              </div>
              <p className="body-copy">{searchResult.message}</p>
              <div className="quick-pill-row">
                {recoveryFamily ? (
                  <button className="primary-button" onClick={handleOpenRecoveryFamily} type="button">
                    Open {recoveryFamily.title}
                  </button>
                ) : null}
                {recoveryFamily?.symptom_prompts?.slice(0, 2).map((prompt) => (
                  <button
                    key={`recovery-prompt-${prompt}`}
                    className="quick-pill"
                    onClick={() => handleRecoveryPromptSearch(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          )}

          <details className="panel panel-compact detail-toggle">
            <summary className="detail-toggle-summary">
              <div className="panel-header">
                <span className="eyebrow">{uiCopy.home.suggestions.alternativesTitle}</span>
                <h3>{uiCopy.home.suggestions.alternativesTitle}</h3>
              </div>
              <span className="detail-toggle-action">Open</span>
            </summary>
            <SuggestionList
              title={uiCopy.home.suggestions.alternativesTitle}
              items={searchResult.alternatives}
              emptyMessage={uiCopy.home.suggestions.alternativesEmpty}
              onSelect={(procedure) => {
                closeReviewGate();
                openFlow(procedure, searchResult.query);
              }}
              embedded
            />
          </details>

          <details className="panel panel-compact detail-toggle">
            <summary className="detail-toggle-summary">
              <div className="panel-header">
                <span className="eyebrow">{uiCopy.home.suggestions.relatedTitle}</span>
                <h3>{uiCopy.home.suggestions.relatedTitle}</h3>
              </div>
              <span className="detail-toggle-action">Open</span>
            </summary>
            <SuggestionList
              title={uiCopy.home.suggestions.relatedTitle}
              items={searchResult.related}
              emptyMessage={uiCopy.home.suggestions.relatedEmpty}
              onSelect={(procedure) => {
                closeReviewGate();
                openFlow(procedure, searchResult.query);
              }}
              embedded
            />
          </details>
        </section>
      ) : null}

      {searching && !searchResult ? (
        <section className="search-results-stage search-results-stage-skeleton" aria-hidden="true">
          <section className="panel search-skeleton-card">
            <span className="skeleton-line skeleton-line-strong search-skeleton-line-lg" />
            <span className="skeleton-line search-skeleton-line" />
            <span className="skeleton-line search-skeleton-line-md" />
          </section>
          <section className="panel search-skeleton-card">
            <span className="skeleton-line skeleton-line-strong search-skeleton-line-lg" />
            <span className="skeleton-line search-skeleton-line" />
            <span className="skeleton-line search-skeleton-line-sm" />
            <span className="skeleton-line search-skeleton-line" />
          </section>
        </section>
      ) : null}

      {resumeSession ? (
        <section className="panel panel-compact saved-strip">
          <div className="saved-strip-copy">
            <h3>{uiCopy.home.savedProgress.title}</h3>
            <p className="body-copy">
              {resumeSession.procedure.title} {uiCopy.home.savedProgress.savedDeviceSuffix}
            </p>
          </div>
          <div className="saved-strip-actions">
            <button className="primary-button" onClick={continueSession} type="button">
              {uiCopy.home.savedProgress.continueLabel}
            </button>
            <button className="secondary-button" onClick={resetSession} type="button">
              {uiCopy.home.savedProgress.clearLabel}
            </button>
          </div>
        </section>
      ) : null}

      <RepairFamilyGrid
        activeFamilyId={familyLoadingId || quickDrillFamily?.id || activeFamily?.id || null}
        families={families}
        loadError={familiesError}
        onSelect={openQuickDrill}
        onRetry={reloadFamilies}
      />
      {activeFamily ? (
        <div className="family-explorer-anchor" ref={familyExplorerRef}>
          <FamilyExplorer
            family={activeFamily}
            onRunPrompt={runSearch}
            onSelectProcedure={(procedure) => openFlow(procedure, procedure.title)}
            openingProcedureId={startingId}
          />
        </div>
      ) : null}

      {quickDrillFamily ? (
        <section
          aria-labelledby="quick-drill-title"
          aria-modal="true"
          className={`quick-drill-layer ${quickDrillClosing ? "quick-drill-layer-closing" : ""}`}
          role="dialog"
        >
          <button
            aria-label="Close quick drill"
            className="quick-drill-shroud"
            onClick={requestCloseQuickDrill}
            ref={quickDrillShroudRef}
            type="button"
          />
          <div
            className={`quick-drill-panel ${quickDrillPreheat ? "quick-drill-panel-preheat" : ""}`}
            onPointerMove={handleQuickDrillPointerMove}
            ref={quickDrillPanelRef}
          >
            <div className="quick-drill-head">
              <div>
                <span className="eyebrow">Quick drill</span>
                <h3 id="quick-drill-title">{quickDrillFamily.title}</h3>
                <p className="body-copy">{quickDrillDetail?.hint || quickDrillFamily.hint}</p>
              </div>
              <button
                className="quick-drill-close"
                onClick={requestCloseQuickDrill}
                type="button"
              >
                Close
              </button>
            </div>

            {quickDrillDetail?.common_categories.length ? (
              <div className="quick-drill-stream">
                {quickDrillDetail.common_categories.slice(0, 3).map((category) => (
                  <span className="quick-drill-stream-pill" key={`${quickDrillFamily.id}-${category.title}`}>
                    {category.title}
                  </span>
                ))}
              </div>
            ) : null}

            <section className="quick-drill-chip-block">
              <strong>Micro symptoms</strong>
              <div className="quick-drill-chip-grid">
                {quickDrillPrompts.length > 0 ? (
                  quickDrillPrompts.map((prompt) => (
                    <button
                      className={`quick-drill-chip ${quickDrillPrompt === prompt ? "quick-drill-chip-active" : ""}`}
                      data-magnetic
                      key={`${quickDrillFamily.id}-${prompt}`}
                      onClick={() => handleQuickDrillPromptSelect(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))
                ) : (
                  <span className="quick-drill-chip quick-drill-chip-placeholder">
                    No symptom shortcuts yet for this family.
                  </span>
                )}
              </div>
            </section>

            {quickDrillError ? (
              <p className="quick-drill-error" role="status">
                {quickDrillError}
              </p>
            ) : null}

            <div className="quick-drill-actions">
              <button
                className="primary-button quick-drill-primary"
                disabled={quickDrillLoading || startingId !== null}
                onClick={handleQuickDrillStartTriage}
                type="button"
              >
                {quickDrillLoading
                  ? "Preparing quick triage..."
                  : quickDrillPrimaryProcedure
                    ? `Start triage: ${quickDrillPrimaryProcedure.title}`
                    : "Start triage"}
              </button>
              <button
                className="secondary-button quick-drill-secondary"
                disabled={quickDrillLoading}
                onClick={handleQuickDrillOpenWorkspace}
                type="button"
              >
                Open full family workspace
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {error ? <p className="error-banner" role="alert">{error}</p> : null}
    </main>
  );
}
