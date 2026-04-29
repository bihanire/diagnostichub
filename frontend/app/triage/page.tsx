"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CareGuide } from "@/components/CareGuide";
import { IssueVisualGuide } from "@/components/IssueVisualGuide";
import { ProgressBar } from "@/components/ProgressBar";
import { nextTriage } from "@/lib/api";
import { uiCopy } from "@/lib/copy";
import { loadSession, saveSession } from "@/lib/session";
import {
  CustomerCare,
  DecisionNodePayload,
  FinalOutcomePayload,
  ProcedureSummary,
  ProgressPayload,
  TriageNextResponse,
  TriageSession
} from "@/lib/types";

const INCOMPLETE_TRIAGE_RESPONSE =
  "The next diagnosis step came back incomplete. Please retry this answer or restart the flow.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDecisionNode(value: unknown): value is DecisionNodePayload {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.question === "string" &&
    value.question.trim().length > 0
  );
}

function isProgress(value: unknown): value is ProgressPayload {
  return (
    isRecord(value) &&
    typeof value.step === "number" &&
    Number.isFinite(value.step) &&
    typeof value.total === "number" &&
    Number.isFinite(value.total) &&
    value.total > 0
  );
}

function isProcedureSummary(value: unknown): value is ProcedureSummary {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    typeof value.category === "string" &&
    typeof value.description === "string"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCustomerCare(value: unknown): value is CustomerCare {
  return (
    isRecord(value) &&
    typeof value.greeting === "string" &&
    typeof value.listening === "string" &&
    typeof value.expectation === "string"
  );
}

function isFinalOutcome(value: unknown): value is FinalOutcomePayload {
  if (!isRecord(value)) {
    return false;
  }

  const warrantyAssessment = value.warranty_assessment;
  const branchPlaybook = value.branch_playbook;

  return (
    typeof value.diagnosis === "string" &&
    typeof value.recommended_action === "string" &&
    typeof value.decision_type === "string" &&
    typeof value.decision_label === "string" &&
    isRecord(warrantyAssessment) &&
    typeof warrantyAssessment.direction === "string" &&
    typeof warrantyAssessment.label === "string" &&
    typeof warrantyAssessment.confidence === "string" &&
    isStringArray(warrantyAssessment.reasons) &&
    isRecord(branchPlaybook) &&
    typeof branchPlaybook.title === "string" &&
    isStringArray(branchPlaybook.steps) &&
    isStringArray(value.related_actions) &&
    isStringArray(value.evidence_checklist) &&
    isCustomerCare(value.customer_care) &&
    typeof value.follow_up_message === "string"
  );
}

function normalizeRelatedProcedures(value: unknown, fallback: ProcedureSummary[]): ProcedureSummary[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value.filter(isProcedureSummary);
  return items.length > 0 ? items : fallback;
}

function getValidatedTriageResponse(response: unknown): TriageNextResponse {
  if (!isRecord(response) || (response.status !== "question" && response.status !== "complete")) {
    throw new Error(INCOMPLETE_TRIAGE_RESPONSE);
  }

  if (!isProgress(response.progress)) {
    throw new Error(INCOMPLETE_TRIAGE_RESPONSE);
  }

  const nextNode = isDecisionNode(response.next_node) ? response.next_node : null;
  const outcome = isFinalOutcome(response.outcome) ? response.outcome : null;

  if (response.status === "question" && !nextNode) {
    throw new Error(INCOMPLETE_TRIAGE_RESPONSE);
  }

  if (response.status === "complete" && !outcome) {
    throw new Error(INCOMPLETE_TRIAGE_RESPONSE);
  }

  return {
    status: response.status,
    progress: response.progress,
    next_node: nextNode,
    outcome,
    related: Array.isArray(response.related) ? response.related.filter(isProcedureSummary) : [],
    message: typeof response.message === "string" ? response.message : null
  };
}

export default function TriagePage() {
  const router = useRouter();
  const [session, setSession] = useState<TriageSession | null>(null);
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [questionKey, setQuestionKey] = useState(0);
  const [questionSwitching, setQuestionSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const switchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    router.prefetch("/result");
    router.prefetch("/");

    const saved = loadSession();
    if (!saved) {
      return;
    }

    if (saved.outcome) {
      router.replace("/result");
      return;
    }

    setSession(saved);

    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
  }, [router]);

  async function answerQuestion(answer: "yes" | "no") {
    const activeSession = session;
    const currentNode = activeSession?.currentNode;
    if (!activeSession || !isDecisionNode(currentNode)) {
      setError(INCOMPLETE_TRIAGE_RESPONSE);
      return;
    }

    setBusy(answer);
    setQuestionSwitching(true);
    setError(null);

    try {
      const response = getValidatedTriageResponse(
        await nextTriage(currentNode.id, answer)
      );
      const nextHistory = [
        ...(activeSession.history || []),
        {
          node_id: currentNode.id,
          question: currentNode.question,
          answer
        }
      ];
      const updatedSession: TriageSession = {
        ...activeSession,
        currentNode: response.next_node ?? null,
        progress: response.progress,
        outcome: response.outcome ?? null,
        related: normalizeRelatedProcedures(response.related, activeSession.related),
        history: nextHistory,
        updatedAt: new Date().toISOString()
      };

      saveSession(updatedSession);
      startTransition(() => {
        setSession(updatedSession);
        if (response.status === "question") {
          setQuestionKey((current) => current + 1);
        }
      });

      if (response.status === "complete") {
        startTransition(() => {
          router.push("/result");
        });
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : uiCopy.triage.nextStepFailure
      );
    } finally {
      setBusy(null);
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
      switchTimerRef.current = window.setTimeout(() => {
        setQuestionSwitching(false);
      }, 180);
    }
  }

  if (!session) {
    return (
      <main className="app-shell" id="main-content">
        <section className="hero">
          <span className="eyebrow">{uiCopy.triage.fallback.eyebrow}</span>
          <h2>{uiCopy.triage.fallback.missingSessionTitle}</h2>
          <p>{uiCopy.triage.fallback.missingSessionDescription}</p>
        </section>
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
        <button className="primary-button" onClick={() => router.push("/")} type="button">
          {uiCopy.global.backToSearch}
        </button>
      </main>
    );
  }

  if (!isDecisionNode(session.currentNode)) {
    return (
      <main className="app-shell" id="main-content">
        <section className="hero">
          <span className="eyebrow">{uiCopy.triage.fallback.eyebrow}</span>
          <h2>{uiCopy.triage.fallback.missingNodeTitle}</h2>
          <p>{uiCopy.triage.fallback.missingNodeDescription}</p>
        </section>
        <button className="primary-button" onClick={() => router.push("/")} type="button">
          {uiCopy.global.backToSearch}
        </button>
      </main>
    );
  }

  const currentNode = session.currentNode;

  return (
    <main className="app-shell" id="main-content">
      <section className="hero hero-compact">
        <div className="hero-inline-meta">
          <span className="eyebrow">{session.procedure.category}</span>
          <span className="hero-status-pill">
            Step {session.progress.step} of {session.progress.total}
          </span>
        </div>
        <h2>{session.procedure.title}</h2>
        <p>{uiCopy.triage.heroLead}</p>
        <div className="triage-hero-note">
          <span className="triage-hero-note-kicker">Current mode</span>
          <strong>Visual confirmation before escalation</strong>
        </div>
      </section>

      <div className="triage-top-grid">
        <ProgressBar step={session.progress.step} total={session.progress.total} />
        <section className="panel panel-compact case-frame-card">
          <span className="eyebrow">{uiCopy.triage.caseFrame.eyebrow}</span>
          <h3>{uiCopy.triage.caseFrame.title}</h3>
          <p className="body-copy">
            {session.query || uiCopy.triage.caseFrame.directStartFallback}
          </p>
        </section>
      </div>

      <div className={`triage-stage-grid ${questionSwitching ? "triage-stage-grid-syncing" : ""}`}>
        <section className={`panel question-panel ${questionSwitching ? "question-panel-syncing" : ""}`}>
          <div key={`${questionKey}-${currentNode.id}`} className="question-surface">
            <span className="eyebrow">{uiCopy.triage.question.eyebrow}</span>
            <h3 className="triage-question">{currentNode.question}</h3>
          </div>
          <div className="question-answer-block">
            <div className="action-strip-copy">
              <span className="eyebrow">{uiCopy.triage.answerStrip.eyebrow}</span>
              <p className="body-copy">{uiCopy.triage.answerStrip.description}</p>
            </div>
            <div className="answer-grid">
              <button
                className="answer-button answer-yes"
                aria-label={uiCopy.triage.answerStrip.yes.label}
                disabled={Boolean(busy) || questionSwitching}
                onClick={() => answerQuestion("yes")}
                type="button"
              >
                <span className="answer-button-label">
                  {busy === "yes"
                    ? uiCopy.triage.answerStrip.yes.busyLabel
                    : uiCopy.triage.answerStrip.yes.label}
                </span>
                <span className="answer-button-note">{uiCopy.triage.answerStrip.yes.note}</span>
              </button>
              <button
                className="answer-button answer-no"
                aria-label={uiCopy.triage.answerStrip.no.label}
                disabled={Boolean(busy) || questionSwitching}
                onClick={() => answerQuestion("no")}
                type="button"
              >
                <span className="answer-button-label">
                  {busy === "no"
                    ? uiCopy.triage.answerStrip.no.busyLabel
                    : uiCopy.triage.answerStrip.no.label}
                </span>
                <span className="answer-button-note">{uiCopy.triage.answerStrip.no.note}</span>
              </button>
            </div>
          </div>
        </section>

        <IssueVisualGuide
          procedureTitle={session.procedure.title}
          procedureCategory={session.procedure.category}
          question={currentNode.question}
        />
      </div>
      {questionSwitching ? (
        <p className="muted-copy triage-sync-note" role="status">
          Syncing the next guided step...
        </p>
      ) : null}

      <details className="panel panel-compact detail-toggle triage-secondary-panel">
        <summary className="detail-toggle-summary">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.triage.flowPurpose.eyebrow}</span>
            <h3>{uiCopy.triage.flowPurpose.title}</h3>
          </div>
          <span className="detail-toggle-action">Open</span>
        </summary>
        <div className="stack-block">
          <p className="body-copy">
            {session.procedure.description || uiCopy.triage.flowPurpose.fallback}
          </p>
          <p className="muted-copy">{uiCopy.triage.reminder.description}</p>
        </div>
      </details>

      <CareGuide compact collapsible customerCare={session.customerCare} />

      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      <div className="action-grid">
        <button className="secondary-button" onClick={() => router.push("/")} type="button">
          {uiCopy.triage.pauseLabel}
        </button>
      </div>
    </main>
  );
}
