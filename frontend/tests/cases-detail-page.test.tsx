import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CaseDetailPage from "@/app/cases/[reference]/page";

const navMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: { reference: "EC-UGA-2026-0001" },
}));

const apiMocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  getCase: vi.fn(),
  updateCaseStatus: vi.fn(),
}));

const googleFormMocks = vi.hoisted(() => ({
  buildPreFillUrl: vi.fn(() => null as string | null),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navMocks.push, replace: navMocks.replace }),
  useParams: () => navMocks.params,
}));

vi.mock("@/lib/api", () => ({
  getAuthStatus: apiMocks.getAuthStatus,
  getCase: apiMocks.getCase,
  updateCaseStatus: apiMocks.updateCaseStatus,
}));

vi.mock("@/lib/googleForm", () => ({
  buildPreFillUrl: googleFormMocks.buildPreFillUrl,
}));

vi.mock("@/lib/session", () => ({
  clearSession: vi.fn(),
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
    client_id_number: "UG-12345",
    device_model: "Galaxy A05s 64GB",
    device_imei: "123456789012345",
    complaint: "Screen flickering on unlock",
    sim_tray_present: true,
    lock_type: "pin",
    client_pin: "1234",
    pattern_sequence: null,
    sym_code: "T21",
    src_group: "SRC014",
    defect_description: "Display fault identified",
    warranty_direction: "IW",
    wty_exception: null,
    liquid_exposure: false,
    drop_or_repair: false,
    sw_update: false,
    normal_use: true,
    asc_name: "Transtel",
    asc_code: "2478424",
    ls_code: "LS001",
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

describe("CaseDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navMocks.params.reference = "EC-UGA-2026-0001";
    apiMocks.getAuthStatus.mockResolvedValue({
      authenticated: true,
      user: {
        id: 1,
        email: "agent@test.local",
        approval_status: "approved",
        role: "ec_agent",
        ec_location: { id: 1, name: "Newera Technologies — Kampala" },
      },
    });
    apiMocks.getCase.mockResolvedValue(makeCase());
    apiMocks.updateCaseStatus.mockResolvedValue({
      message: "Updated",
      case: makeCase({ status: "dispatched" }),
    });
  });

  it("renders the job card reference header", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.getByText("EC-UGA-2026-0001")).toBeInTheDocument();
  });

  it("shows client details", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("Amina Nakato"));
    expect(screen.getByText("0701234567")).toBeInTheDocument();
  });

  it("shows device details", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("Galaxy A05s 64GB"));
    expect(screen.getByText("123456789012345")).toBeInTheDocument();
  });

  it("shows Open status badge", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("Open"));
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("shows dispatch button for open cases", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText(/mark as dispatched/i));
    expect(screen.getByRole("button", { name: /mark as dispatched/i })).toBeInTheDocument();
  });

  it("shows cancel button for open cases", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText(/cancel case/i));
    expect(screen.getByRole("button", { name: /cancel case/i })).toBeInTheDocument();
  });

  it("shows dispatch confirmation panel on dispatch click", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /mark as dispatched/i }));
    await userEvent.click(screen.getByRole("button", { name: /mark as dispatched/i }));
    expect(screen.getByText(/aramex waybill/i)).toBeInTheDocument();
  });

  it("dispatches case without waybill", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /mark as dispatched/i }));
    await userEvent.click(screen.getByRole("button", { name: /mark as dispatched/i }));

    const confirmBtn = screen.getByRole("button", { name: /confirm dispatch/i });
    await userEvent.click(confirmBtn);

    await waitFor(() =>
      expect(apiMocks.updateCaseStatus).toHaveBeenCalledWith(
        "EC-UGA-2026-0001",
        "dispatched",
        undefined
      )
    );
  });

  it("dispatches case with waybill number", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /mark as dispatched/i }));
    await userEvent.click(screen.getByRole("button", { name: /mark as dispatched/i }));

    const waybillInput = screen.getByPlaceholderText(/4200123456789/i);
    await userEvent.type(waybillInput, "AWB999888");

    const confirmBtn = screen.getByRole("button", { name: /confirm dispatch/i });
    await userEvent.click(confirmBtn);

    await waitFor(() =>
      expect(apiMocks.updateCaseStatus).toHaveBeenCalledWith(
        "EC-UGA-2026-0001",
        "dispatched",
        "AWB999888"
      )
    );
  });

  it("shows waybill number when case is dispatched", async () => {
    apiMocks.getCase.mockResolvedValue(
      makeCase({ status: "dispatched", waybill_number: "AWB123456" })
    );
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("AWB123456"));
    expect(screen.getByText("AWB123456")).toBeInTheDocument();
  });

  it("shows close and cancel buttons for dispatched case", async () => {
    apiMocks.getCase.mockResolvedValue(makeCase({ status: "dispatched" }));
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText(/mark as closed/i));
    expect(screen.getByRole("button", { name: /mark as closed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel case/i })).toBeInTheDocument();
  });

  it("shows no action buttons for closed case", async () => {
    apiMocks.getCase.mockResolvedValue(makeCase({ status: "closed" }));
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.queryByRole("button", { name: /mark as dispatched/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel case/i })).not.toBeInTheDocument();
  });

  it("shows no action buttons for cancelled case", async () => {
    apiMocks.getCase.mockResolvedValue(makeCase({ status: "cancelled" }));
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.queryByRole("button", { name: /cancel case/i })).not.toBeInTheDocument();
  });

  it("does not show Google Form button when GFORM_ID is unset", async () => {
    googleFormMocks.buildPreFillUrl.mockReturnValue(null);
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.queryByText(/open watu form/i)).not.toBeInTheDocument();
  });

  it("shows Google Form button when GFORM_ID is set", async () => {
    googleFormMocks.buildPreFillUrl.mockReturnValue("https://docs.google.com/forms/d/abc/viewform?usp=pp_url");
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText(/open watu form/i));
    const link = screen.getByRole("link", { name: /open watu form/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("docs.google.com"));
  });

  it("shows PDF download link", async () => {
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("EC-UGA-2026-0001"));
    expect(screen.getByRole("link", { name: /download job card pdf/i })).toBeInTheDocument();
  });

  it("shows error when case fails to load", async () => {
    apiMocks.getCase.mockRejectedValue(new Error("Case not found."));
    render(<CaseDetailPage />);
    await waitFor(() => screen.getByText("Case not found."));
  });

  it("redirects to login when not authenticated", async () => {
    apiMocks.getAuthStatus.mockResolvedValue({ authenticated: false });
    render(<CaseDetailPage />);
    await waitFor(() => expect(navMocks.replace).toHaveBeenCalledWith("/login"));
  });
});
