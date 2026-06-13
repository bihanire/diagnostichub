// Samsung iPaaS DefectDesc field — max 70 chars.
// Built from T-code → short symptom label + warranty verdict suffix.
// Used in the Google Form pre-fill reference on the result page.

const T_CODE_LABELS: Record<string, string> = {
  T01: "Customer request – FRP / credentials",
  T02: "Customer request – accessory query",
  T03: "Customer request – setting change",
  T12: "No power on / dead device",
  T14: "Random restart / reboot",
  T16: "App crash / freeze / hang",
  T21: "Display fault – no display / lines",
  // T22: physical/liquid damage. Confirm exact Samsung iPaaS code with
  // Transtel before this value is used for live ticket submission.
  T22: "Physical / liquid damage",
  T31: "Not charging / slow charge",
  T33: "Battery draining fast",
  T35: "Overheating / swollen battery",
  T41: "Camera fault – no image / blur",
  T51: "Audio fault – speaker / mic",
  T61: "No SIM / no network signal",
};

const DEFECT_DESC_MAX_LENGTH = 70;
const FALLBACK_SYMPTOM = "Device fault";

export function buildDefectDesc(
  primaryTCode: string | null | undefined,
  warrantyDirection: "IW" | "OW" | null | undefined,
): string {
  const tCode = primaryTCode?.toUpperCase().trim() ?? "";
  const symptom = T_CODE_LABELS[tCode] ?? FALLBACK_SYMPTOM;
  const verdict = warrantyDirection ?? "Needs Review";
  const raw = `${symptom} – ${verdict}`;
  return raw.length > DEFECT_DESC_MAX_LENGTH
    ? raw.slice(0, DEFECT_DESC_MAX_LENGTH - 3) + "..."
    : raw;
}
