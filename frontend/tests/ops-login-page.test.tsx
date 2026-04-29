import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OpsLoginPage from "@/app/ops/login/page";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  getOpsSession: vi.fn(),
  loginOps: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    replace: navigationMocks.replace
  })
}));

vi.mock("@/lib/api", () => ({
  getOpsSession: apiMocks.getOpsSession,
  loginOps: apiMocks.loginOps
}));

describe("OpsLoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getOpsSession.mockResolvedValue({
      authenticated: false
    });
    apiMocks.loginOps.mockResolvedValue({
      authenticated: true,
      expires_at: "2026-04-27T18:00:00.000Z",
      message: "Ops access granted."
    });
  });

  it("renders the ops password form and signs in successfully", async () => {
    const user = userEvent.setup();
    render(<OpsLoginPage />);

    expect(await screen.findByRole("heading", { name: /sign in to review branch insights/i }))
      .toBeInTheDocument();

    await user.type(screen.getByLabelText(/shared password/i), "ops-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(apiMocks.loginOps).toHaveBeenCalledWith("ops-password");
      expect(navigationMocks.push).toHaveBeenCalledWith("/insights");
    });
  });

  it("shows a clear message when the password is wrong", async () => {
    const user = userEvent.setup();
    apiMocks.loginOps.mockRejectedValue(new Error("The password did not match. Please try again."));

    render(<OpsLoginPage />);

    await screen.findByRole("heading", { name: /sign in to review branch insights/i });
    await user.type(screen.getByLabelText(/shared password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/the password did not match\. please try again\./i)
    ).toBeInTheDocument();
  });

  it("redirects straight to insights when a valid session already exists", async () => {
    apiMocks.getOpsSession.mockResolvedValue({
      authenticated: true,
      expires_at: "2026-04-27T18:00:00.000Z"
    });

    render(<OpsLoginPage />);

    await waitFor(() => {
      expect(navigationMocks.replace).toHaveBeenCalledWith("/insights");
    });
  });
});
