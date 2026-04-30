import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InsightsPage from "@/app/insights/page";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  getOpsFeedbackExportUrl: vi.fn(),
  getOpsFeedbackLanguageExportUrl: vi.fn(),
  getOpsFeedbackLanguageCandidates: vi.fn(),
  getOpsFeedbackSummary: vi.fn(),
  getOpsFeedbackByProcedure: vi.fn(),
  getOpsFeedbackByBranch: vi.fn(),
  getOpsFeedbackByTag: vi.fn(),
  getOpsTelemetrySummary: vi.fn(),
  getOpsSession: vi.fn(),
  logoutOps: vi.fn(),
  ApiError: class extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    replace: navigationMocks.replace
  })
}));

vi.mock("@/lib/api", () => ({
  ApiError: apiMocks.ApiError,
  getOpsFeedbackExportUrl: apiMocks.getOpsFeedbackExportUrl,
  getOpsFeedbackLanguageExportUrl: apiMocks.getOpsFeedbackLanguageExportUrl,
  getOpsFeedbackSummary: apiMocks.getOpsFeedbackSummary,
  getOpsFeedbackLanguageCandidates: apiMocks.getOpsFeedbackLanguageCandidates,
  getOpsFeedbackByProcedure: apiMocks.getOpsFeedbackByProcedure,
  getOpsFeedbackByBranch: apiMocks.getOpsFeedbackByBranch,
  getOpsFeedbackByTag: apiMocks.getOpsFeedbackByTag,
  getOpsTelemetrySummary: apiMocks.getOpsTelemetrySummary,
  getOpsSession: apiMocks.getOpsSession,
  logoutOps: apiMocks.logoutOps
}));

describe("InsightsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getOpsSession.mockResolvedValue({
      authenticated: true,
      expires_at: "2026-04-27T18:00:00.000Z"
    });
    apiMocks.getOpsFeedbackExportUrl.mockReturnValue(
      "http://localhost:8000/feedback/export.csv?days=30"
    );
    apiMocks.getOpsFeedbackLanguageExportUrl.mockReturnValue(
      "http://localhost:8000/feedback/language-candidates/export.csv?days=30&limit=50"
    );
    apiMocks.getOpsFeedbackSummary.mockResolvedValue({
      total_submissions: 6,
      helpful_count: 4,
      not_helpful_count: 2,
      latest_submissions: [
        {
          id: 1,
          helpful: false,
          procedure_id: 2,
          branch_label: "Jinja",
          comment: "Screen path needs a clearer branch.",
          outcome_diagnosis: "An internal display fault is likely.",
          feedback_tags: ["confusing_question"],
          final_decision_label: "Book repair intake",
          triage_trace: [],
          created_at: "2026-04-27T08:00:00.000Z"
        }
      ]
    });
    apiMocks.getOpsFeedbackByProcedure.mockResolvedValue({
      days: 30,
      items: [
        {
          procedure_id: 1,
          procedure_title: "Phone Not Powering On",
          total_submissions: 4,
          helpful_count: 3,
          not_helpful_count: 1
        }
      ]
    });
    apiMocks.getOpsFeedbackByBranch.mockResolvedValue({
      days: 30,
      items: [
        {
          branch_label: "Kampala Central",
          total_submissions: 3,
          helpful_count: 2,
          not_helpful_count: 1
        }
      ]
    });
    apiMocks.getOpsFeedbackByTag.mockResolvedValue({
      days: 30,
      items: [
        {
          tag: "confusing_question",
          total_submissions: 2,
          helpful_count: 0,
          not_helpful_count: 2
        }
      ]
    });
    apiMocks.getOpsFeedbackLanguageCandidates.mockResolvedValue({
      days: 30,
      items: [
        {
          normalized_query: "phone not charging when i insert a charger",
          sample_query: "the phone is not charging when i insert a charger",
          total_mentions: 3,
          helpful_count: 2,
          not_helpful_count: 1,
          latest_procedure_title: "Charging Issue",
          latest_branch_label: "Kampala Central",
          latest_created_at: "2026-04-27T08:30:00.000Z"
        }
      ]
    });
    apiMocks.getOpsTelemetrySummary.mockResolvedValue({
      generated_at: "2026-04-27T09:00:00.000Z",
      uptime_seconds: 3600,
      total_http_requests: 400,
      active_endpoints: 8,
      search: {
        total_searches: 40,
        no_match_count: 6,
        review_required_count: 10,
        top_issue_types: { "Power & Thermal": 12 },
        confidence_states: { strong: 20, caution: 14, weak: 6 },
        ambiguity_risk_counts: { medium: 7, high: 3 }
      },
      interaction: {
        total_events: 24,
        event_counts: {
          confidence_gate_shown: 10,
          confidence_gate_confirmed: 8,
          best_match_direct_started: 11,
          no_match_recovery_family_opened: 3,
          no_match_recovery_prompt_used: 2
        }
      }
    });
    apiMocks.logoutOps.mockResolvedValue({
      authenticated: false,
      message: "Ops session cleared."
    });
  });

  it("loads and displays ops insight summaries after a valid session check", async () => {
    render(<InsightsPage />);

    expect(await screen.findByText("Feedback summary")).toBeInTheDocument();
    expect((await screen.findAllByText("Phone Not Powering On")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Kampala Central")).length).toBeGreaterThan(0);
    expect(screen.getByText("Screen path needs a clearer branch.")).toBeInTheDocument();
    expect(screen.getAllByText("Confusing question").length).toBeGreaterThan(0);
    expect(screen.getByText("the phone is not charging when i insert a charger")).toBeInTheDocument();
    expect(screen.getByText("Search-to-triage quality signals")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /export csv/i })).toHaveAttribute(
      "href",
      "http://localhost:8000/feedback/export.csv?days=30"
    );
    expect(screen.getByRole("link", { name: /export phrase review csv/i })).toHaveAttribute(
      "href",
      "http://localhost:8000/feedback/language-candidates/export.csv?days=30&limit=50"
    );
  });

  it("redirects to ops login when no valid session exists", async () => {
    apiMocks.getOpsSession.mockResolvedValue({
      authenticated: false
    });

    render(<InsightsPage />);

    await waitFor(() => {
      expect(navigationMocks.replace).toHaveBeenCalledWith("/ops/login");
    });
  });

  it("reloads the page data when the date range changes", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);

    await screen.findByText("Feedback summary");
    await user.click(screen.getByRole("button", { name: /last 7 days/i }));

    await waitFor(() => {
      expect(apiMocks.getOpsFeedbackSummary).toHaveBeenCalledWith(7);
      expect(apiMocks.getOpsFeedbackByProcedure).toHaveBeenCalledWith(7);
      expect(apiMocks.getOpsFeedbackByBranch).toHaveBeenCalledWith(7);
      expect(apiMocks.getOpsFeedbackLanguageCandidates).toHaveBeenCalledWith(7);
      expect(apiMocks.getOpsFeedbackByTag).toHaveBeenCalledWith(7);
      expect(apiMocks.getOpsTelemetrySummary).toHaveBeenCalled();
    });
  });

  it("signs out and returns the user to ops login", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);

    await screen.findByText("Feedback summary");
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(apiMocks.logoutOps).toHaveBeenCalled();
      expect(navigationMocks.replace).toHaveBeenCalledWith("/ops/login");
    });
  });
});
