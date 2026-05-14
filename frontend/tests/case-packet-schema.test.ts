import { describe, expect, it } from "vitest";

import {
  CASE_PACKET_SCHEMA_VERSION,
  CASE_PACKET_WEBHOOK_REQUIREMENTS,
  getCasePacketExportPreview,
  getCasePacketSchemaPreview,
  getDeliveryReadiness,
  getEvidenceState,
  IPAAS_CANDIDATE_PROFILES,
} from "@/lib/case-packet-schema";
import type { CasePacket } from "@/lib/types";

function buildPacket(overrides: Partial<CasePacket> = {}): CasePacket {
  return {
    id: "case-4-1778234400000",
    schemaVersion: CASE_PACKET_SCHEMA_VERSION,
    source: "diagnostic_hub",
    eventName: "diagnostic.case.completed",
    createdAt: "2026-05-13T10:00:00.000Z",
    idempotencyKey: "diagnostichub:4:1778234400000",
    privacyClassification: "contains_customer_free_text",
    query: "moisture warning when charging",
    family: {
      id: "power",
      title: "Power & Thermal",
      trackTitle: "Charging safety",
    },
    procedure: {
      id: 4,
      title: "Charging Issue",
      category: "Power & Thermal",
      description: "Use this for charging issues.",
      outcome: "Charging path complete.",
      warranty_status: "Inspection required.",
    },
    answers: [],
    diagnosis: "Charging path needs review.",
    recommendation: "Do not keep charging at the branch.",
    decisionLabel: "Book repair intake",
    warrantyDirection: "Needs inspection",
    evidenceChecklist: ["Record moisture warning."],
    dispatchGateConfirmed: [],
    feedbackStatus: "not_saved",
    ticketReadiness: "ready_for_ticket_draft",
    evidenceState: "pending",
    deliveryReadiness: "blocked_missing_evidence",
    watuDecision: {
      decisionLabel: "Book repair intake",
      warrantyDirection: "Needs inspection",
      ticketReadiness: "ready_for_ticket_draft",
    },
    knowledgeSourceIds: ["samsung-moisture-port", "watu-sop-pack"],
    ...overrides,
  };
}

describe("case packet schema readiness", () => {
  it("calculates evidence and delivery readiness conservatively", () => {
    expect(
      getEvidenceState({
        evidenceChecklist: [],
        dispatchGateConfirmed: [],
      })
    ).toBe("not_required");
    expect(
      getEvidenceState({
        evidenceChecklist: ["Photo captured"],
        dispatchGateConfirmed: ["Photo captured"],
      })
    ).toBe("complete");
    expect(
      getDeliveryReadiness({
        ticketReadiness: "needs_triage_completion",
        evidenceState: "complete",
      })
    ).toBe("blocked_incomplete_triage");
    expect(
      getDeliveryReadiness({
        ticketReadiness: "ready_for_ticket_draft",
        evidenceState: "pending",
      })
    ).toBe("blocked_missing_evidence");
    expect(
      getDeliveryReadiness({
        ticketReadiness: "ready_for_ticket_draft",
        evidenceState: "complete",
      })
    ).toBe("ready_for_operator_review");
  });

  it("keeps webhook requirements and iPaaS profiles source-backed", () => {
    expect(CASE_PACKET_WEBHOOK_REQUIREMENTS.map((item) => item.id)).toEqual([
      "signed_delivery",
      "idempotency_key",
      "retry_and_dead_letter",
      "privacy_review",
      "schema_versioning",
    ]);
    expect(IPAAS_CANDIDATE_PROFILES.map((item) => item.id)).toEqual([
      "power_automate",
      "zapier",
      "make",
      "direct_webhook",
    ]);
    for (const item of [...CASE_PACKET_WEBHOOK_REQUIREMENTS, ...IPAAS_CANDIDATE_PROFILES]) {
      expect(item.sourceIds.length).toBeGreaterThan(0);
    }
  });

  it("builds a stable ops schema preview without claiming delivery", () => {
    const preview = getCasePacketSchemaPreview();

    expect(preview.schemaVersion).toBe(CASE_PACKET_SCHEMA_VERSION);
    expect(preview.delivery).toEqual({
      readiness: "blocked_missing_evidence",
      sent: false,
      target: "not_configured",
    });
  });

  it("builds a current case export preview with delivery disabled", () => {
    const packet = buildPacket({
      evidenceState: "complete",
      deliveryReadiness: "ready_for_operator_review",
      dispatchGateConfirmed: ["Record moisture warning."],
    });
    const preview = getCasePacketExportPreview(packet);

    expect(preview.schemaVersion).toBe(CASE_PACKET_SCHEMA_VERSION);
    expect(preview.idempotencyKey).toBe("diagnostichub:4:1778234400000");
    expect(preview.delivery).toEqual({
      readiness: "ready_for_operator_review",
      sent: false,
      target: "not_configured",
    });
  });
});
