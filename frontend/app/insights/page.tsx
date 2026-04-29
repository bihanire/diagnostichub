"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ApiError,
  getOpsFeedbackByBranch,
  getOpsFeedbackByTag,
  getOpsFeedbackLanguageCandidates,
  getOpsFeedbackLanguageExportUrl,
  getOpsFeedbackByProcedure,
  getOpsFeedbackExportUrl,
  getOpsFeedbackSummary,
  getOpsSession,
  logoutOps
} from "@/lib/api";
import { getFeedbackTagLabel, getReviewWindowLabel, reviewWindowOptions, uiCopy } from "@/lib/copy";
import { formatDateTime, formatRatioPercent } from "@/lib/format";
import type {
  BranchFeedbackBreakdownResponse,
  FeedbackLanguageCandidateResponse,
  FeedbackSummaryResponse,
  FeedbackTagBreakdownResponse,
  OpsSessionResponse,
  ProcedureFeedbackBreakdownResponse
} from "@/lib/types";

export default function InsightsPage() {
  const router = useRouter();
  const [days, setDays] = useState<number>(30);
  const [opsSession, setOpsSession] = useState<OpsSessionResponse | null>(null);
  const [summary, setSummary] = useState<FeedbackSummaryResponse | null>(null);
  const [procedureBreakdown, setProcedureBreakdown] =
    useState<ProcedureFeedbackBreakdownResponse | null>(null);
  const [branchBreakdown, setBranchBreakdown] = useState<BranchFeedbackBreakdownResponse | null>(
    null
  );
  const [languageCandidates, setLanguageCandidates] = useState<FeedbackLanguageCandidateResponse | null>(
    null
  );
  const [tagBreakdown, setTagBreakdown] = useState<FeedbackTagBreakdownResponse | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      try {
        const session = await getOpsSession();
        if (!mounted) {
          return;
        }

        if (!session.authenticated) {
          router.replace("/ops/login");
          return;
        }

        setOpsSession(session);
      } catch {
        if (mounted) {
          router.replace("/ops/login");
        }
      } finally {
        if (mounted) {
          setCheckingAccess(false);
        }
      }
    }

    void verifySession();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (checkingAccess || !opsSession?.authenticated) {
      return;
    }

    let active = true;

    async function loadInsights() {
      setLoading(true);
      setError(null);

      try {
        const [summaryResponse, procedureResponse, branchResponse, languageResponse, tagResponse] = await Promise.all([
          getOpsFeedbackSummary(days),
          getOpsFeedbackByProcedure(days),
          getOpsFeedbackByBranch(days),
          getOpsFeedbackLanguageCandidates(days),
          getOpsFeedbackByTag(days)
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryResponse);
        setProcedureBreakdown(procedureResponse);
        setBranchBreakdown(branchResponse);
        setLanguageCandidates(languageResponse);
        setTagBreakdown(tagResponse);
      } catch (requestError) {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/ops/login");
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : uiCopy.insights.summary.loadFailure
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInsights();

    return () => {
      active = false;
    };
  }, [checkingAccess, days, opsSession, router]);

  const helpfulRate = useMemo(() => {
    if (!summary || summary.total_submissions === 0) {
      return formatRatioPercent(0);
    }

    return formatRatioPercent(summary.helpful_count / summary.total_submissions);
  }, [summary]);

  const topProcedure = useMemo(() => {
    if (!procedureBreakdown?.items.length) {
      return null;
    }

    return [...procedureBreakdown.items].sort(
      (left, right) => right.total_submissions - left.total_submissions
    )[0];
  }, [procedureBreakdown]);

  const needsAttentionProcedure = useMemo(() => {
    if (!procedureBreakdown?.items.length) {
      return null;
    }

    return [...procedureBreakdown.items].sort(
      (left, right) => right.not_helpful_count - left.not_helpful_count
    )[0];
  }, [procedureBreakdown]);

  const mostActiveBranch = useMemo(() => {
    if (!branchBreakdown?.items.length) {
      return null;
    }

    return [...branchBreakdown.items].sort(
      (left, right) => right.total_submissions - left.total_submissions
    )[0];
  }, [branchBreakdown]);

  const noteCount = summary?.latest_submissions.filter(
    (item) => item.comment && item.comment.trim().length > 0
  ).length || 0;

  const sessionExpiryLabel = opsSession?.expires_at
    ? formatDateTime(opsSession.expires_at)
    : uiCopy.insights.hero.sessionActiveLabel;

  async function handleLogout() {
    setSigningOut(true);
    setError(null);

    try {
      await logoutOps();
    } catch {
      // Even if the backend session was already gone, send the user back to login.
    } finally {
      router.replace("/ops/login");
    }
  }

  if (checkingAccess) {
    return (
      <main className="app-shell" id="main-content">
        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.insights.checking.eyebrow}</span>
            <h3>{uiCopy.insights.checking.title}</h3>
          </div>
          <p className="muted-copy">{uiCopy.insights.checking.description}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" id="main-content">
      <section className="hero hero-split">
        <div className="hero-copy">
          <span className="eyebrow">{uiCopy.insights.hero.eyebrow}</span>
          <h1>{uiCopy.insights.hero.title}</h1>
          <p>{uiCopy.insights.hero.description}</p>
          <div className="chip-row hero-chip-row">
            {uiCopy.insights.hero.chips.map((chip) => (
              <span className="chip chip-hero" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-card">
            <span className="eyebrow">{uiCopy.insights.hero.sideEyebrow}</span>
            <div className="hero-metrics">
              <div className="hero-metric">
                <strong>{summary?.total_submissions ?? 0}</strong>
                <span>{uiCopy.insights.hero.metrics.feedbackCases}</span>
              </div>
              <div className="hero-metric">
                <strong>{helpfulRate}</strong>
                <span>{uiCopy.insights.hero.metrics.helpfulRate}</span>
              </div>
              <div className="hero-metric">
                <strong>{noteCount}</strong>
                <span>{uiCopy.insights.hero.metrics.writtenNotes}</span>
              </div>
            </div>
            <p className="body-copy">
              {uiCopy.insights.hero.sessionStatusPrefix}: {sessionExpiryLabel}.{" "}
              {uiCopy.insights.hero.sideDescription}
            </p>
            <div className="action-grid">
              <button className="secondary-button inline-action" onClick={handleLogout} type="button">
                {signingOut
                  ? uiCopy.insights.controls.signingOutLabel
                  : uiCopy.insights.controls.signOutLabel}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="overview-grid">
        <article className="panel info-card">
          <span className="eyebrow">{uiCopy.insights.cards.topFlowEyebrow}</span>
          <h3>{topProcedure?.procedure_title || uiCopy.insights.cards.topFlowFallback}</h3>
          <p className="body-copy">
            {topProcedure
              ? `${topProcedure.total_submissions} submissions were tied to this flow in the selected window.`
              : uiCopy.insights.cards.topFlowEmpty}
          </p>
        </article>
        <article className="panel info-card">
          <span className="eyebrow">{uiCopy.insights.cards.needsAttentionEyebrow}</span>
          <h3>
            {needsAttentionProcedure?.procedure_title ||
              uiCopy.insights.cards.needsAttentionFallback}
          </h3>
          <p className="body-copy">
            {needsAttentionProcedure && needsAttentionProcedure.not_helpful_count > 0
              ? `${needsAttentionProcedure.not_helpful_count} cases were marked not helpful, which makes this the strongest candidate for a wording or flow fix.`
              : uiCopy.insights.cards.needsAttentionEmpty}
          </p>
        </article>
        <article className="panel info-card">
          <span className="eyebrow">{uiCopy.insights.cards.activeBranchEyebrow}</span>
          <h3>{mostActiveBranch?.branch_label || uiCopy.insights.cards.activeBranchFallback}</h3>
          <p className="body-copy">
            {mostActiveBranch
              ? `${mostActiveBranch.total_submissions} labelled submissions came from this branch in the selected window.`
              : uiCopy.insights.cards.activeBranchEmpty}
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="section-toolbar">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.insights.controls.eyebrow}</span>
            <h3>{uiCopy.insights.controls.title}</h3>
          </div>
          <div className="choice-row">
            {reviewWindowOptions.map((option) => (
              <button
                key={option}
                className={`choice-button ${days === option ? "choice-button-active" : ""}`}
                onClick={() => setDays(option)}
                type="button"
              >
                {getReviewWindowLabel(option)}
              </button>
            ))}
          </div>
          <div className="action-grid">
            <a className="primary-button inline-action" href={getOpsFeedbackExportUrl(days)}>
              {uiCopy.insights.controls.exportLabel}
            </a>
            <a
              className="secondary-button inline-action"
              href={getOpsFeedbackLanguageExportUrl(days)}
            >
              {uiCopy.insights.controls.exportLanguageLabel}
            </a>
            <Link className="secondary-button inline-action" href="/">
              {uiCopy.global.backToApp}
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="eyebrow">{uiCopy.insights.summary.eyebrow}</span>
          <h3>{uiCopy.insights.summary.title}</h3>
        </div>

        {loading ? (
          <p className="muted-copy" role="status">
            {uiCopy.insights.summary.loadingLabel}
          </p>
        ) : null}
        {error ? <p className="error-banner" role="alert">{error}</p> : null}

        {summary ? (
          <>
            <div className="stats-grid">
              <div className="stat-card stat-card-strong">
                <span className="eyebrow">{uiCopy.insights.summary.totalEyebrow}</span>
                <strong>{summary.total_submissions}</strong>
                <p className="muted-copy">{uiCopy.insights.summary.submissionsSuffix}</p>
              </div>
              <div className="stat-card">
                <span className="eyebrow">{uiCopy.insights.summary.helpfulEyebrow}</span>
                <strong>{summary.helpful_count}</strong>
                <p className="muted-copy">
                  {helpfulRate} {uiCopy.insights.summary.helpfulRateSuffix}
                </p>
              </div>
              <div className="stat-card">
                <span className="eyebrow">{uiCopy.insights.summary.needsWorkEyebrow}</span>
                <strong>{summary.not_helpful_count}</strong>
                <p className="muted-copy">{uiCopy.insights.summary.needsWorkSuffix}</p>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="section-split">
        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.insights.procedures.eyebrow}</span>
            <h3>{uiCopy.insights.procedures.title}</h3>
          </div>
          {procedureBreakdown?.items.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Procedure</th>
                    <th>Total</th>
                    <th>Helpful</th>
                    <th>Needs work</th>
                  </tr>
                </thead>
                <tbody>
                  {procedureBreakdown.items.map((item) => (
                    <tr key={`${item.procedure_id ?? "unknown"}-${item.procedure_title}`}>
                      <td>{item.procedure_title}</td>
                      <td>{item.total_submissions}</td>
                      <td>{item.helpful_count}</td>
                      <td>{item.not_helpful_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-copy">{uiCopy.insights.procedures.empty}</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.insights.branches.eyebrow}</span>
            <h3>{uiCopy.insights.branches.title}</h3>
          </div>
          {branchBreakdown?.items.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Total</th>
                    <th>Helpful</th>
                    <th>Needs work</th>
                  </tr>
                </thead>
                <tbody>
                  {branchBreakdown.items.map((item) => (
                    <tr key={item.branch_label}>
                      <td>{item.branch_label}</td>
                      <td>{item.total_submissions}</td>
                      <td>{item.helpful_count}</td>
                      <td>{item.not_helpful_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-copy">{uiCopy.insights.branches.empty}</p>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="eyebrow">{uiCopy.insights.tags.eyebrow}</span>
          <h3>{uiCopy.insights.tags.title}</h3>
        </div>
        {tagBreakdown?.items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Total</th>
                  <th>Helpful</th>
                  <th>Needs work</th>
                </tr>
              </thead>
              <tbody>
                {tagBreakdown.items.map((item) => (
                  <tr key={item.tag}>
                    <td>{getFeedbackTagLabel(item.tag)}</td>
                    <td>{item.total_submissions}</td>
                    <td>{item.helpful_count}</td>
                    <td>{item.not_helpful_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-copy">{uiCopy.insights.tags.empty}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="eyebrow">{uiCopy.insights.languageSignals.eyebrow}</span>
          <h3>{uiCopy.insights.languageSignals.title}</h3>
        </div>
        <p className="muted-copy panel-lead">{uiCopy.insights.languageSignals.description}</p>
        {languageCandidates?.items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{uiCopy.insights.languageSignals.sampleQueryColumn}</th>
                  <th>{uiCopy.insights.languageSignals.mentionsColumn}</th>
                  <th>{uiCopy.insights.languageSignals.helpfulColumn}</th>
                  <th>{uiCopy.insights.languageSignals.needsWorkColumn}</th>
                  <th>{uiCopy.insights.languageSignals.latestFlowColumn}</th>
                  <th>{uiCopy.insights.languageSignals.latestBranchColumn}</th>
                </tr>
              </thead>
              <tbody>
                {languageCandidates.items.map((item) => (
                  <tr key={item.normalized_query}>
                    <td>{item.sample_query}</td>
                    <td>{item.total_mentions}</td>
                    <td>{item.helpful_count}</td>
                    <td>{item.not_helpful_count}</td>
                    <td>{item.latest_procedure_title || "-"}</td>
                    <td>
                      {item.latest_branch_label || uiCopy.insights.languageSignals.unspecifiedBranch}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-copy">{uiCopy.insights.languageSignals.empty}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="eyebrow">{uiCopy.insights.notes.eyebrow}</span>
          <h3>{uiCopy.insights.notes.title}</h3>
        </div>
        {summary?.latest_submissions.length ? (
          <div className="notes-grid">
            {summary.latest_submissions.map((item) => (
              <article className="muted-card note-card ops-note-card" key={item.id}>
                <div className="note-header">
                  <strong>
                    {item.helpful
                      ? uiCopy.insights.notes.helpfulLabel
                      : uiCopy.insights.notes.notHelpfulLabel}
                  </strong>
                  <span
                    className={`status-badge ${item.helpful ? "status-positive" : "status-negative"}`}
                  >
                    {item.helpful
                      ? uiCopy.insights.notes.healthySignal
                      : uiCopy.insights.notes.reviewNeeded}
                  </span>
                </div>
                <div className="ops-note-meta">
                  <span className="muted-copy">
                    {item.branch_label || uiCopy.insights.notes.unspecifiedBranch}
                  </span>
                  <span className="muted-copy">{formatDateTime(item.created_at)}</span>
                </div>
                <p className="body-copy">
                  {item.comment || uiCopy.insights.notes.emptyComment}
                </p>
                <p className="muted-copy">
                  {item.outcome_diagnosis || uiCopy.insights.notes.emptyDiagnosis}
                </p>
                    {item.final_decision_label ? (
                  <p className="muted-copy">
                    {uiCopy.insights.notes.decisionPrefix}: {item.final_decision_label}
                  </p>
                ) : null}
                {item.feedback_tags.length ? (
                  <p className="muted-copy">
                    {uiCopy.insights.notes.tagsPrefix}: {item.feedback_tags.map(getFeedbackTagLabel).join(", ")}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted-copy">{uiCopy.insights.notes.empty}</p>
        )}
      </section>
    </main>
  );
}
