import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { uiCopy } from "@/lib/copy";
import type { SearchResponse, TriageSession, TriageStartResponse } from "@/lib/types";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  searchParams: new URLSearchParams()
}));

const apiMocks = vi.hoisted(() => ({
  searchProcedures: vi.fn(),
  startTriage: vi.fn(),
  getRelated: vi.fn(),
  getCachedRepairFamilies: vi.fn(),
  clearCachedRepairFamilies: vi.fn(),
  getRepairFamilies: vi.fn(),
  getRepairFamilyDetail: vi.fn(),
  getRepairFamilyLearningModule: vi.fn(),
  recordInteractionTelemetry: vi.fn()
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
  }),
  useSearchParams: () => ({
    get: (key: string) => navigationMocks.searchParams.get(key)
  })
}));

vi.mock("@/lib/api", () => ({
  searchProcedures: apiMocks.searchProcedures,
  startTriage: apiMocks.startTriage,
  getRelated: apiMocks.getRelated,
  getCachedRepairFamilies: apiMocks.getCachedRepairFamilies,
  clearCachedRepairFamilies: apiMocks.clearCachedRepairFamilies,
  getRepairFamilies: apiMocks.getRepairFamilies,
  getRepairFamilyDetail: apiMocks.getRepairFamilyDetail,
  getRepairFamilyLearningModule: apiMocks.getRepairFamilyLearningModule,
  recordInteractionTelemetry: apiMocks.recordInteractionTelemetry
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
    navigationMocks.searchParams = new URLSearchParams();
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
    apiMocks.getRepairFamilyLearningModule.mockResolvedValue({
      id: "display",
      title: "Display & Vision",
      hint: "Start here for cracked screens, black display, lines, blur, tint, or touch problems.",
      diagnostic_goal:
        "Separate visible damage, temporary display behaviour, and true internal screen faults before repair booking.",
      symptom_prompts: ["cracked screen"],
      tracks: [
        {
          procedure: {
            id: 2,
            title: "Screen Issue",
            category: "Screen",
            description: "Use this for cracked displays and black screens.",
            outcome: "Screen diagnosis complete.",
            warranty_status: "Depends on visible damage."
          },
          track_title: "Cracks and visible panel damage",
          track_summary:
            "Use this when the customer or officer can already see impact, broken glass, ink bleed, or pressure marks.",
          first_question: "Is there visible crack or panel damage?",
          guided_steps: 4,
          related_suggestions: []
        }
      ]
    });
    apiMocks.getCachedRepairFamilies.mockReturnValue(null);
    apiMocks.recordInteractionTelemetry.mockResolvedValue({ accepted: true });
  });

  it("searches free text and starts the guided flow", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: uiCopy.home.hero.title })
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/e\.g\. phone won't turn on but vibrates when i hold power/i),
      "phone not turning on but vibrates"
    );
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Phone Not Powering On")).toBeInTheDocument();
    expect(screen.getByText("Power")).toBeInTheDocument();

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

  it("wires diagnosis output selector into the search request payload", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: "SOP action" }));
    await user.type(
      screen.getByPlaceholderText(/e\.g\. phone won't turn on but vibrates when i hold power/i),
      "phone not turning on but vibrates"
    );
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(apiMocks.searchProcedures).toHaveBeenCalledWith(
        "phone not turning on but vibrates",
        expect.objectContaining({ outputMode: "sop_action" })
      );
    });
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

  it("routes family selection through the top Families menu", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: /^families$/i }));
    await user.click(await screen.findByRole("button", { name: /open display & vision diagnosis family/i }));

    expect(navigationMocks.push).toHaveBeenCalledWith("/families/display");
    await waitFor(() => {
      expect(screen.queryByLabelText(/find family/i)).not.toBeInTheDocument();
    });
  });

  it("closes the family menu with one outside tap", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: /^families$/i }));
    expect(await screen.findByLabelText(/find family/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /open display & vision diagnosis family/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("heading", { name: /diag & troubleshooting hub/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/find family/i)).not.toBeInTheDocument();
    });
  });

  it("closes topbar dropdowns when switching menus or tapping the workspace", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: /^families$/i }));
    expect(await screen.findByLabelText(/find family/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^utilities$/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/find family/i)).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("menuitem", { name: /master queries/i })).toBeInTheDocument();

    await user.click(screen.getByRole("heading", { name: /diag & troubleshooting hub/i }));

    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: /master queries/i })).not.toBeInTheDocument();
    });
  });

  it("keeps the family router stable even when a family arrives without symptom prompts", async () => {
    const user = userEvent.setup();
    apiMocks.getRepairFamilies.mockResolvedValueOnce([
      {
        id: "custom-family",
        title: "Custom Family",
        hint: "Custom family hint.",
        symptom_prompts: undefined as unknown as string[],
        procedure_count: 1,
      }
    ]);
    apiMocks.getRepairFamilyDetail.mockResolvedValueOnce({
      id: "custom-family",
      title: "Custom Family",
      hint: "Custom family hint.",
      diagnostic_goal: "Use this family when custom issues are observed.",
      symptom_prompts: [],
      focus_cards: [],
      common_categories: [],
      procedure_groups: [],
      branch_checks: [],
      escalation_signals: [],
      in_family_stream: {
        original_event_count: 0,
        deduplicated_event_count: 0,
        critical_entries: [],
        need_to_know_entries: [],
        nice_to_know_entries: [],
        clusters: [],
      },
      procedures: []
    });
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: /^families$/i }));
    await user.click(await screen.findByRole("button", { name: /open custom family diagnosis family/i }));

    expect(navigationMocks.push).toHaveBeenCalledWith("/families/custom-family");
  });

  it("shows built-in family cards when the family endpoint fails", async () => {
    apiMocks.getRepairFamilies.mockRejectedValueOnce(new Error("Could not load family data."));
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: /^families$/i }));
    expect(await screen.findByRole("button", { name: /open display & vision diagnosis family/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open power & thermal diagnosis family/i })).toBeInTheDocument();
    expect(await screen.findByText(/showing backup family guide/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("falls back instead of leaving visual families in an infinite skeleton state", async () => {
    vi.useFakeTimers();
    apiMocks.getRepairFamilies.mockReturnValue(new Promise(() => undefined));

    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: /^families$/i }));
    expect(screen.getByRole("button", { name: /open display & vision diagnosis family/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/loading visual families/i)).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(4600);
    });

    expect(screen.getByRole("button", { name: /open display & vision diagnosis family/i })).toBeInTheDocument();
    expect(screen.getByText(/showing backup family guide/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders cached visual families immediately when the live endpoint is slow", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: /^families$/i }));
    expect(await screen.findByRole("button", { name: /open display & vision diagnosis family/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/loading visual families/i)).not.toBeInTheDocument();
  });

  it("merges a partial live family response with the built-in family asset set", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: /^families$/i }));
    expect(await screen.findByRole("button", { name: /open display & vision diagnosis family/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("7 flows")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /open power & thermal diagnosis family/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open physical & liquid diagnosis family/i })).toBeInTheDocument();
  });

  it("shows categorized fuzzy suggestions and allows keyboard selection with Enter", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/e\.g\. phone won't turn on but vibrates when i hold power/i);
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

    const input = screen.getByPlaceholderText(/e\.g\. phone won't turn on but vibrates when i hold power/i);
    await user.type(input, "screen issue");
    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps the command palette action list free of unavailable duplicate starts", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByLabelText(/global search/i));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use diagnosis input/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start best-match triage/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /use diagnosis input/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText(/e\.g\. phone won't turn on but vibrates when i hold power/i)
    ).toHaveFocus();
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
      screen.getByPlaceholderText(/e\.g\. phone won't turn on but vibrates when i hold power/i),
      "phone not turning on but vibrates"
    );
    await user.keyboard("{Enter}");
    await screen.findByText("Phone Not Powering On");

    await user.click(screen.getByRole("button", { name: /start guided triage/i }));
    expect(await screen.findByText(/pick the closest route before triage/i)).toBeInTheDocument();
    expect(apiMocks.recordInteractionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "confidence_gate_shown",
        status: "review"
      })
    );

    await user.click(screen.getByRole("button", { name: "Screen Issue" }));
    expect(apiMocks.recordInteractionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "confidence_gate_option_selected",
        status: "review"
      })
    );
    await user.click(screen.getByRole("button", { name: /continue with selected flow/i }));

    await waitFor(() => {
      expect(apiMocks.startTriage).toHaveBeenCalledWith(2);
    });
    expect(apiMocks.recordInteractionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "confidence_gate_confirmed",
        status: "success"
      })
    );
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
      screen.getByPlaceholderText(/e\.g\. phone won't turn on but vibrates when i hold power/i),
      "my screen has weird lines"
    );
    await user.keyboard("{Enter}");

    const openFamily = await screen.findByRole("button", { name: /^open display & vision$/i });
    await user.click(openFamily);

    await waitFor(() => {
      expect(apiMocks.getRepairFamilyDetail).toHaveBeenCalledWith("display");
    });
    expect(apiMocks.recordInteractionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "no_match_recovery_family_opened",
        status: "review"
      })
    );
  });
});
