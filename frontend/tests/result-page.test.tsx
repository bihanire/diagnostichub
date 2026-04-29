import { describe, expect, it } from "vitest";

import { uiCopy } from "@/lib/copy";

describe("result screen copy", () => {
  it("keeps the primary decision language clear", () => {
    expect(uiCopy.result.primary.eyebrow).toMatch(/diagnosis and triage/i);
    expect(uiCopy.result.playbook.title).toMatch(/officer should do next/i);
    expect(uiCopy.result.warrantyDirection.title).toMatch(/warranty path/i);
    expect(uiCopy.result.threshold.title).toMatch(/do not send yet/i);
  });
});
