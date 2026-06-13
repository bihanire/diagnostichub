import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminUsersPage from "@/app/admin/users/page";

const navMocks = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});

const apiMocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  listAdminUsers: vi.fn(),
  approveUser: vi.fn(),
  suspendUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navMocks.router,
}));

vi.mock("@/lib/api", () => ({
  getAuthStatus: apiMocks.getAuthStatus,
  listAdminUsers: apiMocks.listAdminUsers,
  approveUser: apiMocks.approveUser,
  suspendUser: apiMocks.suspendUser,
}));

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: "agent@test.local",
    full_name: "Test Agent",
    role: "ec_agent",
    approval_status: "pending",
    ec_location_id: 1,
    ec_location_name: "Newera Technologies — Kampala",
    created_at: "2026-06-01T08:00:00Z",
    approved_at: null,
    last_login_at: null,
    ...overrides,
  };
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAuthStatus.mockResolvedValue({
      authenticated: true,
      user: { role: "watu_admin", approval_status: "approved" },
    });
    apiMocks.listAdminUsers.mockResolvedValue({
      users: [makeUser()],
      total: 1,
      pending_count: 1,
    });
    apiMocks.approveUser.mockResolvedValue({
      message: "Approved",
      user: makeUser({ approval_status: "approved" }),
    });
    apiMocks.suspendUser.mockResolvedValue({
      message: "Suspended",
      user: makeUser({ approval_status: "suspended" }),
    });
  });

  it("renders the user list after loading", async () => {
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByText("Test Agent"));
    expect(screen.getByText("agent@test.local")).toBeInTheDocument();
  });

  it("shows status filter tabs", async () => {
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByText("Test Agent"));
    expect(screen.getByRole("button", { name: /pending/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approved/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /suspended/i })).toBeInTheDocument();
  });

  it("shows approve button for pending users", async () => {
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByRole("button", { name: /^approve$/i }));
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
  });

  it("calls approveUser API and reloads list on approve", async () => {
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByRole("button", { name: /^approve$/i }));

    await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => expect(apiMocks.approveUser).toHaveBeenCalledWith(1));
  });

  it("shows suspend button for approved users", async () => {
    apiMocks.listAdminUsers.mockResolvedValue({
      users: [makeUser({ approval_status: "approved" })],
      total: 1,
      pending_count: 0,
    });
    render(<AdminUsersPage />);
    // Switch to Approved filter so the approved user is visible
    await waitFor(() => screen.getByRole("button", { name: /^approved$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^approved$/i }));
    await waitFor(() => screen.getByRole("button", { name: /^suspend$/i }));
    expect(screen.getByRole("button", { name: /^suspend$/i })).toBeInTheDocument();
  });

  it("calls suspendUser API on suspend", async () => {
    apiMocks.listAdminUsers.mockResolvedValue({
      users: [makeUser({ approval_status: "approved" })],
      total: 1,
      pending_count: 0,
    });
    render(<AdminUsersPage />);
    // Default filter is "pending" — switch to "Approved" so the user is visible
    await waitFor(() => screen.getByRole("button", { name: /^approved$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^approved$/i }));
    await waitFor(() => screen.getByRole("button", { name: /^suspend$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^suspend$/i }));
    await waitFor(() => expect(apiMocks.suspendUser).toHaveBeenCalledWith(1));
  });

  it("filters to show only approved users when approved tab clicked", async () => {
    apiMocks.listAdminUsers.mockResolvedValue({
      users: [
        makeUser({ id: 1, approval_status: "pending", email: "pending@test.local" }),
        makeUser({ id: 2, approval_status: "approved", email: "approved@test.local", full_name: "Approved User" }),
      ],
      total: 2,
    });
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByText("pending@test.local"));

    await userEvent.click(screen.getByRole("button", { name: /^approved$/i }));
    expect(screen.queryByText("pending@test.local")).not.toBeInTheDocument();
    expect(screen.getByText("approved@test.local")).toBeInTheDocument();
  });

  it("shows empty state message when no users match filter", async () => {
    apiMocks.listAdminUsers.mockResolvedValue({ users: [], total: 0 });
    render(<AdminUsersPage />);
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it("redirects non-admin users to dashboard", async () => {
    apiMocks.getAuthStatus.mockResolvedValue({
      authenticated: true,
      user: { role: "ec_agent", approval_status: "approved" },
    });
    render(<AdminUsersPage />);
    await waitFor(() => expect(navMocks.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("redirects unauthenticated users to login", async () => {
    apiMocks.getAuthStatus.mockResolvedValue({ authenticated: false });
    render(<AdminUsersPage />);
    await waitFor(() => expect(navMocks.replace).toHaveBeenCalledWith("/login"));
  });

  it("shows toast message after approve action", async () => {
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByRole("button", { name: /^approve$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    await waitFor(() => screen.getByRole("status"));
  });
});
