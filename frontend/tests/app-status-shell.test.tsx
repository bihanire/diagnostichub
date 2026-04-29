import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppStatusShell } from "@/components/AppStatusShell";
import { uiCopy } from "@/lib/copy";

describe("AppStatusShell", () => {
  const originalNavigator = window.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: originalNavigator
    });
  });

  it("shows an offline banner when the browser is offline", async () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        onLine: false
      }
    });

    render(<AppStatusShell />);

    expect(await screen.findByText(uiCopy.global.offlineBanner)).toBeInTheDocument();
  });

  it("shows a slow-network banner when data saver is on", async () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        onLine: true,
        connection: {
          saveData: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      }
    });

    render(<AppStatusShell />);

    expect(await screen.findByText(uiCopy.global.slowNetworkBanner)).toBeInTheDocument();
  });

  it("unregisters stale service workers outside production", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);

    vi.stubEnv("NODE_ENV", "development");
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        onLine: true,
        serviceWorker: {
          getRegistrations
        }
      }
    });

    render(<AppStatusShell />);

    await waitFor(() => {
      expect(getRegistrations).toHaveBeenCalledTimes(1);
      expect(unregister).toHaveBeenCalledTimes(1);
    });
  });

  it("registers service worker in production", async () => {
    const register = vi.fn().mockResolvedValue(undefined);

    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        onLine: true,
        serviceWorker: {
          register
        }
      }
    });

    render(<AppStatusShell />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js");
    });
  });
});
