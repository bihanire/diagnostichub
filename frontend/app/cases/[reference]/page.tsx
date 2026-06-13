"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthStatus, getCase, updateCaseStatus } from "@/lib/api";
import { buildPreFillUrl } from "@/lib/googleForm";
import { clearSession } from "@/lib/session";
import { AppUser, CaseResponse } from "@/lib/types";

const CASE_TYPE_LABELS: Record<string, string> = {
  repair: "Repair",
  frp: "FRP — Factory Reset Protection",
  return: "Device Return",
  theft: "Theft / Stolen",
};

const WARRANTY_LABELS: Record<string, string> = {
  IW: "In-Warranty",
  OW: "Out-of-Warranty",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  dispatched: "Dispatched",
  closed: "Closed",
  cancelled: "Cancelled",
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reference = typeof params.reference === "string" ? params.reference : "";

  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status panel state
  const [statusAction, setStatusAction] = useState<"dispatch" | "cancel" | "close" | null>(null);
  const [waybill, setWaybill] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waybillRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated) { router.replace("/login"); return; }
        if (auth.user) setCurrentUser(auth.user);
      } catch {
        router.replace("/login");
        return;
      }

      try {
        const data = await getCase(reference);
        setCaseData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Case not found.");
      } finally {
        setLoading(false);
      }
    }
    if (reference) void load();
  }, [reference, router]);

  // Auto-focus waybill input when dispatch panel opens
  useEffect(() => {
    if (statusAction === "dispatch") {
      setTimeout(() => waybillRef.current?.focus(), 50);
    }
  }, [statusAction]);

  function showToast(msg: string) {
    setStatusToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setStatusToast(null), 3500);
  }

  async function confirmStatusChange(newStatus: string, waybillNumber?: string) {
    if (!caseData) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await updateCaseStatus(reference, newStatus, waybillNumber);
      setCaseData(res.case);
      setStatusAction(null);
      setWaybill("");
      showToast(`Case ${newStatus === "dispatched" ? "marked as dispatched" : newStatus === "closed" ? "closed" : "cancelled"}.`);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setStatusLoading(false);
    }
  }

  function startNewCase() {
    clearSession();
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="case-page">
        <div className="case-card">
          <p className="auth-loading">Loading case…</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="case-page">
        <div className="case-card">
          <p className="auth-error">{error ?? "Case not found."}</p>
          <button className="case-submit-btn" onClick={() => router.push("/dashboard")} type="button">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const isFrp = caseData.case_type === "frp";
  const isDocOnly = caseData.case_type === "return" || caseData.case_type === "theft";
  const submittedDate = caseData.submitted_at
    ? new Date(caseData.submitted_at).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" })
    : new Date(caseData.created_at).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" });

  const isOpen = caseData.status === "open";
  const isDispatched = caseData.status === "dispatched";
  const isTerminal = caseData.status === "closed" || caseData.status === "cancelled";

  const ecLocationName = currentUser?.ec_location?.name ?? "";
  const preFillUrl = buildPreFillUrl(caseData, ecLocationName);

  return (
    <div className="case-page">
      {statusToast && <div className="cs-toast">{statusToast}</div>}

      <div className="case-card case-card-wide">

        {/* Job card reference — the hero */}
        <div className="case-ref-hero">
          <span className="case-ref-label">Job Card</span>
          <strong className="case-ref-number">{caseData.reference}</strong>
          <span className="case-ref-date">{submittedDate}</span>
          <span className={`case-ref-type-badge case-type-${caseData.case_type}`}>
            {CASE_TYPE_LABELS[caseData.case_type] ?? caseData.case_type}
          </span>
        </div>

        {/* ── Status panel ── */}
        <div className="cs-panel">
          <div className="cs-status-row">
            <span className="cs-label">Status</span>
            <span className={`cs-badge cs-badge-${caseData.status}`}>
              {STATUS_LABELS[caseData.status] ?? caseData.status}
            </span>
            {caseData.waybill_number && (
              <span className="cs-waybill">Waybill: <strong>{caseData.waybill_number}</strong></span>
            )}
          </div>

          {/* Action buttons — only on non-terminal states */}
          {!isTerminal && statusAction === null && (
            <div className="cs-actions">
              {isOpen && (
                <button className="cs-btn cs-btn-dispatch" type="button" onClick={() => setStatusAction("dispatch")}>
                  Mark as dispatched
                </button>
              )}
              {isDispatched && (
                <button className="cs-btn cs-btn-close" type="button" onClick={() => confirmStatusChange("closed")}>
                  Mark as closed
                </button>
              )}
              <button className="cs-btn cs-btn-cancel" type="button" onClick={() => setStatusAction("cancel")}>
                Cancel case
              </button>
            </div>
          )}

          {/* Dispatch confirmation — waybill input */}
          {statusAction === "dispatch" && (
            <div className="cs-confirm-panel">
              <p className="cs-confirm-title">Record Aramex waybill number</p>
              <p className="cs-confirm-hint">Enter the waybill from the Aramex label. You can skip if not yet available.</p>
              <div className="cs-waybill-row">
                <input
                  ref={waybillRef}
                  className="cs-waybill-input"
                  type="text"
                  placeholder="e.g. 4200123456789"
                  value={waybill}
                  onChange={e => setWaybill(e.target.value)}
                  disabled={statusLoading}
                />
              </div>
              {statusError && <p className="cs-error">{statusError}</p>}
              <div className="cs-confirm-actions">
                <button
                  className="cs-btn cs-btn-dispatch"
                  type="button"
                  disabled={statusLoading}
                  onClick={() => confirmStatusChange("dispatched", waybill.trim() || undefined)}
                >
                  {statusLoading ? "Saving…" : "Confirm dispatch"}
                </button>
                <button className="cs-btn cs-btn-secondary" type="button" disabled={statusLoading} onClick={() => { setStatusAction(null); setStatusError(null); }}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Cancel confirmation */}
          {statusAction === "cancel" && (
            <div className="cs-confirm-panel cs-confirm-danger">
              <p className="cs-confirm-title">Cancel this case?</p>
              <p className="cs-confirm-hint">This cannot be undone. The case will be permanently marked cancelled.</p>
              {statusError && <p className="cs-error">{statusError}</p>}
              <div className="cs-confirm-actions">
                <button
                  className="cs-btn cs-btn-cancel"
                  type="button"
                  disabled={statusLoading}
                  onClick={() => confirmStatusChange("cancelled")}
                >
                  {statusLoading ? "Saving…" : "Yes, cancel case"}
                </button>
                <button className="cs-btn cs-btn-secondary" type="button" disabled={statusLoading} onClick={() => { setStatusAction(null); setStatusError(null); }}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="case-detail-grid">

          {/* Client */}
          <section className="case-detail-section">
            <h3 className="case-section-title">Client</h3>
            <dl className="case-dl">
              <dt>Name</dt><dd>{caseData.client_name}</dd>
              <dt>Phone</dt><dd>{caseData.client_phone}</dd>
              {caseData.client_alt_phone && (<><dt>Alt phone</dt><dd>{caseData.client_alt_phone}</dd></>)}
              {caseData.client_id_number && (<><dt>Loan / Client ID</dt><dd>{caseData.client_id_number}</dd></>)}
            </dl>
          </section>

          {/* Device */}
          <section className="case-detail-section">
            <h3 className="case-section-title">Device</h3>
            <dl className="case-dl">
              <dt>Model</dt><dd>{caseData.device_model}</dd>
              <dt>IMEI</dt><dd className="case-imei">{caseData.device_imei}</dd>
              {caseData.sim_tray_present !== null && (
                <><dt>SIM tray</dt><dd>{caseData.sim_tray_present ? "Present" : "Missing"}</dd></>
              )}
              {caseData.lock_type && (<><dt>Lock</dt><dd>{caseData.lock_type}</dd></>)}
              {caseData.client_pin && (<><dt>PIN</dt><dd>{caseData.client_pin}</dd></>)}
              {caseData.pattern_sequence && (<><dt>Pattern</dt><dd>{caseData.pattern_sequence}</dd></>)}
            </dl>
          </section>

          {/* Complaint */}
          <section className="case-detail-section case-detail-full">
            <h3 className="case-section-title">Complaint</h3>
            <p className="case-complaint-text">{caseData.complaint}</p>
          </section>

          {/* Diagnostic (repair only) */}
          {!isFrp && !isDocOnly && (caseData.sym_code || caseData.warranty_direction) && (
            <section className="case-detail-section case-detail-full">
              <h3 className="case-section-title">Diagnostic output</h3>
              <dl className="case-dl case-dl-4col">
                {caseData.sym_code && (<><dt>T-code</dt><dd>{caseData.sym_code}</dd></>)}
                {caseData.src_group && (<><dt>SRC group</dt><dd>{caseData.src_group}</dd></>)}
                {caseData.warranty_direction && (
                  <><dt>Warranty</dt>
                  <dd>
                    <span className={`case-wty-badge ${caseData.warranty_direction === "IW" ? "badge-iw" : "badge-ow"}`}>
                      {WARRANTY_LABELS[caseData.warranty_direction] ?? caseData.warranty_direction}
                    </span>
                  </dd></>
                )}
                {caseData.wty_exception && (<><dt>Exception</dt><dd>{caseData.wty_exception}</dd></>)}
                {caseData.defect_description && (
                  <><dt>Defect description</dt><dd className="case-dl-span">{caseData.defect_description}</dd></>
                )}
              </dl>
            </section>
          )}

          {/* Routing */}
          {(caseData.asc_name || caseData.ls_code) && (
            <section className="case-detail-section case-detail-full">
              <h3 className="case-section-title">Routing</h3>
              <dl className="case-dl">
                {caseData.asc_name && (<><dt>Service centre</dt><dd>{caseData.asc_name}</dd></>)}
                {caseData.asc_code && (<><dt>ASC code</dt><dd>{caseData.asc_code}</dd></>)}
                {caseData.ls_code && (<><dt>LS code</dt><dd>{caseData.ls_code}</dd></>)}
                {isFrp && (<><dt>Cost to customer</dt><dd>UGX 25,000 (collected by ASC)</dd></>)}
              </dl>
            </section>
          )}
        </div>

        {/* Next steps notice */}
        <div className="case-next-steps">
          {isDocOnly ? (
            <p>
              {caseData.case_type === "theft"
                ? "Ensure the customer has a police letter on file. Record this case and escalate to Watu ops."
                : "Follow the return procedure. Ensure the device is in acceptable condition before accepting."}
            </p>
          ) : (
            <p>
              Package the device securely with this job card reference. Watu will arrange Aramex pickup.
              {isFrp ? " Banana World turnaround is 48 hours. Customer pays UGX 25,000 to Banana World directly." : ""}
            </p>
          )}
        </div>

        <div className="case-action-row">
          <button className="secondary-button" onClick={() => router.push("/dashboard")} type="button">
            Back to dashboard
          </button>
          <a
            className="primary-button case-pdf-btn"
            href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/cases/${reference}/pdf`}
            download={`${reference}.pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Download job card PDF
          </a>
          {preFillUrl && (
            <a
              className="secondary-button case-gform-btn"
              href={preFillUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Watu form ↗
            </a>
          )}
          <button className="secondary-button" onClick={startNewCase} type="button">
            New diagnostic
          </button>
        </div>
      </div>
    </div>
  );
}
