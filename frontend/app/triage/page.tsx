"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CareGuide } from "@/components/CareGuide";
import { IssueVisualGuide } from "@/components/IssueVisualGuide";
import { ProductRouteShell } from "@/components/ProductRouteShell";
import { ProgressBar } from "@/components/ProgressBar";
import { nextTriage, warrantyNext } from "@/lib/api";
import { uiCopy } from "@/lib/copy";
import { loadSession, saveSession } from "@/lib/session";
import {
  CustomerCare,
  DecisionNodePayload,
  FinalOutcomePayload,
  ProcedureSummary,
  ProgressPayload,
  TriageNextResponse,
  TriageSession,
  WarrantyNextResponse
} from "@/lib/types";

const INCOMPLETE_TRIAGE_RESPONSE =
  "The next diagnosis step came back incomplete. Please retry this answer or restart the flow.";

// Must match the length of WARRANTY_QUESTIONS in backend/app/services/warranty_service.py
const TOTAL_WARRANTY_QUESTIONS = 4;

type ActiveWarrantyQuestion = {
  index: number;
  question: string;
  answers: ("yes" | "no")[];
};

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

function applyWarrantyResult(
  session: TriageSession,
  response: WarrantyNextResponse,
  answers: ("yes" | "no")[] = []
): TriageSession {
  return {
    ...session,
    warrantyComplete: true,
    warrantyAutoSkipped: response.auto_skipped,
    warrantyDirection: response.warranty_direction,
    warrantyException: response.wty_exception,
    warrantyNeedsReview: response.needs_review,
    warrantyAnswers: answers,
    updatedAt: new Date().toISOString()
  };
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
  const [warrantyQuestion, setWarrantyQuestion] = useState<ActiveWarrantyQuestion | null>(null);
  const switchTimerRef = useRef<number | null>(null);

  async function initiateWarrantyPhase(activeSession: TriageSession) {
    const tCode = activeSession.procedure.primary_t_code || "";
    // Resume from saved answers if the session was partially answered before a refresh.
    const savedAnswers = activeSession.warrantyAnswers ?? [];
    try {
      const response = await warrantyNext({ primary_t_code: tCode, answers: savedAnswers });
      if (response.status === "complete") {
        const updatedSession = applyWarrantyResult(activeSession, response, savedAnswers);
        saveSession(updatedSession);
        setSession(updatedSession);
        startTransition(() => {
          router.push("/result");
        });
      } else if (response.question_index !== null && response.question) {
        setWarrantyQuestion({
          index: response.question_index,
          question: response.question,
          answers: savedAnswers
        });
      } else {
        // Malformed response: status=question but missing question_index or question text.
        setError("Warranty check returned an incomplete response. Please retry.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Warranty check could not be started. Please retry.");
    }
  }

  useEffect(() => {
    router.prefetch("/result");
    router.prefetch("/");

    const saved = loadSession();
    if (!saved) {
      return;
    }

    if (saved.outcome && saved.warrantyComplete) {
      router.replace("/result");
      return;
    }

    setSession(saved);

    if (saved.outcome && !saved.warrantyComplete) {
      void initiateWarrantyPhase(saved);
    }

    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        await initiateWarrantyPhase(updatedSession);
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

  async function answerWarrantyQuestion(answer: "yes" | "no") {
    if (!warrantyQuestion || !session) return;

    setBusy(answer);
    setError(null);

    const newAnswers = [...warrantyQuestion.answers, answer] as ("yes" | "no")[];
    const tCode = session.procedure.primary_t_code || "";

    try {
      const response = await warrantyNext({ primary_t_code: tCode, answers: newAnswers });
      if (response.status === "complete") {
        const updatedSession = applyWarrantyResult(session, response, newAnswers);
        saveSession(updatedSession);
        setSession(updatedSession);
        setWarrantyQuestion(null);
        startTransition(() => {
          router.push("/result");
        });
      } else if (response.question_index !== null && response.question) {
        setWarrantyQuestion({ index: response.question_index, question: response.question, answers: newAnswers });
      } else {
        setError("Warranty check returned an incomplete response. Please retry.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Warranty check failed. Please retry.");
    } finally {
      setBusy(null);
    }
  }

  if (!session) {
    return (
      <ProductRouteShell
        className="triage-route"
        status={{
          phase: "Guided triage",
          procedure: "No active case",
          confidence: "Not started",
          readiness: "Attention needed",
        }}
      >
        <section className="hero">
          <span className="eyebrow">{uiCopy.triage.fallback.eyebrow}</span>
          <h2>{uiCopy.triage.fallback.missingSessionTitle}</h2>
          <p>{uiCopy.triage.fallback.missingSessionDescription}</p>
        </section>
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
        <button className="primary-button" onClick={() => router.push("/")} type="button">
          {uiCopy.global.backToSearch}
        </button>
      </ProductRouteShell>
    );
  }

  if (warrantyQuestion !== null) {
    const totalWarrantyQuestions = TOTAL_WARRANTY_QUESTIONS;
    return (
      <ProductRouteShell
        className="triage-route"
        selectedFamilyId={session.learningFamilyId || null}
        status={{
          phase: `Warranty check ${warrantyQuestion.index + 1} of ${totalWarrantyQuestions}`,
          family: session.learningFamilyTitle || "Not selected",
          procedure: session.procedure.title,
          confidence: session.searchConfidenceState || "Guided",
          readiness: error ? "Attention needed" : "Operational",
        }}
      >
        <section className="hero hero-compact">
          <div className="hero-inline-meta">
            <span className="eyebrow">{session.procedure.category}</span>
            <span className="hero-status-pill">
              Warranty check {warrantyQuestion.index + 1} of {totalWarrantyQuestions}
            </span>
          </div>
          <h2>{session.procedure.title}</h2>
          <p>Answer these short questions to confirm the warranty direction before submitting.</p>
        </section>

        <div className="triage-top-grid motion-stage">
          <div className="stagger-item" style={{ animationDelay: "0ms" }}>
            <ProgressBar step={warrantyQuestion.index + 1} total={totalWarrantyQuestions} />
          </div>
          <section className="panel panel-compact case-frame-card motion-surface stagger-item" style={{ animationDelay: "56ms" }}>
            <span className="eyebrow">{uiCopy.triage.caseFrame.eyebrow}</span>
            <h3>{uiCopy.triage.caseFrame.title}</h3>
            <p className="body-copy">
              {session.query || uiCopy.triage.caseFrame.directStartFallback}
            </p>
          </section>
        </div>

        <div className="triage-stage-grid">
          <section className="panel question-panel motion-surface">
            <div className="question-surface">
              <span className="eyebrow">Warranty question</span>
              <h3 className="triage-question">{warrantyQuestion.question}</h3>
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
                  disabled={Boolean(busy)}
                  onClick={() => answerWarrantyQuestion("yes")}
                  type="button"
                >
                  <span className="answer-button-label">
                    {busy === "yes" ? uiCopy.triage.answerStrip.yes.busyLabel : uiCopy.triage.answerStrip.yes.label}
                  </span>
                  <span className="answer-button-note">{uiCopy.triage.answerStrip.yes.note}</span>
                </button>
                <button
                  className="answer-button answer-no"
                  aria-label={uiCopy.triage.answerStrip.no.label}
                  disabled={Boolean(busy)}
                  onClick={() => answerWarrantyQuestion("no")}
                  type="button"
                >
                  <span className="answer-button-label">
                    {busy === "no" ? uiCopy.triage.answerStrip.no.busyLabel : uiCopy.triage.answerStrip.no.label}
                  </span>
                  <span className="answer-button-note">{uiCopy.triage.answerStrip.no.note}</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        <CareGuide compact collapsible customerCare={session.customerCare} />

        {error ? <p className="error-banner" role="alert">{error}</p> : null}

        <div className="action-grid">
          <button className="secondary-button" onClick={() => router.push("/")} type="button">
            {uiCopy.triage.pauseLabel}
          </button>
        </div>
      </ProductRouteShell>
    );
  }

  if (!isDecisionNode(session.currentNode)) {
    const awaitingWarranty = Boolean(session.outcome) && !session.warrantyComplete;
    return (
      <ProductRouteShell
        className="triage-route"
        selectedFamilyId={session.learningFamilyId || null}
        status={{
          phase: "Guided triage",
          family: session.learningFamilyTitle || "Not selected",
          procedure: session.procedure.title,
          confidence: session.searchConfidenceState || "Review needed",
          readiness: "Attention needed",
        }}
      >
        <section className="hero">
          <span className="eyebrow">{uiCopy.triage.fallback.eyebrow}</span>
          <h2>
            {awaitingWarranty && !error
              ? "Preparing warranty check…"
              : uiCopy.triage.fallback.missingNodeTitle}
          </h2>
          <p>
            {awaitingWarranty && !error
              ? "Loading the next step."
              : uiCopy.triage.fallback.missingNodeDescription}
          </p>
        </section>
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
        {!awaitingWarranty || error ? (
          <button className="primary-button" onClick={() => router.push("/")} type="button">
            {uiCopy.global.backToSearch}
          </button>
        ) : null}
      </ProductRouteShell>
    );
  }

  const currentNode = session.currentNode;

  return (
    <ProductRouteShell
      className="triage-route"
      selectedFamilyId={session.learningFamilyId || null}
      status={{
        phase: `Step ${session.progress.step} of ${session.progress.total}`,
        family: session.learningFamilyTitle || "Not selected",
        procedure: session.procedure.title,
        confidence: session.searchConfidenceState || "Guided",
        readiness: error ? "Attention needed" : "Operational",
      }}
    >
      <section className="hero hero-compact">
        <div className="hero-inline-meta">
          <span className="eyebrow">{session.procedure.category}</span>
          <span className="hero-status-pill">
            Step {session.progress.step} of {session.progress.total}
          </span>
        </div>
        <h2>{session.procedure.title}</h2>
        {session.learningFamilyTitle ? (
          <p className="triage-learning-breadcrumb">
            {session.learningFamilyTitle}
            {session.learningTrackTitle ? ` -> ${session.learningTrackTitle}` : ""}
            {" -> Guided steps"}
          </p>
        ) : null}
        <p>{uiCopy.triage.heroLead}</p>
        <div className="triage-hero-note">
          <span className="triage-hero-note-kicker">Current mode</span>
          <strong>Visual confirmation before escalation</strong>
        </div>
      </section>

      <div className="triage-top-grid motion-stage">
        <div className="stagger-item" style={{ animationDelay: "0ms" }}>
          <ProgressBar step={session.progress.step} total={session.progress.total} />
        </div>
        <section className="panel panel-compact case-frame-card motion-surface stagger-item" style={{ animationDelay: "56ms" }}>
          <span className="eyebrow">{uiCopy.triage.caseFrame.eyebrow}</span>
          <h3>{uiCopy.triage.caseFrame.title}</h3>
          <p className="body-copy">
            {session.query || uiCopy.triage.caseFrame.directStartFallback}
          </p>
        </section>
      </div>

      <div className={`triage-stage-grid ${questionSwitching ? "triage-stage-grid-syncing" : ""}`}>
        <section className={`panel question-panel motion-surface ${questionSwitching ? "question-panel-syncing" : ""}`}>
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

      <CareGuide compact collapsible customerCare={session.customerCare} />

      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      <div className="action-grid">
        <button className="secondary-button" onClick={() => router.push("/")} type="button">
          {uiCopy.triage.pauseLabel}
        </button>
      </div>
    </ProductRouteShell>
  );
}
