import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { uiCopy } from "@/lib/copy";
import type { SearchResponse, TriageSession, TriageStartResponse } from "@/lib/types";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  searchProcedures: vi.fn(),
  startTriage: vi.fn(),
  getRelated: vi.fn(),
  getCachedRepairFamilies: vi.fn(),
  clearCachedRepairFamilies: vi.fn(),
  getRepairFamilies: vi.fn(),
  getRepairFamilyDetail: vi.fn()
}));

const sessionMocks = vi.hoisted(() => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    replace: navigationMocks.replace,
    prefetch: navigationMocks.prefetch
  })
}));

vi.mock("@/lib/api", () => ({
  searchProcedures: apiMocks.searchProcedures,
  startTriage: apiMocks.startTriage,
  getRelated: apiMocks.getRelated,
  getCachedRepairFamilies: apiMocks.getCachedRepairFamilies,
  clearCachedRepairFamilies: apiMocks.clearCachedRepairFamilies,
  getRepairFamilies: apiMocks.getRepairFamilies,
  getRepairFamilyDetail: apiMocks.getRepairFamilyDetail
}));

vi.mock("@/lib/session", () => ({
  loadSession: sessionMocks.loadSession,
  saveSession: sessionMocks.saveSession,
  clearSession: sessionMocks.clearSession
}));

const searchResponse: SearchResponse = {
  query: "phone not turning on but vibrates",
  structured_intent: {
    issue_type: "Power",
    symptoms: ["phone", "vibrate"]
  },
  confidence: 0.89,
  confidence_state: "strong",
  confidence_margin: 0.42,
  needs_review: false,
  review_message: null,
  suggested_next_step: "Open guided triage for Phone Not Powering On.",
  best_match: {
    id: 1,
    title: "Phone Not Powering On",
    category: "Power",
    description: "Use this when a phone seems dead, does not start, or only vibrates.",
    outcome: "Power diagnosis complete.",
    warranty_status: "Depends on the final diagnosis."
  },
  alternatives: [],
  related: [],
  customer_care: {
    greeting: "Start with: 'I'll help you check this step by step.'",
    listening: "Let the customer finish the story before you ask the next question.",
    expectation: "Set expectation: 'We'll do a quick branch check first.'"
  },
  sop_preview: {
    immediate_action: "Confirm what the customer sees right now.",
    explanation: "This flow separates charger problems from deeper faults.",
    related_actions: ["Check the screen issue flow if the phone vibrates but stays dark."]
  },
  no_match: false,
  message: "Best match ready for guided triage."
};

const triageStartResponse: TriageStartResponse = {
  status: "question",
  procedure: searchResponse.best_match!,
  current_node: {
    id: 101,
    question: "Does the phone show any sign of life?"
  },
  progress: {
    step: 1,
    total: 3
  },
  customer_care: searchResponse.customer_care!,
  sop: searchResponse.sop_preview!,
  outcome: null
};

