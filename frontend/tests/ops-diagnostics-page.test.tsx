import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OpsDiagnosticsPage from "@/app/ops/diagnostics/page";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  getApiBaseUrl: vi.fn(),
}));

const startupMocks = vi.hoisted(() => ({
  getBootHandshakeTimeoutMs: vi.fn(),
  getExpectedApiVersion: vi.fn(),
  isApiVersionCheckEnabled: vi.fn(),
  isBootHandshakeEnabled: vi.fn(),
  probeStartupReadiness: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
  }),
}));

vi.mock("@/lib/api", () => ({
  getApiBaseUrl: apiMocks.getApiBaseUrl,
}));

vi.mock("@/lib/startup-handshake", () => ({
  getBootHandshakeTimeoutMs: startupMocks.getBootHandshakeTimeoutMs,
  getExpectedApiVersion: startupMocks.getExpectedApiVersion,
  isApiVersionCheckEnabled: startupMocks.isApiVersionCheckEnabled,
  isBootHandshakeEnabled: startupMocks.isBootHandshakeEnabled,
  probeStartupReadiness: startupMocks.probeStartupReadiness,
}));

describe("OpsDiagnosticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getApiBaseUrl.mockReturnValue("/api");
    startupMocks.getBootHandshakeTimeoutMs.mockReturnValue(5000);
    startupMocks.getExpectedApiVersion.mockReturnValue("1.0.0");
    startupMocks.isApiVersionCheckEnabled.mockReturnValue(true);
    startupMocks.isBootHandshakeEnabled.mockReturnValue(true);
    startupMocks.probeStartupReadiness.mockResolvedValue({
      ok: true,
      requestId: "req-meta-1",
      payload: {
        status: "ok",
        checks: {
          db: "ok",
        },
      },
      latencyMs: 42,
      meta: {
        api_version: "1.0.0",
        schema_version: "7",
        build: "abc123",
      },
      versionWarning: null,
    });
  });

  it("shows deployment health when the runtime probe succeeds", async () => {
    render(<OpsDiagnosticsPage />);

    expect(await screen.findByText("Runtime checks passed")).toBeInTheDocument();
    expect(screen.getByText("Live deployment readiness")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
    expect(screen.getByText("req-meta-1")).toBeInTheDocument();
    expect(screen.getByText("Db")).toBeInTheDocument();
    expect(screen.getAllByText("Good").length).toBeGreaterThan(0);
    expect(startupMocks.probeStartupReadiness).toHaveBeenCalledWith(5000);
  });

  it("renders contract mismatch details when the probe fails", async () => {
    startupMocks.probeStartupReadiness.mockResolvedValue({
      ok: false,
      reason: "version_mismatch",
      message: "Backend metadata is missing or invalid.",
      requestId: "req-meta-2",
      statusCode: 200,
      expectedApiVersion: "1.0.0",
      actualApiVersion: "2.0.0",
    });

    render(<OpsDiagnosticsPage />);

    expect(await screen.findByText("Runtime needs attention")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Backend metadata is missing or invalid.");
    expect(screen.getByText("Version Mismatch")).toBeInTheDocument();
    expect(screen.getByText("2.0.0")).toBeInTheDocument();
    expect(screen.getByText("req-meta-2")).toBeInTheDocument();
  });

  it("runs the probe again when the operator retries diagnostics", async () => {
    const user = userEvent.setup();
    render(<OpsDiagnosticsPage />);

    await screen.findByText("Runtime checks passed");
    await user.click(screen.getByRole("button", { name: /run check again/i }));

    await waitFor(() => {
      expect(startupMocks.probeStartupReadiness).toHaveBeenCalledTimes(2);
    });
  });
});
