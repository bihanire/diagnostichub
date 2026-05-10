import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  getRepairFamilies,
  getOpsFeedbackByBranch,
  getOpsFeedbackByTag,
  getOpsFeedbackLanguageExportUrl,
  getOpsFeedbackByProcedure,
  getOpsFeedbackLanguageCandidates,
  getOpsFeedbackSummary,
  getOpsSession,
  loginOps,
  logoutOps
} from "@/lib/api";

describe("ops API helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends credentialed requests for protected ops calls", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ authenticated: true, items: [], total_submissions: 0 }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    });

    await getOpsSession();
    await loginOps("ops-password");
    await logoutOps();
    await getOpsFeedbackSummary(30);
    await getOpsFeedbackByProcedure(30);
    await getOpsFeedbackByBranch(30);
    await getOpsFeedbackByTag(30);
    await getOpsFeedbackLanguageCandidates(30);

    expect(fetchMock).toHaveBeenCalledTimes(8);
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ credentials: "include" });
      const headers = call[1]?.headers as Headers;
      expect(headers.get("X-Client-Request-ID")).toBeTruthy();
    }
  });

  it("fails early with a clear message when offline", async () => {
    const originalNavigator = window.navigator;
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        onLine: false
      }
    });

    await expect(getOpsSession()).rejects.toMatchObject({
      message: expect.stringMatching(/appear to be offline/i),
      status: 0
    });

    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: originalNavigator
    });
  });

  it("builds the protected language export URL", () => {
    expect(getOpsFeedbackLanguageExportUrl(30)).toContain(
      "/feedback/language-candidates/export.csv?days=30&limit=50"
    );
  });

  it("falls back to cached repair families when the network request fails", async () => {
    window.localStorage.setItem(
      "diaghub-family-summaries",
      JSON.stringify([
        {
          id: "display",
          title: "Display & Vision",
          hint: "Cached family",
          symptom_prompts: ["cracked screen"],
          procedure_count: 1
        }
      ])
    );

    vi.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));

    await expect(getRepairFamilies()).resolves.toEqual([
      expect.objectContaining({
        id: "display",
        title: "Display & Vision"
      })
    ]);
  });

  it("includes request ID guidance for non-2xx responses", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "UPSTREAM_ERROR",
          message: "Temporary upstream failure",
          request_id: "req-ops-500"
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "req-ops-500"
          }
        }
      )
    );

    await expect(getOpsSession()).rejects.toMatchObject({
      status: 503,
      requestId: "req-ops-500",
      code: "UPSTREAM_ERROR",
      message: expect.stringContaining("Request ID: req-ops-500")
    });
    expect(consoleSpy).toHaveBeenCalledWith("Request ID: req-ops-500 — copy this for support.");
  });
});
