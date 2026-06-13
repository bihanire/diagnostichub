import { describe, expect, it } from "vitest";

import { buildDefectDesc } from "@/lib/defect-desc";

describe("buildDefectDesc", () => {
  it("builds a known T-code with IW verdict", () => {
    expect(buildDefectDesc("T12", "IW")).toBe("No power on / dead device – IW");
  });

  it("builds a known T-code with OW verdict", () => {
    expect(buildDefectDesc("T21", "OW")).toBe("Display fault – no display / lines – OW");
  });

  it("uses Needs Review when warrantyDirection is null", () => {
    expect(buildDefectDesc("T12", null)).toBe("No power on / dead device – Needs Review");
  });

  it("uses Needs Review when warrantyDirection is undefined", () => {
    expect(buildDefectDesc("T12", undefined)).toBe("No power on / dead device – Needs Review");
  });

  it("uses fallback symptom for unknown T-code", () => {
    expect(buildDefectDesc("T99", "IW")).toBe("Device fault – IW");
  });

  it("uses fallback symptom when T-code is null", () => {
    expect(buildDefectDesc(null, "OW")).toBe("Device fault – OW");
  });

  it("uses fallback symptom when T-code is undefined", () => {
    expect(buildDefectDesc(undefined, "IW")).toBe("Device fault – IW");
  });

  it("uses fallback symptom when T-code is empty string", () => {
    expect(buildDefectDesc("", "IW")).toBe("Device fault – IW");
  });

  it("is case-insensitive for T-code", () => {
    expect(buildDefectDesc("t12", "IW")).toBe("No power on / dead device – IW");
  });

  it("covers all customer-request codes", () => {
    expect(buildDefectDesc("T01", "IW")).toBe("Customer request – FRP / credentials – IW");
    expect(buildDefectDesc("T02", "IW")).toBe("Customer request – accessory query – IW");
    expect(buildDefectDesc("T03", "IW")).toBe("Customer request – setting change – IW");
  });

  it("covers all physical symptom codes", () => {
    expect(buildDefectDesc("T14", "OW")).toBe("Random restart / reboot – OW");
    expect(buildDefectDesc("T16", "IW")).toBe("App crash / freeze / hang – IW");
    expect(buildDefectDesc("T22", "OW")).toBe("Physical / liquid damage – OW");
    expect(buildDefectDesc("T31", "OW")).toBe("Not charging / slow charge – OW");
    expect(buildDefectDesc("T33", "IW")).toBe("Battery draining fast – IW");
    expect(buildDefectDesc("T35", "OW")).toBe("Overheating / swollen battery – OW");
    expect(buildDefectDesc("T41", "IW")).toBe("Camera fault – no image / blur – IW");
    expect(buildDefectDesc("T51", "OW")).toBe("Audio fault – speaker / mic – OW");
    expect(buildDefectDesc("T61", "IW")).toBe("No SIM / no network signal – IW");
  });

  it("never exceeds 70 characters", () => {
    // Exhaustive check across all known codes and both directions
    const codes = ["T01","T02","T03","T12","T14","T16","T21","T22","T31","T33","T35","T41","T51","T61","T99"];
    const directions = ["IW", "OW", null, undefined] as const;
    for (const code of codes) {
      for (const dir of directions) {
        const result = buildDefectDesc(code, dir);
        expect(result.length).toBeLessThanOrEqual(70);
      }
    }
  });
});
