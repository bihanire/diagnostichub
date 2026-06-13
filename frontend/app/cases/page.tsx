"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthStatus, listCases } from "@/lib/api";
import type { CaseResponse } from "@/lib/types";

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

const FILTERS: StatusFilter[] = ["all", "open", "dispatched", "closed", "cancelled"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-UG", { dateStyle: "medium" });
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    async function init() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated) {
          router.replace("/login");
          return;
        }
        if (auth.user?.approval_status === "pending") {
          router.replace("/pending");
          return;
        }
        const result = await listCases();
        setCases(result.cases);
      } catch {
        setError("Failed to load cases. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  const visible =
    filter === "all" ? cases : cases.filter((c) => c.status === filter);

  const countFor = (s: StatusFilter) =>
    s === "all" ? cases.length : cases.filter((c) => c.status === s).length;

  return (
    <div className="cl-page">
      <div className="cl-shell">
        {/* Header */}
        <div className="cl-header">
          <button
            className="case-back-btn"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            ← Dashboard
          </button>
          <div>
            <h1 className="cl-title">My Cases</h1>
            <p className="cl-subtitle">Job cards created at your Experience Center</p>
          </div>
          <button
            className="primary-button cl-new-btn"
            onClick={() => router.push("/")}
            type="button"
          >
            + New diagnostic
          </button>
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        {/* Filter tabs */}
        <div className="cl-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`cl-filter-btn ${filter === f ? "cl-filter-active" : ""}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === "all" ? "All" : STATUS_LABELS[f]}
              {countFor(f) > 0 && (
                <span className="cl-filter-count">{countFor(f)}</span>
              )}
            </button>
          ))}
        </div>

        {/* Case list */}
        {loading ? (
          <p className="auth-loading">Loading cases…</p>
        ) : visible.length === 0 ? (
          <div className="cl-empty">
            {cases.length === 0 ? (
              <>
                <p className="cl-empty-title">No cases yet</p>
                <p className="cl-empty-body">
                  Run a diagnostic, then use "Create job card" on the result page.
                </p>
                <button
                  className="primary-button"
                  onClick={() => router.push("/")}
                  type="button"
                >
                  Start a diagnostic
                </button>
              </>
            ) : (
              <p>No {STATUS_LABELS[filter]?.toLowerCase()} cases.</p>
            )}
          </div>
        ) : (
          <div className="cl-list">
            {visible.map((c) => (
              <button
                key={c.id}
                className="cl-card"
                onClick={() => router.push(`/cases/${encodeURIComponent(c.reference)}`)}
                type="button"
              >
                <div className="cl-card-left">
                  <span className="cl-ref">{c.reference}</span>
                  <span className="cl-client">{c.client_name}</span>
                  <span className="cl-device">
                    {c.device_model} · {c.device_imei}
                  </span>
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

        {!loading && cases.length > 0 && (
          <p className="cl-footer-count">
            {cases.length} case{cases.length !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}