describe("HomePage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    sessionMocks.loadSession.mockReturnValue(null);
    apiMocks.searchProcedures.mockResolvedValue(searchResponse);
    apiMocks.startTriage.mockResolvedValue(triageStartResponse);
    apiMocks.getRelated.mockResolvedValue({
      procedure_id: 1,
      items: [
        {
          id: 2,
          title: "Screen Issue",
          category: "Screen",
          description: "Use this for cracked displays and black screens.",
          outcome: "Screen diagnosis complete.",
          warranty_status: "Depends on visible damage."
        }
      ]
    });
    apiMocks.getRepairFamilies.mockResolvedValue([
      {
        id: "display",
        title: "Display & Vision",
        hint: "Start here for cracked screens, black display, lines, blur, tint, or touch problems.",
        symptom_prompts: ["cracked screen"],
        procedure_count: 1
      }
    ]);
    apiMocks.getRepairFamilyDetail.mockResolvedValue({
      id: "display",
      title: "Display & Vision",
      hint: "Start here for cracked screens, black display, lines, blur, tint, or touch problems.",
      diagnostic_goal: "Separate visible damage, temporary display behaviour, and true internal screen faults before repair booking.",
      symptom_prompts: ["cracked screen"],
      focus_cards: [
        {
          title: "Visible damage first",
          description: "Separate cracks, pressure marks, and wet-impact history before anything else."
        }
      ],
      common_categories: [
        {
          title: "Cracks and visible panel damage",
          description: "Use this when the customer or officer can already see impact, broken glass, ink bleed, or pressure marks.",
          search_examples: ["cracked screen", "screen broken"],
          primary_procedure: {
            id: 2,
            title: "Screen Issue",
            category: "Screen",
            description: "Use this for cracked displays and black screens.",
            outcome: "Screen diagnosis complete.",
            warranty_status: "Depends on visible damage."
          },
          supporting_procedures: []
        }
      ],
      procedure_groups: [
        {
          title: "Core display route",
          description: "Keep the visible screen path primary unless the symptom is actually no-power or obvious physical damage first.",
          procedures: [
            {
              id: 2,
              title: "Screen Issue",
              category: "Screen",
              description: "Use this for cracked displays and black screens.",
              outcome: "Screen diagnosis complete.",
              warranty_status: "Depends on visible damage."
            }
          ]
        }
      ],
      branch_checks: [
        "Confirm whether cracks, pressure marks, or liquid traces are visible with the customer present."
      ],
      escalation_signals: [
        "Visible crack, ink bleed, or pressure damage changing the warranty direction."
      ],
      in_family_stream: {
        original_event_count: 6,
        deduplicated_event_count: 5,
        critical_entries: [
          {
            key: "display_path:escalation_signal:1",
            summary: "Visible crack, ink bleed, or pressure damage changing the warranty direction.",
            priority: "critical",
            source: "escalation_signal",
            signature: "display_path",
            signature_label: "Display path",
            occurrence_count: 1,
            first_seen_order: 1,
            related_procedures: [],
            technical_notes: []
          }
        ],
        need_to_know_entries: [
          {
            key: "display_path:branch_check:2",
            summary:
              "Confirm whether cracks, pressure marks, or liquid traces are visible with the customer present.",
            priority: "primary",
            source: "branch_check",
            signature: "display_path",
            signature_label: "Display path",
            occurrence_count: 1,
            first_seen_order: 2,
            related_procedures: [],
            technical_notes: []
          }
        ],
        nice_to_know_entries: [
          {
            key: "display_path:symptom_prompt:3",
            summary: "cracked screen",
            priority: "secondary",
            source: "symptom_prompt",
            signature: "display_path",
            signature_label: "Display path",
            occurrence_count: 1,
            first_seen_order: 3,
            related_procedures: [],
            technical_notes: ["Common customer wording to reuse in search."]
          }
        ],
        clusters: [
          {
            signature: "display_path",
            signature_label: "Display path",
            priority: "critical",
            total_occurrences: 2,
            entries: [
              {
                key: "display_path:escalation_signal:1",
                summary: "Visible crack, ink bleed, or pressure damage changing the warranty direction.",
                priority: "critical",
                source: "escalation_signal",
                signature: "display_path",
                signature_label: "Display path",
                occurrence_count: 1,
                first_seen_order: 1,
                related_procedures: [],
                technical_notes: []
              },
              {
                key: "display_path:branch_check:2",
                summary:
                  "Confirm whether cracks, pressure marks, or liquid traces are visible with the customer present.",
                priority: "primary",
                source: "branch_check",
                signature: "display_path",
                signature_label: "Display path",
                occurrence_count: 1,
                first_seen_order: 2,
                related_procedures: [],
                technical_notes: []
              }
            ]
          }
        ]
      },
      procedures: [
        {
          id: 2,
          title: "Screen Issue",
          category: "Screen",
          description: "Use this for cracked displays and black screens.",
          outcome: "Screen diagnosis complete.",
          warranty_status: "Depends on visible damage."
        }
      ]
    });
    apiMocks.getCachedRepairFamilies.mockReturnValue(null);
  });

  it("searches free text and starts the guided flow", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: uiCopy.home.hero.title })
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/phone is not turning on but it vibrates/i),
      "phone not turning on but vibrates"
    );
    await user.click(screen.getByRole("button", { name: /find the best flow/i }));

    expect(await screen.findByText("Phone Not Powering On")).toBeInTheDocument();
    expect(screen.getByText("Power")).toBeInTheDocument();
    await waitFor(() => {
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /start guided triage/i }));

    await waitFor(() => {
      expect(sessionMocks.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          procedure: expect.objectContaining({ title: "Phone Not Powering On" }),
          currentNode: expect.objectContaining({ id: 101 })
        })
      );
    });
    expect(navigationMocks.push).toHaveBeenCalledWith("/triage");
  });

  it("shows the saved session banner and can continue or clear it", async () => {
    const user = userEvent.setup();
    const savedSession: TriageSession = {
      query: "screen flickering",
      procedure: {
        id: 2,
        title: "Screen Issue",
        category: "Screen",
        description: "Use this for cracked displays and black screens.",
        outcome: "Screen diagnosis complete.",
        warranty_status: "Depends on visible damage."
      },
      currentNode: {
        id: 201,
        question: "Is the screen cracked?"
      },
      searchConfidence: null,
      searchConfidenceState: null,
      searchConfidenceMargin: null,
      searchNeedsReview: false,
      progress: {
        step: 1,
        total: 3
      },
      customerCare: searchResponse.customer_care!,
      sop: searchResponse.sop_preview!,
      outcome: null,
      related: [],
      history: [],
      updatedAt: "2026-04-24T10:00:00.000Z"
    };
    sessionMocks.loadSession.mockReturnValue(savedSession);

    render(<HomePage />);

    expect(await screen.findByText(/screen issue saved on this device/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue saved case/i }));
    expect(navigationMocks.push).toHaveBeenCalledWith("/triage");

    await user.click(screen.getByRole("button", { name: /clear saved case/i }));
    expect(sessionMocks.clearSession).toHaveBeenCalled();
  });

  it("opens a family workspace with grouped diagnostic routes", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(await screen.findByRole("button", { name: /display & vision/i }));
    expect(await screen.findByRole("heading", { name: "Display & Vision" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open full family workspace/i }));

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    expect(await screen.findByRole("heading", { name: "Display & Vision" })).toBeInTheDocument();
    expect(screen.getByText("Cracks and visible panel damage")).toBeInTheDocument();
    expect(screen.getByText(/What officers may search for/i)).toBeInTheDocument();
    expect(screen.getByText(/Escalate faster when you see this/i)).toBeInTheDocument();
  });

  it("shows built-in family cards when the family endpoint fails", async () => {
    apiMocks.getRepairFamilies.mockRejectedValueOnce(new Error("Could not load family data."));
    render(<HomePage />);

    expect(await screen.findByRole("button", { name: /display & vision/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /power & thermal/i })).toBeInTheDocument();
    expect(await screen.findByText(/showing backup family guide/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("falls back instead of leaving visual families in an infinite skeleton state", async () => {
    vi.useFakeTimers();
    apiMocks.getRepairFamilies.mockReturnValue(new Promise(() => undefined));

    render(<HomePage />);

    expect(screen.getByRole("button", { name: /display & vision/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/loading visual families/i)).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(4600);
    });

    expect(screen.getByRole("button", { name: /display & vision/i })).toBeInTheDocument();
    expect(screen.getByText(/showing backup family guide/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders cached visual families immediately when the live endpoint is slow", async () => {
    apiMocks.getCachedRepairFamilies.mockReturnValue([
      {
        id: "display",
        title: "Display & Vision",
        hint: "Start here for visible display symptoms.",
        symptom_prompts: ["screen cracked"],
        procedure_count: 3
      }
    ]);
    apiMocks.getRepairFamilies.mockReturnValue(new Promise(() => undefined));

    render(<HomePage />);

    expect(await screen.findByRole("button", { name: /display & vision/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/loading visual families/i)).not.toBeInTheDocument();
  });

  it("merges a partial live family response with the built-in family asset set", async () => {
    apiMocks.getRepairFamilies.mockResolvedValueOnce([
      {
        id: "display",
        title: "Display & Vision",
        hint: "Live display family data.",
        symptom_prompts: ["black screen"],
        procedure_count: 7
      }
    ]);

    render(<HomePage />);

    expect(await screen.findByRole("button", { name: /display & vision/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("7 flows")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /power & thermal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /physical & liquid/i })).toBeInTheDocument();
  });

  it("shows categorized fuzzy suggestions and allows keyboard selection with Enter", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/phone is not turning on but it vibrates/i);
    await user.type(input, "knox gaurd");
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByText("Hardware Errors")).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /knox guard.*managed device/i })
      ).toBeInTheDocument();
    }, { timeout: 3000 });

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(apiMocks.searchProcedures).toHaveBeenCalledWith(
        expect.stringContaining("knox guard"),
        expect.anything()
      );
    });
  });

  it("clears the enhanced search input with the clear button", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/phone is not turning on but it vibrates/i);
    await user.type(input, "screen issue");
    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("opens a confidence gate for ambiguous matches before triage start", async () => {
    const user = userEvent.setup();
    apiMocks.searchProcedures.mockResolvedValueOnce({
      ...searchResponse,
      confidence_state: "caution",
      needs_review: true,
      confidence_margin: 0.08,
      review_message: "Closest match is tight. Confirm the route first.",
      alternatives: [
        {
          id: 2,
          title: "Screen Issue",
          category: "Screen",
          description: "Use this for cracked displays and black screens.",
          outcome: "Screen diagnosis complete.",
          warranty_status: "Depends on visible damage."
        }
      ]
    });

    render(<HomePage />);

    await user.type(
      screen.getByPlaceholderText(/phone is not turning on but it vibrates/i),
      "phone not turning on but vibrates"
    );
    await user.click(screen.getByRole("button", { name: /find the best flow/i }));
    await screen.findByText("Phone Not Powering On");

    await user.click(screen.getByRole("button", { name: /start guided triage/i }));
    expect(await screen.findByText(/pick the closest route before triage/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Screen Issue" }));
    await user.click(screen.getByRole("button", { name: /continue with selected flow/i }));

    await waitFor(() => {
      expect(apiMocks.startTriage).toHaveBeenCalledWith(2);
    });
  });

  it("offers a recovery family action when search has no match", async () => {
    const user = userEvent.setup();
    apiMocks.searchProcedures.mockResolvedValueOnce({
      ...searchResponse,
      no_match: true,
      best_match: null,
      alternatives: [],
      related: [],
      message: "I could not find a confident match yet.",
      structured_intent: {
        issue_type: "Display & Vision",
        symptoms: []
      }
    });

    render(<HomePage />);

    await user.type(
      screen.getByPlaceholderText(/phone is not turning on but it vibrates/i),
      "my screen has weird lines"
    );
    await user.click(screen.getByRole("button", { name: /find the best flow/i }));

    const openFamily = await screen.findByRole("button", { name: /^open display & vision$/i });
    await user.click(openFamily);

    await waitFor(() => {
      expect(apiMocks.getRepairFamilyDetail).toHaveBeenCalledWith("display");
    });
  });
});
