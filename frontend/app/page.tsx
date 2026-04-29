"use client";

import { FormEvent, startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FamilyExplorer } from "@/components/FamilyExplorer";
import { ProcedureMatchCard } from "@/components/ProcedureMatchCard";
import { RepairFamilyGrid } from "@/components/RepairFamilyGrid";
import { SuggestionList } from "@/components/SuggestionList";
import {
  ApiError,
  clearCachedRepairFamilies,
  getCachedRepairFamilies,
  getRelated,
  getRepairFamilies,
  getRepairFamilyDetail,
  searchProcedures,
  startTriage
} from "@/lib/api";
import { recordClientDiagnostic } from "@/lib/client-diagnostics";
import { quickQueries, uiCopy } from "@/lib/copy";
import {
  BUILT_IN_REPAIR_FAMILIES,
  resolveRepairFamilies
} from "@/lib/repair-families";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { ProcedureSummary, RepairFamilyDetail, RepairFamilySummary, SearchResponse, TriageSession } from "@/lib/types";

const FAMILY_LOAD_TIMEOUT_MS = 4500;

type FamilyRequestResult =
  | { kind: "success"; value: RepairFamilySummary[] }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };

function loadFamiliesWithTimeout(request: Promise<RepairFamilySummary[]>): Promise<FamilyRequestResult> {
  const safeRequest = request
    .then((value): FamilyRequestResult => ({ kind: "success", value }))
    .catch((error): FamilyRequestResult => ({ kind: "error", error }));
  const timeout = new Promise<FamilyRequestResult>((resolve) => {
    window.setTimeout(() => resolve({ kind: "timeout" }), FAMILY_LOAD_TIMEOUT_MS);
  });

  return Promise.race([safeRequest, timeout]);
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
  const [searchResultKey, setSearchResultKey] = useState(0);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const familyExplorerRef = useRef<HTMLDivElement | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    setResumeSession(loadSession());
  }, []);

  useEffect(() => {
    router.prefetch("/triage");
    router.prefetch("/result");
  }, [router]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

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
      resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      resultsRef.current?.focus?.({ preventScroll: true });
    }, 140);

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
    setActiveFamily(null);

    try {
      const response = await searchProcedures(cleanQuery, abortController.signal);
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      startTransition(() => {
        setSearchResult(response);
        setQuery(cleanQuery);
        setSearchResultKey((current) => current + 1);
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

  async function openFlow(procedure: ProcedureSummary, searchQuery?: string) {
    setStartingId(procedure.id);
    setError(null);

    try {
      const [startResponse, relatedResponse] = await Promise.allSettled([
        startTriage(procedure.id),
        getRelated(procedure.id)
      ]);
      if (startResponse.status !== "fulfilled") {
        throw startResponse.reason;
      }
      const response = startResponse.value;
      const relatedItems =
        relatedResponse.status === "fulfilled" ? relatedResponse.value.items : [];

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
        related: relatedItems,
        history: [],
        dispatchGateConfirmed: [],
        updatedAt: new Date().toISOString()
      };

      saveSession(session);
      startTransition(() => {
        setResumeSession(session);
      });

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
      setActiveFamily(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not open this repair family."
      );
    } finally {
      setFamilyLoadingId(null);
    }
  }

  return (
    <main className="app-shell" id="main-content">
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
              <span className="hero-command-chip">
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
          <div className={`hero-search-shell ${searching ? "is-searching" : ""}`}>
            <div className="search-shell-topline">
              <span>Case intake</span>
              <span>Full sentences work</span>
            </div>
            <form className="search-form" onSubmit={handleSubmit}>
              <label className="search-label" htmlFor="problem-search">
                Describe the problem
              </label>
              <textarea
                id="problem-search"
                className="search-input"
                disabled={searching}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={uiCopy.home.search.placeholder}
                aria-describedby="problem-search-hint"
              />
              <p className="search-hint" id="problem-search-hint">
                Use customer wording. The hub will pick out the issue family and symptoms.
              </p>
              <button className="primary-button" disabled={searching} type="submit">
                {searching ? uiCopy.home.search.submittingLabel : uiCopy.home.search.submitLabel}
              </button>
            </form>
            {searching ? (
              <div className="search-handshake" role="status">
                Syncing with the diagnosis engine...
              </div>
            ) : null}

            <div className="quick-pill-row">
              {quickQueries.map((item) => (
                <button
                  key={item.label}
                  className="quick-pill"
                  disabled={searching}
                  onClick={() => runSearch(item.query)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
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
              onStart={() => openFlow(searchResult.best_match!, searchResult.query)}
            />
          ) : (
            <section className="panel">
              <div className="panel-header">
                <span className="eyebrow">{uiCopy.home.noMatch.eyebrow}</span>
                <h3>{uiCopy.home.noMatch.title}</h3>
              </div>
              <p className="body-copy">{searchResult.message}</p>
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
              onSelect={(procedure) => openFlow(procedure, searchResult.query)}
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
              onSelect={(procedure) => openFlow(procedure, searchResult.query)}
              embedded
            />
          </details>
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
        activeFamilyId={familyLoadingId || activeFamily?.id || null}
        families={families}
        loadError={familiesError}
        onSelect={openFamily}
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

      {error ? <p className="error-banner" role="alert">{error}</p> : null}
    </main>
  );
}
