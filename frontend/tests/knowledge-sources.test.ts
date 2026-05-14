import { describe, expect, it } from "vitest";

import {
  getKnowledgeSourceIdsForCase,
  getTeachingGuidanceForProcedure,
  KNOWLEDGE_SOURCES,
} from "@/lib/knowledge-sources";
import { buildCasePacketFromSession } from "@/lib/triage-session";
import type { ProcedureSummary, TriageSession } from "@/lib/types";

const powerProcedure: ProcedureSummary = {
  id: 101,
  title: "Phone hot and not charging",
  category: "Power & Thermal",
  description: "Use this when heat, charger behavior, battery risk, or moisture warning appears.",
  outcome: "Power path complete.",
  warranty_status: "Depends on inspection.",
};

function buildSession(): TriageSession {
  return {
    query: "battery is hot and shows moisture warning",
    learningFamilyId: "power",
    learningFamilyTitle: "Power & Thermal",
    learningTrackTitle: "Charging safety",
    searchConfidence: 0.91,
    searchConfidenceState: "strong",
    searchConfidenceMargin: 0.33,
    searchNeedsReview: false,
    procedure: powerProcedure,
    currentNode: null,
    progress: { step: 3, total: 3 },
    customerCare: {
      greeting: "Start calm.",
      listening: "Listen first.",
      expectation: "Explain the next branch-safe check.",
    },
    sop: {
      immediate_action: "Stop unsafe charging checks.",
      explanation: "Separate accessory, port, heat, and battery signals.",
      related_actions: [],
    },
    outcome: {
      diagnosis: "Charging path needs service review.",
      recommended_action: "Do not keep charging the device at the branch.",
      decision_type: "repair_intake",
      decision_label: "Book repair intake",
      warranty_status: "Inspection required.",
      warranty_assessment: {
        direction: "needs_inspection",
        label: "Needs inspection",
        confidence: "medium",
        reasons: ["Battery safety needs inspection."],
      },
      branch_playbook: {
        title: "Prepare service handover",
        steps: ["Record heat, charger, and moisture evidence."],
      },
      related_actions: ["Capture customer wording."],
      evidence_checklist: ["No forced charging attempt was made."],
      customer_care: {
        greeting: "Start calm.",
        listening: "Listen first.",
        expectation: "Explain the next branch-safe check.",
      },
      follow_up_message: "Explain why safety stops come before charger swapping.",
    },
    related: [],
    history: [],
    dispatchGateConfirmed: [],
    updatedAt: "2026-05-13T10:00:00.000Z",
  };
}

describe("knowledge source registry", () => {
  it("keeps external source usage link-backed and paraphrase-only", () => {
    const externalSources = KNOWLEDGE_SOURCES.filter((source) => source.vendor !== "Watu");

    expect(externalSources.length).toBeGreaterThan(10);
    for (const source of externalSources) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.allowedUsage).toBe("paraphrase_and_link");
      expect(source.copyrightStatus).toBe("link_only_no_copying");
    }
  });

  it("returns Samsung and iPaaS teaching guidance for a case", () => {
    const guidance = getTeachingGuidanceForProcedure(
      powerProcedure,
      "power",
      "battery is hot and shows moisture warning"
    );
    const sourceIds = getKnowledgeSourceIdsForCase(
      powerProcedure,
      "power",
      "battery is hot and shows moisture warning"
    );

    expect(guidance.map((item) => item.id)).toContain("teach-battery-and-charging-safety");
    expect(sourceIds).toContain("samsung-battery-care");
    expect(sourceIds).toContain("make-webhooks");
    expect(sourceIds).toContain("webhook-best-practices");
  });

  it("adds source IDs to future ticket case packets", () => {
    const casePacket = buildCasePacketFromSession(buildSession());

    expect(casePacket.ticketReadiness).toBe("ready_for_ticket_draft");
    expect(casePacket.schemaVersion).toBe("diagnostichub.case_packet.v1");
    expect(casePacket.eventName).toBe("diagnostic.case.completed");
    expect(casePacket.idempotencyKey).toBe("diagnostichub:101:1778666400000");
    expect(casePacket.privacyClassification).toBe("contains_customer_free_text");
    expect(casePacket.evidenceState).toBe("pending");
    expect(casePacket.deliveryReadiness).toBe("blocked_missing_evidence");
    expect(casePacket.watuDecision.decisionLabel).toBe("Book repair intake");
    expect(casePacket.knowledgeSourceIds).toContain("samsung-moisture-port");
    expect(casePacket.knowledgeSourceIds).toContain("watu-sop-pack");
  });
});
