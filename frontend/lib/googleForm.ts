/**
 * Google Form pre-fill URL builder — Phase 12
 *
 * Generates a pre-filled Google Form URL from a CaseResponse so EC agents can
 * open the existing Watu aftersales Google Form with all fields already
 * populated. This is a bridge until DiagnosticHub talks directly to SOAS.
 *
 * ── How to wire up ───────────────────────────────────────────────────────────
 * 1. Open your Google Form in edit mode.
 * 2. Click the three-dot menu → "Get pre-filled link".
 * 3. Fill a dummy value in each field, click "Get link".
 * 4. The URL will contain `entry.XXXXXXXXX=dummy` for each field.
 * 5. Copy each entry.XXXXXXXXX number into the ENTRY_IDS map below,
 *    and set NEXT_PUBLIC_GFORM_ID to the form ID from the URL:
 *    https://docs.google.com/forms/d/{FORM_ID}/viewform
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { CaseResponse } from "@/lib/types";

// Entry IDs from the Watu aftersales Google Form.
// Replace REPLACE_WITH_REAL_ENTRY_ID with the actual entry.XXXXXXXXX values.
const ENTRY_IDS = {
  ec_location:        "REPLACE_WITH_REAL_ENTRY_ID",
  reference:          "REPLACE_WITH_REAL_ENTRY_ID",
  case_type:          "REPLACE_WITH_REAL_ENTRY_ID",
  client_name:        "REPLACE_WITH_REAL_ENTRY_ID",
  client_phone:       "REPLACE_WITH_REAL_ENTRY_ID",
  client_id_number:   "REPLACE_WITH_REAL_ENTRY_ID",
  device_model:       "REPLACE_WITH_REAL_ENTRY_ID",
  device_imei:        "REPLACE_WITH_REAL_ENTRY_ID",
  complaint:          "REPLACE_WITH_REAL_ENTRY_ID",
  warranty_direction: "REPLACE_WITH_REAL_ENTRY_ID",
  asc_name:           "REPLACE_WITH_REAL_ENTRY_ID",
  ls_code:            "REPLACE_WITH_REAL_ENTRY_ID",
} as const;

const CASE_TYPE_LABELS: Record<string, string> = {
  repair: "Repair",
  frp:    "FRP — Factory Reset Protection",
  return: "Device Return",
  theft:  "Theft / Stolen",
};

/**
 * Returns a pre-filled Google Form URL for the given case, or null if the
 * form ID env var is not set (i.e. feature is disabled).
 */
export function buildPreFillUrl(
  caseData: CaseResponse,
  ecLocationName: string
): string | null {
  const formId = process.env.NEXT_PUBLIC_GFORM_ID?.trim();
  if (!formId) return null;

  const params = new URLSearchParams();
  params.set(`entry.${ENTRY_IDS.ec_location}`,        ecLocationName);
  params.set(`entry.${ENTRY_IDS.reference}`,           caseData.reference);
  params.set(`entry.${ENTRY_IDS.case_type}`,           CASE_TYPE_LABELS[caseData.case_type] ?? caseData.case_type);
  params.set(`entry.${ENTRY_IDS.client_name}`,         caseData.client_name);
  params.set(`entry.${ENTRY_IDS.client_phone}`,        caseData.client_phone);
  params.set(`entry.${ENTRY_IDS.client_id_number}`,    caseData.client_id_number ?? "");
  params.set(`entry.${ENTRY_IDS.device_model}`,        caseData.device_model);
  params.set(`entry.${ENTRY_IDS.device_imei}`,         caseData.device_imei);
  params.set(`entry.${ENTRY_IDS.complaint}`,           caseData.complaint);
  params.set(`entry.${ENTRY_IDS.warranty_direction}`,  caseData.warranty_direction ?? "");
  params.set(`entry.${ENTRY_IDS.asc_name}`,            caseData.asc_name ?? "");
  params.set(`entry.${ENTRY_IDS.ls_code}`,             caseData.ls_code ?? "");

  return `https://docs.google.com/forms/d/${formId}/viewform?usp=pp_url&${params.toString()}`;
}
