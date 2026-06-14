"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthStatus, getECLocations, listCases } from "@/lib/api";
import type { AppUser, CaseListResponse, ECLocationItem } from "@/lib/types";

type StatusFilter = "all" | "open" | "dispatched" | "closed" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  dispatched: "Dispatched",
  closed: "Closed",
  cancelled: "Cancelled",
};

const CASE_TYPE_LABELS: Record<string, string> = {
  repair: "Repair",
  frp: "FRP",
  return: "Return",
  theft: "Theft",
};

const STATUS_FILTERS: StatusFilter[] = ["all", "open", "dispatched", "closed", "cancelled"];
const CROSS_EC_ROLES = new Set(["watu_ops", "watu_admin"]);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-UG", { dateStyle: "medium" });
}

export default function CasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<AppUser | null>(null);
  const [result, setResult] = useState<CaseListResponse | null>(null);
  const [locations, setLocations] = useState<ECLocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) ?? "all"
  );
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [ecLocationId, setEcLocationId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  const queryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (queryDebounce.current) clearTimeout(queryDebounce.current);
    queryDebounce.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => { if (queryDebounce.current) clearTimeout(queryDebounce.current); };
  }, [query]);

  const isCrossEc = user ? CROSS_EC_ROLES.has(user.role) : false;

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCases({
        status: filter === "all" ? undefined : filter,
        q: debouncedQuery.trim() || undefined,
        ec_location_id: ecLocationId,
        page,
        per_page: 20,
      });
      setResult(res);
    } catch {
      setError("Failed to load cases. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedQuery, ecLocationId, page]);

  useEffect(() => {
    async function init() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated) { router.replace("/login"); return; }
        if (auth.user?.approval_status === "pending") { router.replace("/pending"); return; }
        setUser(auth.user ?? null);
        if (auth.user && CROSS_EC_ROLES.has(auth.user.role)) {
          const locs = await getECLocations();
          setLocations(locs.locations);
        }
      } catch {
        router.replace("/login");
      }
    }
    void init();
  }, [router]);

  useEffect(() => {
    if (user !== null) void fetchCases();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter, debouncedQuery, ecLocationId, page]);

  const cases = result?.cases ?? [];
  const totalPages = result?.total_pages ?? 1;
  const total = result?.total ?? 0;

  return (
    <div className="cl-page">
      <div className="cl-shell">
        <div className="cl-header">
          <button className="case-back-btn" onClick={() => router.push("/dashboard")} type="button">
            ← Dashboard
          </button>
          <div>
            <h1 className="cl-title">{isCrossEc ? "All Cases" : "My Cases"}</h1>
            <p className="cl-subtitle">
              {isCrossEc
                ? "Cases across all Experience Centers"
                : "Job cards created at your Experience Center"}
            </p>
          </div>
          <button className="primary-button cl-new-btn" onClick={() => router.push("/")} type="button">
            + New diagnostic
          </button>
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        {/* Search + EC location filter row */}
        <div className="cl-search-row">
          <div className="cl-search-wrap">
            <input
              className="cl-search-input"
              type="search"
              placeholder="Reference, name, model or IMEI…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search cases"
            />
            {query && (
              <button
                className="cl-search-clear"
                onClick={() => setQuery("")}
                type="button"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {isCrossEc && locations.length > 0 && (
            <select
              className="cl-ec-select"
              value={ecLocationId ?? ""}
              onChange={(e) => {
                setEcLocationId(e.target.value ? parseInt(e.target.value, 10) : undefined);
                setPage(1);
              }}
              aria-label="Filter by EC location"
            >
              <option value="">All ECs</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.country_code})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="cl-filter-row">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              className={`cl-filter-btn ${filter === f ? "cl-filter-active" : ""}`}
              onClick={() => { setFilter(f); setPage(1); }}
              type="button"
            >
              {f === "all" ? "All" : STATUS_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Case list */}
        {loading ? (
          <p className="auth-loading">Loading cases…</p>
        ) : cases.length === 0 ? (
          <div className="cl-empty">
            {total === 0 && !debouncedQuery && filter === "all" ? (
              <>
                <p className="cl-empty-title">No cases yet</p>
                <p className="cl-empty-body">
                  Run a diagnostic, then use &ldquo;Create job card&rdquo; on the result page.
                </p>
                <button className="primary-button" onClick={() => router.push("/")} type="button">
                  Start a diagnostic
                </button>
              </>
            ) : debouncedQuery ? (
              <p>No cases match &ldquo;{debouncedQuery}&rdquo;.</p>
            ) : (
              <p>No {filter !== "all" ? STATUS_LABELS[filter]?.toLowerCase() : ""} cases.</p>
            )}
          </div>
        ) : (
          <div className="cl-list">
            {cases.map((c) => (
              <button
                key={c.id}
                className="cl-card"
                onClick={() => router.push(`/cases/${encodeURIComponent(c.reference)}`)}
                type="button"
              >
                <div className="cl-card-left">
                  <span className="cl-ref">{c.reference}</span>
                  <span className="cl-client">{c.client_name}</span>
                  <span className="cl-device">{c.device_model} · {c.device_imei}</span>
                  {isCrossEc && c.ec_location_name && (
                    <span className="cl-ec-tag">{c.ec_location_name}</span>
                  )}
                  {c.waybill_number && (
                    <span className="cl-waybill">Waybill: {c.waybill_number}</span>
                  )}
                </div>
                <div className="cl-card-right">
                  <span className={`cl-type-badge cl-type-${c.case_type}`}>
                    {CASE_TYPE_LABELS[c.case_type] ?? c.case_type}
                  </span>
                  <span className={`cl-status-badge cl-status-${c.status}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  <span className="cl-date">{formatDate(c.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="cl-pagination">
            <button
              className="cl-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              ← Prev
            </button>
            <span className="cl-page-info">
              Page {page} of {totalPages}
              {total > 0 && <> &middot; {total} total</>}
            </span>
            <button
              className="cl-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Next →
            </button>
          </div>
        )}

        {!loading && totalPages <= 1 && total > 0 && (
          <p className="cl-footer-count">{total} case{total !== 1 ? "s" : ""}</p>
        )}
      </div>
    </div>
  );
}
