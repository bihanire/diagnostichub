"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Section = {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "warranty",
    title: "Warranty Assessment",
    icon: "W",
    content: (
      <div className="pb-section-body">
        <p className="pb-intro">
          Every repair case must be triaged through the warranty decision before dispatch. Ask the
          four questions in order — one "Yes" changes the outcome.
        </p>
        <div className="pb-decision-tree">
          <div className="pb-question">
            <span className="pb-q-num">1</span>
            <div>
              <strong>Liquid exposure?</strong>
              <p>Check LDI sticker inside SIM tray slot. Pink / red = liquid damage.</p>
              <span className="pb-tag pb-tag-cid">Yes → CID (Out-of-Warranty)</span>
            </div>
          </div>
          <div className="pb-question">
            <span className="pb-q-num">2</span>
            <div>
              <strong>Drop damage or prior unauthorised repair?</strong>
              <p>Cracked screen, bent frame, or third-party repair stickers.</p>
              <span className="pb-tag pb-tag-cid">Yes → CID (Out-of-Warranty)</span>
            </div>
          </div>
          <div className="pb-question">
            <span className="pb-q-num">3</span>
            <div>
              <strong>Software update attempted before fault?</strong>
              <p>Client confirms they updated the phone and then the fault appeared.</p>
              <span className="pb-tag pb-tag-oow">Yes → OOW (Software)</span>
            </div>
          </div>
          <div className="pb-question">
            <span className="pb-q-num">4</span>
            <div>
              <strong>Normal use — no damage, no update?</strong>
              <p>Device in original condition, fault appeared without any incident.</p>
              <span className="pb-tag pb-tag-iw">Yes → In-Warranty (IW)</span>
            </div>
          </div>
        </div>
        <div className="pb-callout pb-callout-info">
          <strong>Your role:</strong> Collect evidence only. You do not quote repair costs or make
          warranty promises to the client — the ASC makes the final call.
        </div>
      </div>
    ),
  },
  {
    id: "frp",
    title: "FRP — Factory Reset Protection",
    icon: "F",
    content: (
      <div className="pb-section-body">
        <p className="pb-intro">
          FRP locks happen when a device is hard-reset without first removing the Google account.
          This is a distinct case type — do not triage it as a repair.
        </p>
        <div className="pb-steps">
          <div className="pb-step">
            <span className="pb-step-num">1</span>
            <div>
              <strong>Confirm it is FRP</strong>
              <p>
                Device boots to a screen asking for the previously synced Google account. Client
                cannot provide the credentials.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">2</span>
            <div>
              <strong>Collect required info</strong>
              <p>Client name, phone, ID number, device model, IMEI.</p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">3</span>
            <div>
              <strong>Log as FRP case in DiagnosticHub</strong>
              <p>Select case type "FRP Unlock". Routing auto-fills to Banana World.</p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">4</span>
            <div>
              <strong>Dispatch to Banana World</strong>
              <p>Hand the device to the Aramex courier. Turnaround: 48 hours.</p>
            </div>
          </div>
        </div>
        <div className="pb-info-grid">
          <div className="pb-info-item">
            <span className="pb-info-label">ASC</span>
            <span className="pb-info-value">Banana World</span>
          </div>
          <div className="pb-info-item">
            <span className="pb-info-label">Cost to client</span>
            <span className="pb-info-value">UGX 25,000 (flat)</span>
          </div>
          <div className="pb-info-item">
            <span className="pb-info-label">Turnaround</span>
            <span className="pb-info-value">48 hours</span>
          </div>
          <div className="pb-info-item">
            <span className="pb-info-label">Warranty</span>
            <span className="pb-info-value">Not applicable</span>
          </div>
        </div>
        <div className="pb-callout pb-callout-warning">
          <strong>Do not collect payment.</strong> The 25,000 UGX is collected by Banana World
          directly. ECs do not handle OOW payments.
        </div>
      </div>
    ),
  },
  {
    id: "returns",
    title: "Device Returns",
    icon: "R",
    content: (
      <div className="pb-section-body">
        <p className="pb-intro">
          A client returning a device for a refund or swap. Document everything before accepting the
          device — deductions are applied to the client&apos;s account.
        </p>
        <div className="pb-steps">
          <div className="pb-step">
            <span className="pb-step-num">1</span>
            <div>
              <strong>Inspect the device in front of the client</strong>
              <p>Check screen, body, ports, and accessories against the original sale record.</p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">2</span>
            <div>
              <strong>Note all deductions</strong>
              <p>Each applies to the client&apos;s refund value.</p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">3</span>
            <div>
              <strong>Log as Return case in DiagnosticHub</strong>
              <p>No ASC routing needed — return cases are documentation only.</p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">4</span>
            <div>
              <strong>Hand device to logistics</strong>
              <p>Package with the printed job card. Watu ops handles the refund calculation.</p>
            </div>
          </div>
        </div>
        <table className="pb-table">
          <thead>
            <tr>
              <th>Condition</th>
              <th>Deduction</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Value loss per day since sale</td>
              <td>UGX 12,500 / day</td>
            </tr>
            <tr>
              <td>Missing accessory (charger, cable, earphones)</td>
              <td>UGX 12,500 each</td>
            </tr>
            <tr>
              <td>No password / device not unlocked for inspection</td>
              <td>UGX 25,000</td>
            </tr>
          </tbody>
        </table>
        <div className="pb-callout pb-callout-warning">
          Do not tell the client their final refund amount — Watu ops calculates and communicates
          this. You only document.
        </div>
      </div>
    ),
  },
  {
    id: "theft",
    title: "Theft / Stolen Devices",
    icon: "T",
    content: (
      <div className="pb-section-body">
        <p className="pb-intro">
          A client reporting their Watu device stolen. This is a documentation case — no device is
          handed over to the EC.
        </p>
        <div className="pb-steps">
          <div className="pb-step">
            <span className="pb-step-num">1</span>
            <div>
              <strong>Verify the client has a police letter</strong>
              <p>
                A valid police abstract is mandatory before logging. Do not proceed without it.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">2</span>
            <div>
              <strong>Record the police letter details</strong>
              <p>Letter number, issuing station, date issued.</p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">3</span>
            <div>
              <strong>Photograph the letter</strong>
              <p>Attach a clear photo via the case form.</p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">4</span>
            <div>
              <strong>Log as Theft case in DiagnosticHub</strong>
              <p>Watu ops reviews and decides on the account action.</p>
            </div>
          </div>
        </div>
        <div className="pb-callout pb-callout-danger">
          <strong>No letter = no case.</strong> Do not make any promises to the client about
          account suspension, device replacement, or refunds.
        </div>
      </div>
    ),
  },
  {
    id: "unlocking",
    title: "Device Unlocking (Knox Guard / PAYG)",
    icon: "U",
    content: (
      <div className="pb-section-body">
        <p className="pb-intro">
          Watu devices use Knox Guard for PAYG lock enforcement. Most "locked device" complaints
          from clients are a PAYG lock — not a hardware fault. Check this first before logging a
          repair.
        </p>
        <div className="pb-callout pb-callout-info" style={{ marginBottom: "1rem" }}>
          <strong>Identify the lock type before anything else.</strong> A Knox Guard / PAYG lock
          shows the Watu payment screen. A Google FRP lock asks for a Google account. A screen lock
          is the client&apos;s own PIN/pattern.
        </div>
        <div className="pb-steps">
          <div className="pb-step">
            <span className="pb-step-num">1</span>
            <div>
              <strong>PAYG lock — client is in arrears</strong>
              <p>
                Direct the client to make their instalment payment. The device unlocks automatically
                once payment is confirmed by Watu&apos;s system (allow up to 15 minutes). Do not
                log a case.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">2</span>
            <div>
              <strong>PAYG lock — client has paid but device remains locked</strong>
              <p>
                Confirm payment receipt with the client. Contact your EC manager to escalate to Watu
                ops for manual unlock. Log a repair case only if ops cannot resolve remotely.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">3</span>
            <div>
              <strong>Knox Guard showing "Device not enrolled"</strong>
              <p>
                This is a provisioning issue. Escalate to Watu ops immediately — do not attempt any
                factory reset.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">4</span>
            <div>
              <strong>Device stuck on Knox Guard after payment cleared</strong>
              <p>
                Hard reboot: hold Power + Volume Down for 10 seconds. If still locked after reboot,
                escalate to ops.
              </p>
            </div>
          </div>
        </div>
        <div className="pb-callout pb-callout-danger">
          <strong>Never factory reset a PAYG-locked device.</strong> A hard reset removes the Knox
          Guard enrollment and triggers FRP — creating a new problem for the client.
        </div>
      </div>
    ),
  },
  {
    id: "dispatch",
    title: "Logistics & Dispatch",
    icon: "L",
    content: (
      <div className="pb-section-body">
        <p className="pb-intro">
          After a case is logged, the device is collected by Aramex and routed to the appropriate
          ASC. Your job is to prepare the device correctly and hand it over.
        </p>
        <div className="pb-steps">
          <div className="pb-step">
            <span className="pb-step-num">1</span>
            <div>
              <strong>Print the job card</strong>
              <p>
                Download the PDF from DiagnosticHub. Print two copies: one goes with the device,
                one stays at the EC.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">2</span>
            <div>
              <strong>Prepare the device</strong>
              <p>
                Remove the SIM card and hand it back to the client. Package the device securely.
                Attach the job card to the outside of the package.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">3</span>
            <div>
              <strong>Hand over to Aramex</strong>
              <p>
                Give the courier the packaged device and a copy of the job card. Confirm the Aramex
                waybill number and record it.
              </p>
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-step-num">4</span>
            <div>
              <strong>Update the case status</strong>
              <p>
                Mark the case as Dispatched in DiagnosticHub once the courier has collected.
              </p>
            </div>
          </div>
        </div>
        <div className="pb-info-grid">
          <div className="pb-info-item">
            <span className="pb-info-label">Repair → Transtel</span>
            <span className="pb-info-value">Standard ASC routing</span>
          </div>
          <div className="pb-info-item">
            <span className="pb-info-label">FRP → Banana World</span>
            <span className="pb-info-value">ASC code 0006495118</span>
          </div>
          <div className="pb-info-item">
            <span className="pb-info-label">Courier</span>
            <span className="pb-info-value">Aramex</span>
          </div>
          <div className="pb-info-item">
            <span className="pb-info-label">SIM card</span>
            <span className="pb-info-value">Always return to client</span>
          </div>
        </div>
        <div className="pb-callout pb-callout-info">
          Keep the EC copy of the job card on file. The client copy goes with the client as their
          receipt.
        </div>
      </div>
    ),
  },
];

