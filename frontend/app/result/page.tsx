"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CareGuide } from "@/components/CareGuide";
import { IssueVisualGuide } from "@/components/IssueVisualGuide";
import { SuggestionList } from "@/components/SuggestionList";
import { getRelated, startTriage, submitFeedback } from "@/lib/api";
import { feedbackTagOptions, getFeedbackTagLabel, uiCopy } from "@/lib/copy";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { ProcedureSummary, TriageSession } from "@/lib/types";

export default function ResultPage() {
  const router = useRouter();
  const [session, setSession] = useState<TriageSession | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [dispatchGateConfirmed, setDispatchGateConfirmed] = useState<string[]>([]);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [branchLabel, setBranchLabel] = useState("");
  const [comment, setComment] = useState("");
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/triage");
    router.prefetch("/result");

    const saved = loadSession();
    if (!saved) {
      return;
    }

    if (!saved.outcome) {
      router.replace("/triage");
      return;
    }

    setSession(saved);
    setDispatchGateConfirmed(saved.dispatchGateConfirmed || []);
    if (saved.feedback) {
      setHelpful(saved.feedback.helpful);
      setBranchLabel(saved.feedback.branch_label || "");
      setComment(saved.feedback.comment || "");
      setFeedbackTags(saved.feedback.feedback_tags || []);
      setFeedbackMessage("Feedback already saved for this case.");
    }
  }, [router]);

  async function openRelatedFlow(procedure: ProcedureSummary) {
    setStartingId(procedure.id);
    setError(null);

    try {
      const response = await startTriage(procedure.id);

      const nextSession: TriageSession = {
        query: procedure.title,
        procedure: response.procedure,
        currentNode: response.current_node || null,
        progress: response.progress,
        customerCare: response.customer_care,
        sop: response.sop,
        outcome: response.outcome || null,
        related: [],
        history: [],
        dispatchGateConfirmed: [],
        updatedAt: new Date().toISOString()
      };

      saveSession(nextSession);
      startTransition(() => {
        setSession(nextSession);
      });
      void getRelated(procedure.id)
        .then((relatedResponse) => {
          const latest = loadSession();
          if (
            !latest ||
            latest.updatedAt !== nextSession.updatedAt ||
            latest.procedure.id !== nextSession.procedure.id
          ) {
            return;
          }
          const hydratedSession: TriageSession = {
            ...latest,
            related: relatedResponse.items,
            updatedAt: new Date().toISOString()
          };
          saveSession(hydratedSession);
          startTransition(() => {
            setSession((current) => {
              if (
                !current ||
                current.updatedAt !== nextSession.updatedAt ||
                current.procedure.id !== nextSession.procedure.id
              ) {
                return current;
              }
              return hydratedSession;
            });
          });
        })
        .catch(() => {
          // Keep flow startup fast even if related suggestions fail.
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
        requestError instanceof Error
          ? requestError.message
          : uiCopy.result.feedback.openRelatedFailure
      );
    } finally {
      setStartingId(null);
    }
  }

  function startOver() {
    clearSession();
    router.push("/");
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.outcome) {
      return;
    }

    if (helpful === null) {
      setError(uiCopy.result.feedback.chooseHelpfulness);
      return;
    }

    setSubmittingFeedback(true);
    setError(null);

    try {
      const response = await submitFeedback({
        helpful,
        procedure_id: session.procedure.id,
        query: session.query || null,
        branch_label: branchLabel.trim() || null,
        comment: comment.trim() || null,
        outcome_diagnosis: session.outcome.diagnosis,
        feedback_tags: feedbackTags,
        triage_trace: session.history,
        final_decision_label: session.outcome.decision_label,
        search_confidence: session.searchConfidence ?? null,
        search_confidence_state: session.searchConfidenceState ?? null
      });

      const nextSession: TriageSession = {
        ...session,
        feedback: {
          id: response.id,
          helpful,
          branch_label: branchLabel.trim() || null,
          comment: comment.trim() || null,
          feedback_tags: feedbackTags,
          submitted_at: response.created_at
        },
        updatedAt: new Date().toISOString()
      };

      saveSession(nextSession);
      setSession(nextSession);
      setFeedbackMessage(response.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : uiCopy.result.feedback.saveFailure
      );
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (!session?.outcome) {
    return (
      <main className="app-shell" id="main-content">
        <section className="hero">
          <span className="eyebrow">{uiCopy.result.fallback.eyebrow}</span>
          <h2>{uiCopy.result.fallback.title}</h2>
          <p>{uiCopy.result.fallback.description}</p>
        </section>
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
        <button className="primary-button" onClick={() => router.push("/")} type="button">
          {uiCopy.global.backToSearch}
        </button>
      </main>
    );
  }

  const outcome = session.outcome;
  const showDispatchThreshold =
    outcome.decision_type === "repair_intake" || outcome.decision_type === "service_centre";
  const gateTotal = outcome.evidence_checklist.length;
  const gateComplete = gateTotal > 0 && dispatchGateConfirmed.length === gateTotal;

  function persistSession(nextSession: TriageSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function toggleDispatchItem(item: string) {
    if (!session) {
      return;
    }

    const nextConfirmed = dispatchGateConfirmed.includes(item)
      ? dispatchGateConfirmed.filter((current) => current !== item)
      : [...dispatchGateConfirmed, item];
    setDispatchGateConfirmed(nextConfirmed);
    persistSession({
      ...session,
      dispatchGateConfirmed: nextConfirmed,
      updatedAt: new Date().toISOString(),
    });
  }

  function toggleFeedbackTag(tag: string) {
    setFeedbackTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  return (
    <main className="app-shell" id="main-content">
      <section className="hero hero-compact result-hero motion-surface">
        <div className="result-hero-grid">
          <div className="result-hero-main">
            <div className="result-hero-topline">
              <div className="result-hero-brandlock">
                <span className="result-hero-mark" aria-hidden="true">
                  <span />
                  <span />
                </span>
                <span className="result-hero-brand">{uiCopy.result.hero.department}</span>
                <span className="result-hero-divider" aria-hidden="true" />
                <span className="result-hero-subbrand">{uiCopy.result.hero.eyebrow}</span>
              </div>
            </div>
            <h2>{session.procedure.title}</h2>
            <p>{outcome.follow_up_message}</p>
            <div className="result-hero-footer">
              <span className="result-hero-footer-item">{uiCopy.result.hero.footerLabel}</span>
              <span className="result-hero-footer-item">{session.procedure.category}</span>
              <span className="result-hero-footer-item">{uiCopy.result.summary.flowComplete}</span>
            </div>
          </div>

          <aside className="result-hero-command">
            <span className="result-hero-command-label">{uiCopy.result.actionCard.decisionTitle}</span>
            <strong className="result-hero-command-title">{outcome.decision_label}</strong>
            <div className="result-hero-command-stack">
              <div className="result-hero-command-item">
                <span>{uiCopy.result.actionCard.actionEyebrow}</span>
                <p>{outcome.recommended_action}</p>
              </div>
              <div className="result-hero-command-item">
                <span>{uiCopy.result.actionCard.warrantyEyebrow}</span>
                <p>{outcome.warranty_status || uiCopy.result.actionCard.warrantyFallback}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="panel result-grid result-grid-priority motion-stage">
        <div className="result-copy result-copy-strong motion-card stagger-item" style={{ animationDelay: "0ms" }}>
          <span className="eyebrow">{uiCopy.result.primary.eyebrow}</span>
          <strong>{uiCopy.result.actionCard.actionTitle}</strong>
          <p>{outcome.recommended_action}</p>
        </div>
        <div className="result-copy motion-card stagger-item" style={{ animationDelay: "56ms" }}>
          <span className="eyebrow">{uiCopy.result.primary.eyebrow}</span>
          <strong>{uiCopy.result.actionCard.diagnosisTitle}</strong>
          <p>{outcome.diagnosis}</p>
        </div>
        <div className="result-copy motion-card stagger-item" style={{ animationDelay: "112ms" }}>
          <span className="eyebrow">{uiCopy.result.primary.eyebrow}</span>
          <strong>{uiCopy.result.actionCard.warrantyTitle}</strong>
          <p>{outcome.warranty_status || uiCopy.result.actionCard.warrantyFallback}</p>
        </div>
      </section>

      <section className="panel result-secondary-grid motion-stage">
        <div className="result-copy motion-card stagger-item" style={{ animationDelay: "0ms" }}>
          <span className="eyebrow">{uiCopy.result.warrantyDirection.eyebrow}</span>
          <strong>{uiCopy.result.warrantyDirection.title}</strong>
          <div className="chip-row result-chip-row">
            <span className="chip">{outcome.warranty_assessment.label}</span>
            <span className="chip chip-muted">
              {uiCopy.result.warrantyDirection.confidenceLabel}: {outcome.warranty_assessment.confidence}
            </span>
          </div>
          <ul className="bullet-list result-inline-list">
            {outcome.warranty_assessment.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div className="result-copy motion-card stagger-item" style={{ animationDelay: "56ms" }}>
          <span className="eyebrow">{uiCopy.result.playbook.eyebrow}</span>
          <strong>{uiCopy.result.playbook.title}</strong>
          <p className="body-copy result-playbook-title">{outcome.branch_playbook.title}</p>
          <ol className="ordered-list result-inline-list">
            {outcome.branch_playbook.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <IssueVisualGuide
        procedureTitle={session.procedure.title}
        procedureCategory={session.procedure.category}
      />

      {showDispatchThreshold && outcome.evidence_checklist.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.result.operational.eyebrow}</span>
            <h3>{uiCopy.result.threshold.title}</h3>
          </div>
          <p className="body-copy panel-lead">{uiCopy.result.threshold.description}</p>
          <div className="result-gate-status">
            <span className={`status-badge ${gateComplete ? "status-positive" : "status-negative"}`}>
              {gateComplete ? uiCopy.result.gate.readyLabel : uiCopy.result.gate.prompt}
            </span>
            <span className="muted-copy">
              {uiCopy.result.gate.progressPrefix} {dispatchGateConfirmed.length} / {gateTotal} {uiCopy.result.gate.progressSuffix}
            </span>
          </div>
          <div className="gate-checklist">
            {outcome.evidence_checklist.map((item) => {
              const checked = dispatchGateConfirmed.includes(item);
              return (
                <button
                  key={item}
                  className={`gate-check ${checked ? "gate-check-complete" : ""}`}
                  onClick={() => toggleDispatchItem(item)}
                  type="button"
                >
                  <span className="gate-check-mark" aria-hidden="true">
                    {checked ? "OK" : ""}
                  </span>
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <details className="panel panel-compact detail-toggle" open>
        <summary className="detail-toggle-summary">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.result.summary.eyebrow}</span>
            <h3>{uiCopy.result.summary.title}</h3>
          </div>
          <span className="detail-toggle-action">Open</span>
        </summary>
        <div className="chip-row">
          <span className="chip">Category: {session.procedure.category}</span>
          <span className="chip chip-muted">{uiCopy.result.summary.flowComplete}</span>
        </div>
        <p className="body-copy result-summary-copy">
          {session.query || uiCopy.result.summary.directProcedureFallback}
        </p>
      </details>

      <CareGuide collapsible customerCare={outcome.customer_care} />

      <details className="panel panel-compact detail-toggle">
        <summary className="detail-toggle-summary">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.result.operational.eyebrow}</span>
            <h3>{uiCopy.result.relatedActions.title}</h3>
          </div>
          <span className="detail-toggle-action">Open</span>
        </summary>
        <ul className="bullet-list">
          {outcome.related_actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </details>

      <details className="panel panel-compact detail-toggle">
        <summary className="detail-toggle-summary">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.result.relatedFlows.eyebrow}</span>
            <h3>{uiCopy.result.suggestions.title}</h3>
          </div>
          <span className="detail-toggle-action">Open</span>
        </summary>
        <SuggestionList
          title={uiCopy.result.suggestions.title}
          items={session.related}
          emptyMessage={uiCopy.result.suggestions.empty}
          onSelect={openRelatedFlow}
          embedded
        />
      </details>

      <details className="panel detail-toggle">
        <summary className="detail-toggle-summary">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.result.feedback.eyebrow}</span>
            <h3>{uiCopy.result.feedback.title}</h3>
          </div>
          <span className="detail-toggle-action">{session.feedback ? "Open" : "Review"}</span>
        </summary>

        {session.feedback ? (
          <div className="stack-block">
            <p className="body-copy">
              {uiCopy.result.feedback.alreadySavedPrefix}{" "}
              <strong>
                {session.feedback.helpful
                  ? uiCopy.result.feedback.helpfulLabel
                  : uiCopy.result.feedback.notHelpfulLabel}
              </strong>
              .
            </p>
            {session.feedback.branch_label ? (
              <p className="muted-copy">
                {uiCopy.result.feedback.branchPrefix}: {session.feedback.branch_label}
              </p>
            ) : null}
            {session.feedback.comment ? (
              <p className="muted-copy">
                {uiCopy.result.feedback.notePrefix}: {session.feedback.comment}
              </p>
            ) : null}
            {session.feedback.feedback_tags?.length ? (
              <p className="muted-copy">
                {uiCopy.result.feedback.tagsLabel}: {session.feedback.feedback_tags.map(getFeedbackTagLabel).join(", ")}
              </p>
            ) : null}
          </div>
        ) : (
          <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
            <div className="choice-row">
              <button
                className={`choice-button ${helpful === true ? "choice-button-active" : ""}`}
                onClick={() => setHelpful(true)}
                type="button"
              >
                {uiCopy.result.feedback.helpfulChoice}
              </button>
              <button
                className={`choice-button ${helpful === false ? "choice-button-active" : ""}`}
                onClick={() => setHelpful(false)}
                type="button"
              >
                {uiCopy.result.feedback.notHelpfulChoice}
              </button>
            </div>

            <label className="field-label" htmlFor="branchLabel">
              {uiCopy.result.feedback.branchLabel}
            </label>
            <input
              id="branchLabel"
              className="text-input"
              maxLength={120}
              onChange={(event) => setBranchLabel(event.target.value)}
              placeholder={uiCopy.result.feedback.branchPlaceholder}
              type="text"
              value={branchLabel}
            />

            <label className="field-label">{uiCopy.result.feedback.tagsLabel}</label>
            <div className="choice-row">
              {feedbackTagOptions.map((item) => (
                <button
                  key={item.value}
                  className={`choice-button ${feedbackTags.includes(item.value) ? "choice-button-active" : ""}`}
                  onClick={() => toggleFeedbackTag(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="feedbackComment">
              {uiCopy.result.feedback.commentLabel}
            </label>
            <textarea
              id="feedbackComment"
              className="text-input feedback-textarea"
              maxLength={1500}
              onChange={(event) => setComment(event.target.value)}
              placeholder={uiCopy.result.feedback.commentPlaceholder}
              value={comment}
            />

            <button className="primary-button" disabled={submittingFeedback} type="submit">
              {submittingFeedback
                ? uiCopy.result.feedback.submittingLabel
                : uiCopy.result.feedback.submitLabel}
            </button>
          </form>
        )}

        {feedbackMessage ? <p className="success-banner" role="status">{feedbackMessage}</p> : null}
      </details>

      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      {startingId ? (
        <p className="muted-copy" role="status">
          {uiCopy.result.feedback.relatedFlowBusy}
        </p>
      ) : null}

      <div className="action-grid action-grid-balanced">
        <button className="secondary-button" onClick={() => router.push("/")} type="button">
          {uiCopy.global.backToSearch}
        </button>
        <button className="primary-button" onClick={startOver} type="button">
          {uiCopy.global.startNewCase}
        </button>
      </div>
    </main>
  );
}
