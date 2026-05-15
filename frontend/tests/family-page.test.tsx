import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FamilyLandingPage from "@/app/families/[slug]/page";
import type {
  RepairFamilyDetail,
  RepairFamilyLearningModule,
  TriageStartResponse,
} from "@/lib/types";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  getRepairFamilyDetail: vi.fn(),
  getRepairFamilyLearningModule: vi.fn(),
  getRelated: vi.fn(),
  startTriage: vi.fn(),
  ApiError: class extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const sessionMocks = vi.hoisted(() => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "power" }),
  useRouter: () => ({
    push: navigationMocks.push,
    replace: navigationMocks.replace,
    prefetch: navigationMocks.prefetch,
  }),
}));

vi.mock("@/lib/api", () => ({
  ApiError: apiMocks.ApiError,
  getRepairFamilyDetail: apiMocks.getRepairFamilyDetail,
  getRepairFamilyLearningModule: apiMocks.getRepairFamilyLearningModule,
  getRelated: apiMocks.getRelated,
  startTriage: apiMocks.startTriage,
}));

vi.mock("@/lib/session", () => ({
  loadSession: sessionMocks.loadSession,
  saveSession: sessionMocks.saveSession,
}));

const chargingProcedure = {
  id: 4,
  title: "Charging Issue",
  category: "Power & Thermal",
  description: "Use this when charger, port, battery, or moisture behavior is reported.",
  outcome: "Charging path complete.",
  warranty_status: "Inspection may be needed.",
};

const familyDetail: RepairFamilyDetail = {
  id: "power",
  title: "Power & Thermal",
  hint: "No power, charging, battery, and heat issues.",
  diagnostic_goal: "Separate branch-safe power checks from repair-intake power faults.",
  symptom_prompts: ["not charging", "phone hot"],
  focus_cards: [],
  common_categories: [
    {
      title: "Charging safety",
      description: "Moisture, heat, charger, and port checks before repair movement.",
      search_examples: ["moisture warning", "not charging"],
      primary_procedure: chargingProcedure,
      supporting_procedures: [],
    },
  ],
  procedure_groups: [],
  branch_checks: ["Use a known-good charger only when safe."],
  escalation_signals: ["Swelling, heat, burnt smell, or moisture warning."],
  in_family_stream: {
    original_event_count: 0,
    deduplicated_event_count: 0,
    critical_entries: [],
    need_to_know_entries: [],
    nice_to_know_entries: [],
    clusters: [],
  },
  procedures: [chargingProcedure],
};

const learningModule: RepairFamilyLearningModule = {
  id: "power",
  title: "Power & Thermal",
  hint: familyDetail.hint,
  diagnostic_goal: familyDetail.diagnostic_goal,
  symptom_prompts: familyDetail.symptom_prompts,
  tracks: [
    {
      procedure: chargingProcedure,
      track_title: "Charging safety",
      track_summary: "Choose this when charging behavior may involve heat or moisture.",
      first_question: "Does the device show a moisture warning?",
      guided_steps: 3,
      related_suggestions: [],
    },
  ],
};

const triageStartResponse: TriageStartResponse = {
  status: "question",
  procedure: chargingProcedure,
  current_node: {
    id: 401,
    question: "Does the phone show a moisture warning?",
  },
  progress: {
    step: 1,
    total: 3,
  },
  customer_care: {
    greeting: "Start calm.",
    listening: "Listen for charging details.",
    expectation: "Explain the next safe check.",
  },
  sop: {
    immediate_action: "Stop unsafe charging checks.",
    explanation: "Separate charger, port, heat, and moisture evidence.",
    related_actions: [],
  },
  outcome: null,
};

describe("FamilyLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getRepairFamilyDetail.mockResolvedValue(familyDetail);
    apiMocks.getRepairFamilyLearningModule.mockResolvedValue(learningModule);
    apiMocks.getRelated.mockResolvedValue({ items: [] });
    apiMocks.startTriage.mockResolvedValue(triageStartResponse);
  });

  it("shows flow selection in the first family workspace view", async () => {
    render(<FamilyLandingPage />);

    expect(await screen.findByRole("heading", { name: "Power & Thermal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose the flow" })).toBeInTheDocument();
    expect(screen.getAllByText("1 guided route").length).toBeGreaterThan(0);
    expect(screen.getByRole("searchbox", { name: /search flows in power & thermal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start charging safety guided workspace/i })).toBeInTheDocument();
  });

  it("starts the selected flow and lands in the guided workspace", async () => {
    const user = userEvent.setup();
    render(<FamilyLandingPage />);

    await user.click(await screen.findByRole("button", { name: /start charging safety guided workspace/i }));

    await waitFor(() => {
      expect(apiMocks.startTriage).toHaveBeenCalledWith(4);
      expect(sessionMocks.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          learningFamilyId: "power",
          learningFamilyTitle: "Power & Thermal",
          learningTrackTitle: "Charging safety",
          procedure: expect.objectContaining({ id: 4 }),
        })
      );
      expect(navigationMocks.push).toHaveBeenCalledWith("/triage");
    });
  });

  it("shows a clear fallback when the family cannot be loaded", async () => {
    apiMocks.getRepairFamilyDetail.mockRejectedValueOnce(new Error("Family service unavailable."));

    render(<FamilyLandingPage />);

    expect(await screen.findByText(/family service unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to hub/i })).toBeInTheDocument();
  });
});
