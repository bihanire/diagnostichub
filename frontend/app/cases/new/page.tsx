"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dispatchRoute, getAuthStatus, submitCase } from "@/lib/api";
import { loadSession } from "@/lib/session";
import { CaseCreateRequest, CaseType, DispatchRouteResponse, TriageSession } from "@/lib/types";

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  repair: "Repair (hardware / software)",
  frp: "FRP — Factory Reset Protection",
  return: "Device Return",
  theft: "Theft / Stolen",
};

const LOCK_TYPES = [
  { value: "pin", label: "PIN" },
  { value: "pattern", label: "Pattern" },
  { value: "none", label: "No lock" },
];

export default function NewCasePage() {
  const router = useRouter();

  const [session, setSession] = useState<TriageSession | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchRouteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [caseType, setCaseType] = useState<CaseType>("repair");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAltPhone, setClientAltPhone] = useState("");
  const [clientIdNumber, setClientIdNumber] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceImei, setDeviceImei] = useState("");
  const [complaint, setComplaint] = useState("");
  const [simTray, setSimTray] = useState<boolean | null>(null);
  const [lockType, setLockType] = useState("none");
  const [clientPin, setClientPin] = useState("");
  const [patternSequence, setPatternSequence] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated || !auth.user) {
          router.replace("/login");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }

      const saved = loadSession();
      if (saved?.outcome && saved.warrantyComplete) {
        setSession(saved);
        if (saved.device) setDeviceModel(saved.device.display_label);

        try {
          const route = await dispatchRoute({
            src_group: saved.procedure.src_group ?? null,
            primary_t_code: saved.procedure.primary_t_code ?? null,
            warranty_direction: saved.warrantyDirection ?? null,
            warranty_needs_review: saved.warrantyNeedsReview ?? false,
            procedure_id: saved.procedure.id,
          });
          setDispatchData(route);
        } catch {
          // Non-fatal — dispatch data is optional
        }
      }
      setLoading(false);
    }
    void init();
  }, [router]);

  const hasDiagnostic = session?.outcome != null && session.warrantyComplete;
  const isFrp = caseType === "frp";
  const isDocOnly = caseType === "return" || caseType === "theft";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientName.trim()) { setError("Client name is required."); return; }
    if (!clientPhone.trim()) { setError("Client phone number is required."); return; }
    if (!deviceImei.trim()) { setError("Device IMEI is required."); return; }
    if (!deviceModel.trim()) { setError("Device model is required."); return; }
    if (!complaint.trim()) { setError("Complaint description is required."); return; }
    if (simTray === null) { setError("Please indicate whether the SIM tray is present."); return; }
    if (lockType === "pin" && !clientPin.trim()) { setError("Client PIN is required for PIN-locked devices."); return; }

    const payload: CaseCreateRequest = {
      case_type: caseType,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      client_alt_phone: clientAltPhone.trim() || null,
      client_id_number: clientIdNumber.trim() || null,
      device_model: deviceModel.trim(),
      device_imei: deviceImei.trim(),
      complaint: complaint.trim(),
      sim_tray_present: simTray,
      lock_type: lockType,
      client_pin: lockType === "pin" ? clientPin.trim() : null,
      pattern_sequence: lockType === "pattern" ? patternSequence.trim() || null : null,
    };

    if (hasDiagnostic && !isFrp && !isDocOnly && session) {
      payload.sym_code = session.procedure.primary_t_code ?? null;
      payload.src_group = session.procedure.src_group ?? null;
      payload.defect_description = session.outcome?.diagnosis ?? null;
      payload.warranty_direction = session.warrantyDirection ?? null;
      payload.wty_exception = session.warrantyException ?? null;
      const wa = session.warrantyAnswers ?? [];
      payload.liquid_exposure = wa[0] === "yes" ? true : wa[0] === "no" ? false : null;
      payload.drop_or_repair = wa[1] === "yes" ? true : wa[1] === "no" ? false : null;
      payload.sw_update = wa[2] === "yes" ? true : wa[2] === "no" ? false : null;
      payload.normal_use = wa[3] === "yes" ? true : wa[3] === "no" ? false : null;
    }

    if (isFrp) {
      payload.asc_name = "Banana World";
      payload.asc_code = "0006495118";
    } else if (dispatchData) {
      payload.asc_name = dispatchData.service_center ?? null;
      payload.ls_code = dispatchData.ls_code ?? null;
    }

    setSubmitting(true);
    try {
      const created = await submitCase(payload);
      router.push(`/cases/${created.reference}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="case-page">
        <div className="case-card">
          <p className="auth-loading">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="case-page">
      <div className="case-card case-card-wide">
        <div className="case-header">
          <button className="case-back-btn" onClick={() => router.back()} type="button">
            ← Back
          </button>
          <div className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true" />
            <span className="auth-brand-name">DiagnosticHub</span>
            <span className="auth-brand-sub">New Job Card</span>
          </div>
        </div>

        {hasDiagnostic && !isFrp && !isDocOnly && (
          <div className="case-diagnostic-banner">
            <span className="case-banner-label">Diagnostic complete</span>
            <span className="case-banner-value">{session?.procedure.title}</span>
            {session?.warrantyDirection && (
              <span className={`case-banner-badge ${session.warrantyDirection === "IW" ? "badge-iw" : "badge-ow"}`}>
                {session.warrantyDirection === "IW" ? "In-Warranty" : "Out-of-Warranty"}
              </span>
            )}
          </div>
        )}

        <form className="case-form" onSubmit={handleSubmit}>

          {/* Case type */}
          <fieldset className="case-fieldset">
            <legend className="case-legend">Case type</legend>
            <div className="case-radio-grid">
              {(Object.keys(CASE_TYPE_LABELS) as CaseType[]).map((t) => (
                <label key={t} className={`case-radio-card ${caseType === t ? "case-radio-card-active" : ""}`}>
                  <input
                    type="radio"
                    name="case_type"
                    value={t}
                    checked={caseType === t}
                    onChange={() => setCaseType(t)}
                  />
                  <span className="case-radio-label">{CASE_TYPE_LABELS[t]}</span>
                </label>
              ))}
            </div>
            {isFrp && (
              <p className="case-hint case-hint-warning">
                FRP cases route to Banana World. Customer will be quoted <strong>UGX 25,000</strong> flat. Turnaround: 48 hours.
              </p>
            )}
            {caseType === "theft" && (
              <p className="case-hint case-hint-warning">
                Customer must present a <strong>police letter</strong> before this case can be processed.
              </p>
            )}
          </fieldset>

          {/* Client info */}
          <fieldset className="case-fieldset">
            <legend className="case-legend">Client information</legend>

            <label className="case-label" htmlFor="clientName">Full name <span className="case-required">*</span></label>
            <input id="clientName" className="case-input" type="text" value={clientName}
              onChange={(e) => setClientName(e.target.value)} placeholder="Customer's full name" required />

            <label className="case-label" htmlFor="clientPhone">Phone number <span className="case-required">*</span></label>
            <input id="clientPhone" className="case-input" type="tel" value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)} placeholder="e.g. 0701234567" required />

            <label className="case-label" htmlFor="clientAltPhone">Alternative phone <span className="case-optional">(optional)</span></label>
            <input id="clientAltPhone" className="case-input" type="tel" value={clientAltPhone}
              onChange={(e) => setClientAltPhone(e.target.value)} placeholder="e.g. 0771234567" />

            <label className="case-label" htmlFor="clientIdNumber">
              Loan / Client ID <span className="case-optional">(optional — if customer has card)</span>
            </label>
            <input id="clientIdNumber" className="case-input" type="text" value={clientIdNumber}
              onChange={(e) => setClientIdNumber(e.target.value)} placeholder="e.g. CM89065103MJ4L" />
          </fieldset>

          {/* Device info */}
          <fieldset className="case-fieldset">
            <legend className="case-legend">Device</legend>

            <label className="case-label" htmlFor="deviceModel">Model <span className="case-required">*</span></label>
            <input id="deviceModel" className="case-input" type="text" value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)} placeholder="e.g. Samsung Galaxy A05s" required />

            <label className="case-label" htmlFor="deviceImei">IMEI <span className="case-required">*</span></label>
            <input id="deviceImei" className="case-input" type="text" value={deviceImei}
              onChange={(e) => setDeviceImei(e.target.value)}
              placeholder="Dial *#06# or check Settings → About phone" maxLength={20} required />
          </fieldset>

          {/* Complaint */}
          <fieldset className="case-fieldset">
            <legend className="case-legend">Complaint</legend>
            <label className="case-label" htmlFor="complaint">
              Customer's complaint — verbatim <span className="case-required">*</span>
            </label>
            <textarea id="complaint" className="case-input case-textarea" value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Describe the issue as the customer described it" rows={3} required />
          </fieldset>

          {/* Device security */}
          <fieldset className="case-fieldset">
            <legend className="case-legend">Device security</legend>

            <span className="case-label">SIM tray present? <span className="case-required">*</span></span>
            <div className="case-bool-row">
              <label className={`case-bool-btn ${simTray === true ? "case-bool-active" : ""}`}>
                <input type="radio" name="sim_tray" value="yes" onChange={() => setSimTray(true)} />
                Yes
              </label>
              <label className={`case-bool-btn ${simTray === false ? "case-bool-active" : ""}`}>
                <input type="radio" name="sim_tray" value="no" onChange={() => setSimTray(false)} />
                No
              </label>
            </div>

            <span className="case-label" style={{ marginTop: "1rem", display: "block" }}>Lock type <span className="case-required">*</span></span>
            <div className="case-lock-row">
              {LOCK_TYPES.map((lt) => (
                <label key={lt.value} className={`case-bool-btn ${lockType === lt.value ? "case-bool-active" : ""}`}>
                  <input type="radio" name="lock_type" value={lt.value}
                    checked={lockType === lt.value} onChange={() => setLockType(lt.value)} />
                  {lt.label}
                </label>
              ))}
            </div>

            {lockType === "pin" && (
              <>
                <label className="case-label" htmlFor="clientPin">
                  Client PIN <span className="case-required">*</span>
                </label>
                <input id="clientPin" className="case-input" type="text" value={clientPin}
                  onChange={(e) => setClientPin(e.target.value)} placeholder="Device unlock PIN" maxLength={20} />
              </>
            )}

            {lockType === "pattern" && (
              <>
                <label className="case-label" htmlFor="patternSequence">
                  Pattern sequence <span className="case-optional">(describe e.g. 1-2-3-6-9)</span>
                </label>
                <input id="patternSequence" className="case-input" type="text" value={patternSequence}
                  onChange={(e) => setPatternSequence(e.target.value)}
                  placeholder="Describe the pattern or leave blank if unable to capture" />
                <p className="case-hint">Photograph of the pattern will be captured in the photo step.</p>
              </>
            )}
          </fieldset>

          {/* Diagnostic summary (read-only, repair cases only) */}
          {hasDiagnostic && !isFrp && !isDocOnly && (
            <fieldset className="case-fieldset case-fieldset-muted">
              <legend className="case-legend">Diagnostic output (from triage)</legend>
              <div className="case-summary-grid">
                <span><strong>Symptom</strong>{session?.procedure.primary_t_code ?? "—"}</span>
                <span><strong>SRC group</strong>{session?.procedure.src_group ?? "—"}</span>
                <span><strong>Warranty</strong>{session?.warrantyDirection ?? "—"}</span>
                {dispatchData?.service_center && (
                  <span><strong>Route to</strong>{dispatchData.service_center}</span>
                )}
              </div>
            </fieldset>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="case-submit-btn" type="submit" disabled={submitting}>
            {submitting ? "Creating job card…" : "Create job card"}
          </button>
        </form>
      </div>
    </div>
  );
}
