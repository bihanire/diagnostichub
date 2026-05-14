import type {
  CasePacket,
  CasePacketWebhookRequirement,
  IpaasCandidateProfile,
} from "@/lib/types";

export const CASE_PACKET_SCHEMA_VERSION = "diagnostichub.case_packet.v1" as const;

export const CASE_PACKET_WEBHOOK_REQUIREMENTS: CasePacketWebhookRequirement[] = [
  {
    id: "signed_delivery",
    label: "Signed delivery",
    reason: "Outbound case events must be verifiable by the receiving automation target.",
    sourceIds: ["webhook-best-practices"],
  },
  {
    id: "idempotency_key",
    label: "Idempotency key",
    reason: "Retries must not create duplicate tickets or duplicate branch tasks.",
    sourceIds: ["webhook-best-practices", "watu-sop-pack"],
  },
  {
    id: "retry_and_dead_letter",
    label: "Retry and dead-letter review",
    reason: "Failed deliveries need a visible recovery path before any branch depends on automation.",
    sourceIds: ["webhook-best-practices"],
  },
  {
    id: "privacy_review",
    label: "Privacy review",
    reason: "Case queries and notes can contain customer wording, so outbound targets need approval first.",
    sourceIds: ["watu-sop-pack"],
  },
  {
    id: "schema_versioning",
    label: "Schema versioning",
    reason: "External automations should bind to a stable payload version, not changing UI state.",
    sourceIds: ["power-automate-http-trigger", "zapier-rest-hooks", "make-webhooks"],
  },
];

export const IPAAS_CANDIDATE_PROFILES: IpaasCandidateProfile[] = [
  {
    id: "power_automate",
    label: "Power Automate",
    bestFor: "Microsoft-centered workflows where branch operations already use Microsoft approvals, lists, or Teams.",
    cautions: [
      "Confirm authentication and environment ownership before sending customer wording.",
      "Keep payloads stable because downstream flows are often edited by non-engineers.",
    ],
    sourceIds: ["power-automate-http-trigger", "webhook-best-practices"],
  },
  {
    id: "zapier",
    label: "Zapier",
    bestFor: "Fast pilot automations that need simple webhook triggers and predictable case fields.",
    cautions: [
      "Avoid sending sensitive notes until privacy routing is approved.",
      "Use versioned events so future ticket fields do not break existing Zaps.",
    ],
    sourceIds: ["zapier-webhooks", "zapier-rest-hooks", "webhook-best-practices"],
  },
  {
    id: "make",
    label: "Make",
    bestFor: "Scenario-style routing where one case packet may branch into several operational paths.",
    cautions: [
      "Name events and fields plainly so scenario owners can debug failures.",
      "Keep retry behavior explicit before using it for real service movement.",
    ],
    sourceIds: ["make-webhooks", "webhook-best-practices"],
  },
  {
    id: "direct_webhook",
    label: "Direct backend webhook",
    bestFor: "A controlled production integration with strict signing, storage, retries, and audit logs.",
    cautions: [
      "Requires more engineering ownership than iPaaS.",
      "Should only start after packet schema and privacy rules are stable.",
    ],
    sourceIds: ["webhook-best-practices", "watu-sop-pack"],
  },
];

export function getEvidenceState(packet: Pick<CasePacket, "dispatchGateConfirmed" | "evidenceChecklist">) {
  if (packet.evidenceChecklist.length === 0) {
    return "not_required" as const;
  }
  return packet.dispatchGateConfirmed.length >= packet.evidenceChecklist.length
    ? "complete" as const
    : "pending" as const;
}

export function getDeliveryReadiness(
  packet: Pick<CasePacket, "evidenceState" | "ticketReadiness">
): CasePacket["deliveryReadiness"] {
  if (packet.ticketReadiness === "needs_triage_completion") {
    return "blocked_incomplete_triage";
  }
  if (packet.evidenceState === "pending") {
    return "blocked_missing_evidence";
  }
  return "ready_for_operator_review";
}

export function getCasePacketSchemaPreview(): Record<string, unknown> {
  return {
    schemaVersion: CASE_PACKET_SCHEMA_VERSION,
    eventName: "diagnostic.case.completed",
    idempotencyKey: "case-<procedureId>-<updatedAtMs>",
    privacyClassification: "contains_customer_free_text",
    source: "diagnostic_hub",
    case: {
      query: "customer wording from branch search",
      family: {
        id: "power",
        title: "Power & Thermal",
        trackTitle: "Charging safety",
      },
      procedure: {
        id: 4,
        title: "Charging Issue",
        category: "Power & Thermal",
      },
      answers: [
        {
          node_id: 401,
          question: "Does the device show a moisture warning?",
          answer: "yes",
        },
      ],
      watuDecision: {
        decisionLabel: "Book repair intake",
        warrantyDirection: "Needs inspection",
        ticketReadiness: "ready_for_ticket_draft",
      },
      evidenceState: "pending",
      feedbackStatus: "not_saved",
      knowledgeSourceIds: ["samsung-moisture-port", "watu-sop-pack"],
    },
    delivery: {
      readiness: "blocked_missing_evidence",
      sent: false,
      target: "not_configured",
    },
  };
}

export function getCasePacketExportPreview(packet: CasePacket): Record<string, unknown> {
  return {
    schemaVersion: packet.schemaVersion,
    eventName: packet.eventName,
    idempotencyKey: packet.idempotencyKey,
    privacyClassification: packet.privacyClassification,
    source: packet.source,
    createdAt: packet.createdAt,
    case: {
      id: packet.id,
      query: packet.query,
      family: packet.family,
      procedure: {
        id: packet.procedure.id,
        title: packet.procedure.title,
        category: packet.procedure.category,
      },
      answers: packet.answers,
      diagnosis: packet.diagnosis,
      recommendation: packet.recommendation,
      watuDecision: packet.watuDecision,
      evidenceChecklist: packet.evidenceChecklist,
      evidenceState: packet.evidenceState,
      feedbackStatus: packet.feedbackStatus,
      knowledgeSourceIds: packet.knowledgeSourceIds,
    },
    delivery: {
      readiness: packet.deliveryReadiness,
      sent: false,
      target: "not_configured",
    },
  };
}
