import { getRelated } from "@/lib/api";
import {
  CASE_PACKET_SCHEMA_VERSION,
  getDeliveryReadiness,
  getEvidenceState,
} from "@/lib/case-packet-schema";
import { getKnowledgeSourceIdsForCase } from "@/lib/knowledge-sources";
import { loadSession, saveSession } from "@/lib/session";
import {
  CasePacket,
  ProcedureSummary,
  TriageSession,
  TriageStartResponse,
} from "@/lib/types";

type LearningContext = {
  familyId?: string | null;
  familyTitle?: string | null;
  trackTitle?: string | null;
};

type SearchContext = {
  confidence?: number | null;
  confidenceState?: string | null;
  confidenceMargin?: number | null;
  needsReview?: boolean;
};

type BuildTriageSessionOptions = {
  query?: string;
  learningContext?: LearningContext;
  related?: ProcedureSummary[];
  searchContext?: SearchContext;
};

type PersistOptions = {
  onHydrated?: (session: TriageSession) => void;
  onSaved?: (session: TriageSession) => void;
};

export function buildTriageSessionFromStart(
  response: TriageStartResponse,
  options: BuildTriageSessionOptions = {}
): TriageSession {
  return {
    query: options.query || response.procedure.title,
    learningFamilyId: options.learningContext?.familyId || null,
    learningFamilyTitle: options.learningContext?.familyTitle || null,
    learningTrackTitle: options.learningContext?.trackTitle || null,
    searchConfidence: options.searchContext?.confidence ?? null,
    searchConfidenceState: options.searchContext?.confidenceState ?? null,
    searchConfidenceMargin: options.searchContext?.confidenceMargin ?? null,
    searchNeedsReview: options.searchContext?.needsReview ?? false,
    procedure: response.procedure,
    currentNode: response.current_node || null,
    progress: response.progress,
    customerCare: response.customer_care,
    sop: response.sop,
    outcome: response.outcome || null,
    related: options.related || [],
    history: [],
    dispatchGateConfirmed: [],
    updatedAt: new Date().toISOString(),
  };
}

export function persistTriageSessionWithRelatedHydration(
  session: TriageSession,
  options: PersistOptions = {}
) {
  saveSession(session);
  options.onSaved?.(session);

  void getRelated(session.procedure.id)
    .then((response) => {
      const latest = loadSession();
      if (
        !latest ||
        latest.updatedAt !== session.updatedAt ||
        latest.procedure.id !== session.procedure.id
      ) {
        return;
      }

      const hydratedSession: TriageSession = {
        ...latest,
        related: response.items,
        updatedAt: new Date().toISOString(),
      };
      saveSession(hydratedSession);
      options.onHydrated?.(hydratedSession);
    })
    .catch(() => {
      // Related suggestions are useful, but should never block opening the guided flow.
    });
}

export function getTriageRoute(response: TriageStartResponse): "/result" | "/triage" {
  return response.status === "complete" ? "/result" : "/triage";
}

export function buildCasePacketFromSession(session: TriageSession): CasePacket {
  const outcome = session.outcome || null;
  const updatedAtMs = Date.parse(session.updatedAt) || Date.now();
  const ticketReadiness = outcome ? "ready_for_ticket_draft" : "needs_triage_completion";
  const evidenceChecklist = outcome?.evidence_checklist || [];
  const dispatchGateConfirmed = session.dispatchGateConfirmed || [];
  const evidenceState = getEvidenceState({ dispatchGateConfirmed, evidenceChecklist });
  const deliveryReadiness = getDeliveryReadiness({ evidenceState, ticketReadiness });
  const warrantyDirection = outcome?.warranty_assessment.label || outcome?.warranty_status || null;

  return {
    id: `case-${session.procedure.id}-${updatedAtMs}`,
    schemaVersion: CASE_PACKET_SCHEMA_VERSION,
    source: "diagnostic_hub",
    eventName: outcome ? "diagnostic.case.completed" : "diagnostic.case.in_progress",
    createdAt: session.updatedAt,
    idempotencyKey: `diagnostichub:${session.procedure.id}:${updatedAtMs}`,
    privacyClassification: session.query?.trim()
      ? "contains_customer_free_text"
      : "internal_operational",
    query: session.query || session.procedure.title,
    family: {
      id: session.learningFamilyId || null,
      title: session.learningFamilyTitle || null,
      trackTitle: session.learningTrackTitle || null,
    },
    procedure: session.procedure,
    answers: session.history || [],
    diagnosis: outcome?.diagnosis || null,
    recommendation: outcome?.recommended_action || null,
    decisionLabel: outcome?.decision_label || null,
    warrantyDirection,
    evidenceChecklist,
    dispatchGateConfirmed,
    feedbackStatus: session.feedback ? "saved" : "not_saved",
    ticketReadiness,
    evidenceState,
    deliveryReadiness,
    watuDecision: {
      decisionLabel: outcome?.decision_label || null,
      warrantyDirection,
      ticketReadiness,
    },
    knowledgeSourceIds: getKnowledgeSourceIdsForCase(
      session.procedure,
      session.learningFamilyId,
      session.query
    ),
  };
}
