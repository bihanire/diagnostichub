import { describe, expect, it } from "vitest";

import {
  FAMILY_LESSON_CARDS,
  getContentHealthSignals,
  getDecisionTeachingNotesForProcedure,
  getFamilyLessonCards,
} from "@/lib/learning-quality";
import type {
  FeedbackSummaryResponse,
  OpsTelemetrySummaryResponse,
  ProcedureFeedbackBreakdownResponse,
  ProcedureSummary,
} from "@/lib/types";

const securityProcedure: ProcedureSummary = {
  id: 11,
  title: "FRP, Password, or Locked Device",
  category: "Security & Access",
  description: "Use this for Google lock, forgotten pattern, password, managed lock, or FRP cases.",
  outcome: "Access path complete.",
  warranty_status: "Depends on ownership verification.",
};

describe("learning quality guidance", () => {
  it("has a source-backed lesson card for each core family", () => {
    const familyIds = new Set(FAMILY_LESSON_CARDS.map((card) => card.familyId));

    expect([...familyIds].sort()).toEqual([
      "connectivity",
      "display",
      "logic",
      "physical",
      "power",
      "security",
    ]);

    for (const card of FAMILY_LESSON_CARDS) {
      expect(card.firstLook.length).toBeGreaterThanOrEqual(3);
      expect(card.modelCaveats.length).toBeGreaterThanOrEqual(2);
      expect(card.localPhrases.length).toBeGreaterThanOrEqual(3);
      expect(card.sourceIds).toContain("watu-sop-pack");
    }
  });

  it("returns the relevant family lesson without leaking other families", () => {
    const powerCards = getFamilyLessonCards("power");

    expect(powerCards).toHaveLength(1);
    expect(powerCards[0].title).toMatch(/battery and charging/i);
  });

  it("teaches reset and managed-device risk for security cases", () => {
    const notes = getDecisionTeachingNotesForProcedure(
      securityProcedure,
      "factory reset done and now it wants old google account on a shell managed phone",
      3
    );
    const ids = notes.map((note) => note.id);

    expect(ids).toContain("decision-reset-risk");
    expect(ids).toContain("decision-managed-device");
    expect(ids).toContain("decision-handover-readiness");
  });

  it("flags low-helpfulness and search recovery content health risks", () => {
    const summary: FeedbackSummaryResponse = {
      total_submissions: 10,
      helpful_count: 5,
      not_helpful_count: 5,
      latest_submissions: [],
    };
    const procedureBreakdown: ProcedureFeedbackBreakdownResponse = {
      days: 30,
      items: [
        {
          procedure_id: 7,
          procedure_title: "Freezing, Hanging, or App Issue",
          total_submissions: 5,
          helpful_count: 2,
          not_helpful_count: 3,
        },
      ],
    };
    const telemetrySummary: OpsTelemetrySummaryResponse = {
      generated_at: "2026-05-14T00:00:00.000Z",
      uptime_seconds: 100,
      total_http_requests: 100,
      active_endpoints: 10,
      search: {
        total_searches: 10,
        no_match_count: 2,
        review_required_count: 1,
        top_issue_types: {},
        confidence_states: {},
        ambiguity_risk_counts: {},
      },
      interaction: {
        total_events: 8,
        event_counts: {
          no_match_recovery_family_opened: 2,
          no_match_recovery_prompt_used: 1,
          confidence_gate_shown: 4,
          confidence_gate_confirmed: 1,
        },
      },
    };

    const signals = getContentHealthSignals({ procedureBreakdown, summary, telemetrySummary });

    expect(signals.find((signal) => signal.id === "helpful-rate")?.level).toBe("risk");
    expect(signals.find((signal) => signal.id === "top-needs-work")?.level).toBe("risk");
    expect(signals.find((signal) => signal.id === "no-match-recovery-rate")?.level).toBe("risk");
    expect(signals.find((signal) => signal.id === "confidence-confirm-rate")?.level).toBe("risk");
  });
});
