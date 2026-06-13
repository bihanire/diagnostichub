import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CasesPage from "@/app/cases/page";

const navMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

const apiMocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  listCases: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navMocks.push, replace: navMocks.replace }),
}));

vi.mock("@/lib/api", () => ({
  getAuthStatus: apiMocks.getAuthStatus,
  listCases: apiMocks.listCases,
}));

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    reference: "EC-UGA-2026-0001",
    case_type: "repair",
    status: "open",
    ec_location_id: 1,
    created_by_id: 1,
    client_name: "Amina Nakato",
    client_phone: "0701234567",
    client_alt_phone: null,
    client_id_number: null,
    device_model: "Galaxy A05s 64GB",
    device_imei: "123456789012345",
    complaint: "Screen flickering",
    sim_tray_present: true,
    lock_type: "pin",
    client_pin: "1234",
    pattern_sequence: null,
    sym_code: null,
    src_group: null,
    defect_description: null,
    warranty_direction: "IW",
    wty_exception: null,
    liquid_exposure: false,
    drop_or_repair: false,
    sw_update: false,
    normal_use: true,
    asc_name: "Transtel",
    asc_code: "2478424",
    ls_code: null,
    waybill_number: null,
    photo_front: null,
    photo_back: null,
    photo_client_holding: null,
    photo_pattern: null,
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    submitted_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

describe("CasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAuthStatus.mockResolvedValue({
      authenticated: true,
      user: { approval_status: "approved", role: "ec_agent" },
    });
    apiMocks.listCases.mockResolvedValue({
      cases: [makeCase()],
      total: 1,
    });
  });

  it("renders the case list after loading", async () => {
    render(<CasesPage />);
    await waitFor(() => expect(screen.getByText("EC-UGA-2026-0001")).toBeInTheDocument());
    expect(screen.getByText("Amina Nakato")).toBeInTheDocument();
  });

  it("shows status filter tabs", async () => {
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.getByRole("button", { name: /^all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^open/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^dispatched/i })).toBeInTheDocument();
  });

  it("filters by status tab", async () => {
    apiMocks.listCases.mockResolvedValue({
      cases: [
        makeCase({ reference: "EC-UGA-2026-0001", status: "open" }),
        makeCase({ id: 2, reference: "EC-UGA-2026-0002", status: "dispatched", client_name: "Tendo Mukasa" }),
      ],
      total: 2,
    });
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));

    await userEvent.click(screen.getByRole("button", { name: /^dispatched/i }));
    expect(screen.queryByText("EC-UGA-2026-0001")).not.toBeInTheDocument();
    expect(screen.getByText("EC-UGA-2026-0002")).toBeInTheDocument();
  });

  it("shows search input", async () => {
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.getByPlaceholderText(/search by reference/i)).toBeInTheDocument();
  });

  it("filters cases by reference search", async () => {
    apiMocks.listCases.mockResolvedValue({
      cases: [
        makeCase({ reference: "EC-UGA-2026-0001", client_name: "Amina Nakato" }),
        makeCase({ id: 2, reference: "EC-UGA-2026-0002", client_name: "Tendo Mukasa" }),
      ],
      total: 2,
    });
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));

    await userEvent.type(screen.getByPlaceholderText(/search by reference/i), "0002");
    expect(screen.queryByText("EC-UGA-2026-0001")).not.toBeInTheDocument();
    expect(screen.getByText("EC-UGA-2026-0002")).toBeInTheDocument();
  });

  it("filters cases by client name search", async () => {
    apiMocks.listCases.mockResolvedValue({
      cases: [
        makeCase({ reference: "EC-UGA-2026-0001", client_name: "Amina Nakato" }),
        makeCase({ id: 2, reference: "EC-UGA-2026-0002", client_name: "Tendo Mukasa" }),
      ],
      total: 2,
    });
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));

    await userEvent.type(screen.getByPlaceholderText(/search by reference/i), "tendo");
    expect(screen.queryByText("EC-UGA-2026-0001")).not.toBeInTheDocument();
    expect(screen.getByText("EC-UGA-2026-0002")).toBeInTheDocument();
  });

  it("shows no-match message when search has no results", async () => {
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));

    await userEvent.type(screen.getByPlaceholderText(/search by reference/i), "XXXXXXXXXXX");
    expect(screen.getByText(/no cases match/i)).toBeInTheDocument();
  });

  it("shows clear button when query is typed and clears on click", async () => {
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));

    const input = screen.getByPlaceholderText(/search by reference/i);
    await userEvent.type(input, "test");
    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    expect(clearBtn).toBeInTheDocument();

    await userEvent.click(clearBtn);
    expect(screen.getByText("EC-UGA-2026-0001")).toBeInTheDocument();
  });

  it("shows waybill number on dispatched cards", async () => {
    apiMocks.listCases.mockResolvedValue({
      cases: [makeCase({ status: "dispatched", waybill_number: "AWB123456" })],
      total: 1,
    });
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.getByText(/AWB123456/)).toBeInTheDocument();
  });

  it("navigates to case detail on card click", async () => {
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));

    await userEvent.click(screen.getByText("EC-UGA-2026-0001").closest("button")!);
    expect(navMocks.push).toHaveBeenCalledWith("/cases/EC-UGA-2026-0001");
  });

  it("shows empty state with CTA when no cases exist", async () => {
    apiMocks.listCases.mockResolvedValue({ cases: [], total: 0 });
    render(<CasesPage />);
    await waitFor(() => screen.getByText(/no cases yet/i));
    expect(screen.getByRole("button", { name: /start a diagnostic/i })).toBeInTheDocument();
  });

  it("redirects to login when not authenticated", async () => {
    apiMocks.getAuthStatus.mockResolvedValue({ authenticated: false });
    render(<CasesPage />);
    await waitFor(() => expect(navMocks.replace).toHaveBeenCalledWith("/login"));
  });

  it("redirects to pending when approval is pending", async () => {
    apiMocks.getAuthStatus.mockResolvedValue({
      authenticated: true,
      user: { approval_status: "pending" },
    });
    render(<CasesPage />);
    await waitFor(() => expect(navMocks.replace).toHaveBeenCalledWith("/pending"));
  });

  it("shows total case count in footer", async () => {
    render(<CasesPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.getByText(/1 case total/i)).toBeInTheDocument();
  });
});
