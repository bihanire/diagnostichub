import { afterEach, describe, expect, it, vi } from "vitest";

import {
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
});
