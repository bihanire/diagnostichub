import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { probeStartupReadiness } from "@/lib/startup-handshake";

describe("startup handshake", () => {
  const originalFetch = global.fetch;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubEnv("NEXT_PUBLIC_ENFORCE_API_GATEWAY", "true");
    vi.stubEnv("NEXT_PUBLIC_API_VERSION_CHECK_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_EXPECTED_API_VERSION", "1.4.0");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("returns success when readiness and metadata checks pass", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "X-Request-ID": "req-ready-1" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ api_version: "1.4.0", schema_version: "7", build: "abc123" }),
          {
            status: 200,
            headers: { "X-Request-ID": "req-meta-1" },
          }
        )
      );

    global.fetch = fetchMock;

    const result = await probeStartupReadiness(5000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.requestId).toBe("req-meta-1");
      expect(result.meta?.api_version).toBe("1.4.0");
      expect(result.versionWarning).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/ready");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/meta");
  });

  it("blocks startup on major API version mismatch", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "X-Request-ID": "req-ready-2" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ api_version: "2.0.0", schema_version: "7", build: "abc123" }),
          {
            status: 200,
            headers: { "X-Request-ID": "req-meta-2" },
          }
        )
      );

    global.fetch = fetchMock;

    const result = await probeStartupReadiness(5000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("version_mismatch");
      expect(result.expectedApiVersion).toBe("1.4.0");
      expect(result.actualApiVersion).toBe("2.0.0");
      expect(result.requestId).toBe("req-meta-2");
    }
  });

  it("warns and continues on minor API version mismatch", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "X-Request-ID": "req-ready-3" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ api_version: "1.5.0", schema_version: "7", build: "abc123" }),
          {
            status: 200,
            headers: { "X-Request-ID": "req-meta-3" },
          }
        )
      );

    global.fetch = fetchMock;

    const result = await probeStartupReadiness(5000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.versionWarning).toContain("Frontend expects API 1.4.0");
      expect(result.meta?.api_version).toBe("1.5.0");
    }
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