export default function PlaybookPage() {
  const router = useRouter();
  const [open, setOpen] = useState<string>("warranty");

  function toggle(id: string) {
    setOpen((prev) => (prev === id ? "" : id));
  }

  return (
    <div className="pb-page">
      <div className="pb-shell">
        <div className="pb-header">
          <button className="case-back-btn" onClick={() => router.back()} type="button">
            ← Back
          </button>
          <div>
            <h1 className="pb-title">EC Playbook</h1>
            <p className="pb-subtitle">
              Operating procedures for Experience Center agents — Watu Simu after-sales
            </p>
          </div>
        </div>

        <div className="pb-accordion">
          {SECTIONS.map((s) => (
            <div key={s.id} className={`pb-item ${open === s.id ? "pb-item-open" : ""}`}>
              <button
                className="pb-item-header"
                onClick={() => toggle(s.id)}
                type="button"
                aria-expanded={open === s.id}
              >
                <span className="pb-item-icon">{s.icon}</span>
                <span className="pb-item-title">{s.title}</span>
                <span className="pb-chevron">{open === s.id ? "▲" : "▼"}</span>
              </button>
              {open === s.id && <div className="pb-item-body">{s.content}</div>}
            </div>
          ))}
        </div>

        <p className="pb-footer">
          This playbook reflects EC-level procedures only. For branch SOP, contact your EC manager.
        </p>
      </div>
    </div>
  );
}
