import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TriagePage from "@/app/triage/page";
import type { TriageNextResponse, TriageSession } from "@/lib/types";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  nextTriage: vi.fn()
}));

const sessionMocks = vi.hoisted(() => ({
  loadSession: vi.fn(),
  saveSession: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    replace: navigationMocks.replace,
    prefetch: navigationMocks.prefetch
  })
}));

vi.mock("@/lib/api", () => ({
  nextTriage: apiMocks.nextTriage
}));

vi.mock("@/lib/session", () => ({
  loadSession: sessionMocks.loadSession,
  saveSession: sessionMocks.saveSession
}));

const activeSession: TriageSession = {
  query: "phone not turning on but vibrates",
  searchConfidence: 0.89,
  searchConfidenceState: "strong",
  searchConfidenceMargin: 0.42,
  searchNeedsReview: false,
  procedure: {
    id: 1,
    title: "Phone Not Powering On",
    category: "Power",
    description: "Use this when a phone seems dead, does not start, or only vibrates.",
    outcome: "Power diagnosis complete.",
    warranty_status: "Depends on the final diagnosis."
  },
  currentNode: {
    id: 101,
    question: "Does the phone show any sign of life?"
  },
  progress: {
    step: 1,
    total: 3
  },
  customerCare: {
    greeting: "Start with: 'I'll help you check this step by step.'",
    listening: "Let the customer finish the story before you ask the next question.",
    expectation: "Set expectation: 'We'll do a quick branch check first.'"
  },
  sop: {
    immediate_action: "Confirm what the customer sees right now.",
    explanation: "This flow separates charger problems from deeper faults.",
    related_actions: []
  },
  outcome: null,
  related: [],
  history: [],
  updatedAt: "2026-04-24T10:00:00.000Z"
};

const finalOutcome = {
  diagnosis: "The phone is receiving power but the display path may be damaged.",
  recommended_action: "Move the customer to the screen issue procedure.",
  decision_type: "repair_intake",
  decision_label: "Book repair intake",
  warranty_status: "Cracks are usually not covered.",
  warranty_assessment: {
    direction: "needs_inspection",
    label: "Needs inspection",
    confidence: "medium",
    reasons: ["Final warranty confirmation depends on repair inspection."]
  },
  branch_playbook: {
    title: "Prepare a clean repair-intake handover",
    steps: [
      "Finish the evidence checklist before the phone leaves the desk.",
      "Explain the likely repair path without promising final warranty approval too early."
    ]
  },
  related_actions: ["Check for visible impact marks."],
  evidence_checklist: [
    "Confirm a known-good charger and cable were tested.",
    "Record whether a forced restart was attempted and what happened."
  ],
  customer_care: activeSession.customerCare,
  follow_up_message: "Explain that the next check focuses on the display side."
};

describe("TriagePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.loadSession.mockReturnValue(activeSession);
  });

  it("answers a question, saves the updated session, and navigates to the result page", async () => {
    const user = userEvent.setup();
    const finalResponse: TriageNextResponse = {
      status: "complete",
      progress: {
        step: 3,
        total: 3
      },
      next_node: null,
      outcome: finalOutcome,
      related: [
        {
          id: 2,
          title: "Screen Issue",
          category: "Screen",
          description: "Use this for cracked displays and black screens.",
          outcome: "Screen diagnosis complete.",
          warranty_status: "Depends on visible damage."
        }
      ],
      message: "Final recommendation ready."
    };
    apiMocks.nextTriage.mockResolvedValue(finalResponse);

    render(<TriagePage />);

    expect(await screen.findByText(/does the phone show any sign of life/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /yes, confirmed/i }));

    await waitFor(() => {
      expect(sessionMocks.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: expect.objectContaining({
            diagnosis: "The phone is receiving power but the display path may be damaged."
          }),
          progress: { step: 3, total: 3 }
        })
      );
    });
    expect(navigationMocks.push).toHaveBeenCalledWith("/result");
  });

  it("keeps Yes/No logic stable when the backend omits related procedures", async () => {
    const user = userEvent.setup();
    const existingRelated = [
      {
        id: 2,
        title: "Screen Issue",
        category: "Screen",
        description: "Use this for cracked displays and black screens.",
        outcome: "Screen diagnosis complete.",
        warranty_status: "Depends on visible damage."
      }
    ];
    sessionMocks.loadSession.mockReturnValue({
      ...activeSession,
      related: existingRelated
    });
    apiMocks.nextTriage.mockResolvedValue({
      status: "complete",
      progress: {
        step: 3,
        total: 3
      },
      next_node: null,
      outcome: finalOutcome,
      message: "Final recommendation ready."
    } as unknown as TriageNextResponse);

    render(<TriagePage />);

    await user.click(await screen.findByRole("button", { name: /yes, confirmed/i }));

    await waitFor(() => {
      expect(sessionMocks.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          related: existingRelated,
          outcome: expect.objectContaining({ diagnosis: finalOutcome.diagnosis })
        })
      );
    });
  });

  it("shows an error instead of advancing when a next question response is incomplete", async () => {
    const user = userEvent.setup();
    apiMocks.nextTriage.mockResolvedValue({
      status: "question",
      progress: {
        step: 2,
        total: 3
      },
      next_node: null,
      related: []
    } as unknown as TriageNextResponse);

    render(<TriagePage />);

    await user.click(await screen.findByRole("button", { name: /yes, confirmed/i }));

    expect(
      await screen.findByText(/next diagnosis step came back incomplete/i)
    ).toBeInTheDocument();
    expect(sessionMocks.saveSession).not.toHaveBeenCalled();
    expect(navigationMocks.push).not.toHaveBeenCalledWith("/result");
  });

  it("shows the missing-node fallback when saved session data has no usable question", async () => {
    sessionMocks.loadSession.mockReturnValue({
      ...activeSession,
      currentNode: {
        id: Number.NaN,
        question: ""
      }
    });

    render(<TriagePage />);

    expect(await screen.findByText(/next question is missing/i)).toBeInTheDocument();
  });

  it("shows a fallback prompt when there is no saved session", async () => {
    sessionMocks.loadSession.mockReturnValue(null);

    render(<TriagePage />);

    expect(await screen.findByText(/assessment not ready/i)).toBeInTheDocument();
    expect(screen.getByText(/go back to the search screen to start a new case/i)).toBeInTheDocument();
  });
});
