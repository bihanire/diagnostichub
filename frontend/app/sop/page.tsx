"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SECTIONS = [
  { id: "repair-type",   title: "Identifying Repair Type" },
  { id: "iw-repair",    title: "In-Warranty Repair" },
  { id: "oow-repair",   title: "Out-of-Warranty Repair" },
  { id: "theft",        title: "Theft Reporting" },
  { id: "return",       title: "Device Return" },
  { id: "recovery",     title: "Device Recovery" },
  { id: "status",       title: "Following Up on Repair Status" },
  { id: "post-repair",  title: "Post-Repair Handover" },
  { id: "unlocking",    title: "Device Unlocking" },
  { id: "dispatch",     title: "Aramex Dispatch" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function SopPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) setTimeout(() => scrollTo(hash), 80);
  }, []);

  return (
    <div className="pb-page">
      <div className="pb-header">
        <div>
          <h1 className="pb-title">EC After-Sales Process Guide</h1>
          <p className="pb-subtitle">
            Step-by-step procedures for repairs, returns, theft, recovery, and dispatch.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => router.back()}
          type="button"
        >
          ← Back
        </button>
      </div>

      <div className="sop-layout">

        {/* ── Sticky table of contents ── */}
        <nav className="sop-toc" aria-label="Page sections">
          <p className="sop-toc-heading">On this page</p>
          <ol className="sop-toc-list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  className="sop-toc-link"
                  onClick={() => scrollTo(s.id)}
                  type="button"
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* ── Main content ── */}
        <main className="sop-content">

          {/* 1 — Identifying Repair Type */}
          <section id="repair-type" className="sop-section">
            <h2 className="sop-section-title">1. Identifying Repair Type</h2>
            <p className="pb-intro">
              Before logging a ticket or filling a job card, establish whether the fault is
              In-Warranty (IW) or Out-of-Warranty (OOW). This determines the repair path and
              what — if anything — the customer pays.
            </p>

            <div className="pb-info-grid" style={{ marginBottom: "1rem" }}>
              <div className="pb-info-item">
                <span className="pb-info-label">In-Warranty (IW)</span>
                <span className="pb-info-value">
                  Manufacturer-originating faults — overheating, freezing, battery failure,
                  software issues. No cost to the customer; Watu covers repair and transport.
                </span>
              </div>
              <div className="pb-info-item">
                <span className="pb-info-label">Out-of-Warranty (OOW)</span>
                <span className="pb-info-value">
                  Physical damage or misuse — broken screen, water damage, device tampered with or
                  taken to an unauthorised repair shop. The customer or Watu (30/70 arrangement)
                  covers cost.
                </span>
              </div>
            </div>

            <p className="pb-intro" style={{ marginBottom: "0.5rem" }}>
              Use the table below to match the customer complaint to a defect category:
            </p>
            <table className="pb-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Defects</th>
                  <th>Category</th>
                  <th>Defects</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowSpan={6}><strong>Power &amp; Charging</strong></td>
                  <td>Not charging / Stops charging</td>
                  <td rowSpan={8}><strong>Screen &amp; Display</strong></td>
                  <td>Broken / cracked screen or back cover</td>
                </tr>
                <tr><td>Phone not powering on</td><td>Blank screen / not displaying</td></tr>
                <tr><td>Switches off by itself</td><td>Blacked out</td></tr>
                <tr><td>Device heats up</td><td>Lines / shaky / flickering screen</td></tr>
                <tr><td>Battery drains fast</td><td>Screen frozen</td></tr>
                <tr><td>Stuck on Samsung logo</td><td>Touch not sensing</td></tr>
                <tr>
                  <td rowSpan={4}><strong>Audio &amp; Speaker</strong></td>
                  <td>Sound issues / no sound</td>
                  <td>Blurry screen</td>
                </tr>
                <tr><td>Speaker / volume issues</td><td>Screen responding by itself</td></tr>
                <tr>
                  <td>Not heard when calling</td>
                  <td rowSpan={4}><strong>Software &amp; Lock</strong></td>
                  <td>Forgot password</td>
                </tr>
                <tr><td>Cannot hear caller</td><td>Stuck in Safe Mode / Flight Mode</td></tr>
                <tr>
                  <td rowSpan={2}><strong>Camera</strong></td>
                  <td>Broken camera</td>
                  <td>Apps not responding</td>
                </tr>
                <tr><td>Camera app not responding</td><td>Refuses software updates</td></tr>
                <tr>
                  <td rowSpan={4}><strong>Physical Damage</strong></td>
                  <td>Fell in water / liquid damage</td>
                  <td rowSpan={4}><strong>Connectivity &amp; Network</strong></td>
                  <td>Not reading SIM / broken SIM tray</td>
                </tr>
                <tr><td>Device is burnt</td><td>Network issues / no signal</td></tr>
                <tr><td>Broken back cover / device bent</td><td>Internet / Wi-Fi not connecting</td></tr>
                <tr><td>Cannot access keyboard</td><td>Not making / receiving calls</td></tr>
              </tbody>
            </table>
          </section>

          {/* 2 — In-Warranty Repair */}
          <section id="iw-repair" className="sop-section">
            <h2 className="sop-section-title">2. In-Warranty Repair</h2>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Log a repair ticket</strong><p>Raise the ticket via the aftersales system. The job card will be generated and sent to your email.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div><strong>Print and fill in the job card</strong><p>Record the customer address and PIN / password / pattern on the job card.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Sign off</strong><p>Both you (Branch Officer) and the customer sign the job card. The pattern or password must be indicated.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">4</span>
                <div><strong>Scan and upload</strong><p>Upload a digital copy of the signed job card into the aftersales system.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">5</span>
                <div>
                  <strong>Affix the device sticker</strong>
                  <p>Tear off the last section of the job card (device sticker). Attach it securely to the device with double-sided tape. Attach the full job card to the device as well.</p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">6</span>
                <div><strong>Arrange pickup</strong><p>Send an Aramex pickup request. See <button className="sop-inline-link" onClick={() => scrollTo("dispatch")} type="button">Aramex Dispatch</button> for packaging rules.</p></div>
              </li>
            </ol>
            <div className="pb-callout pb-callout-warning">
              <strong>No accessories.</strong> Do not send back cover, SIM card, box, or any accessory with the device.
            </div>
          </section>

          {/* 3 — Out-of-Warranty Repair */}
          <section id="oow-repair" className="sop-section">
            <h2 className="sop-section-title">3. Out-of-Warranty Repair</h2>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Log a repair ticket</strong><p>Raise the ticket via the aftersales system. The job card will be generated and sent to your email.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div>
                  <strong>Print and fill in the job card</strong>
                  <p>Record customer details, PIN / password / pattern, and — for self-pay cases — the paying phone number, transaction ID, and date of payment.</p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Sign off</strong><p>Both you and the customer sign the job card.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">4</span>
                <div><strong>Scan and upload</strong><p>Upload a digital copy of the signed job card into the aftersales system.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">5</span>
                <div>
                  <strong>Affix the device sticker</strong>
                  <p>Tear off the last section of the job card. Attach it to the device with double-sided tape.</p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">6</span>
                <div><strong>Arrange pickup to Watu HQ</strong><p>OOW devices go to Watu HQ — not directly to Transtel. See <button className="sop-inline-link" onClick={() => scrollTo("dispatch")} type="button">Aramex Dispatch</button>.</p></div>
              </li>
            </ol>

            <div className="pb-callout pb-callout-info" style={{ marginBottom: "0.75rem" }}>
              <strong>Forgotten passwords</strong> are treated as OOW. The customer pays UGX 25,000 before the device is dispatched.
            </div>
            <div className="pb-callout pb-callout-info">
              <strong>30/70 Repairs</strong> — if the client cannot pay the full repair cost, they may be eligible for a Watu-funded repair arrangement. Contact the Aftersales Team before proceeding.
            </div>
            <div className="pb-callout pb-callout-warning" style={{ marginTop: "0.75rem" }}>
              <strong>No accessories.</strong> Do not send back cover, SIM card, box, or any accessory with the device.
            </div>
          </section>

          {/* 4 — Theft Reporting */}
          <section id="theft" className="sop-section">
            <h2 className="sop-section-title">4. Theft Reporting</h2>

            <p className="pb-intro"><strong>Customer requirement:</strong> The client must bring an A4 police abstract that includes:</p>
            <ul className="sop-list">
              <li>Client name</li>
              <li>Phone number</li>
              <li>IMEI of the stolen device</li>
            </ul>

            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div>
                  <strong>No abstract yet?</strong>
                  <p>If the customer does not have a police abstract, raise a <em>Stolen w/o Abstract</em> request and advise them to obtain one.</p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div><strong>Verify the abstract</strong><p>Confirm its authenticity before proceeding.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Log a theft ticket</strong><p>Raise via the aftersales system.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">4</span>
                <div><strong>Request Stolen legal status</strong><p>Raise a <em>Stolen</em> status request. The status will not be applied until the abstract is uploaded.</p></div>
              </li>
            </ol>
            <div className="pb-callout pb-callout-danger">
              <strong>Do not request Stolen status without uploading the police abstract.</strong> Failure to follow this process will be recorded as an error.
            </div>
          </section>

          {/* 5 — Device Return */}
          <section id="return" className="sop-section">
            <h2 className="sop-section-title">5. Device Return</h2>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Verify eligibility</strong><p>Confirm the IMEI / loan account is not on the Counter Flash Campaign List or Reported Thefts list.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div><strong>Confirm identity</strong><p>Only the original owner of the device is eligible for a refund. Verify their ID.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Factory reset</strong><p>Collect the phone password and perform a factory reset on the device.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">4</span>
                <div><strong>Fill and sign the return form</strong><p>Complete the official return form with the customer and have both parties sign.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">5</span>
                <div><strong>Log a return ticket</strong><p>Raise via the aftersales system.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">6</span>
                <div><strong>Scan and upload the signed return form</strong></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">7</span>
                <div>
                  <strong>Affix the device sticker</strong>
                  <p>Tear off the last section of the return form (device sticker). Attach it to the device with double-sided tape.</p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">8</span>
                <div><strong>Log device in incoming records</strong><p>Record the device as received at the branch.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">9</span>
                <div><strong>Arrange Aramex pickup</strong><p>See <button className="sop-inline-link" onClick={() => scrollTo("dispatch")} type="button">Aramex Dispatch</button>.</p></div>
              </li>
            </ol>

            <p className="sop-sub-heading">Refund policy</p>
            <ul className="sop-list">
              <li>No refund if the device is damaged.</li>
              <li>No refund if a replacement device is being returned.</li>
              <li>No refund for devices returned after the loan has matured.</li>
              <li>No refund if returned by a third party.</li>
            </ul>
          </section>

          {/* 6 — Device Recovery */}
          <section id="recovery" className="sop-section">
            <h2 className="sop-section-title">6. Device Recovery</h2>

            <p className="sop-sub-heading">Standard Recovery — device recovered by the borrower</p>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Log a Standard Recovery ticket</strong><p>Raise via the aftersales system.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div><strong>Request Remove LS</strong><p>Raise a <em>Remove LS</em> request to reverse the Stolen legal status.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Request Nexus re-enable</strong><p>Contact the Simu Admin team to re-enable Nexus for the device.</p></div>
              </li>
            </ol>

            <p className="sop-sub-heading" style={{ marginTop: "1rem" }}>Third-Party Recovery — device recovered by someone other than the borrower</p>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Verify the third party</strong><p>Confirm they do not know the borrower.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div><strong>Collect their details</strong><p>National ID copy, phone number, and photos of the third party and their ID.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Arrange shipment to Watu HQ</strong><p>Log the device and dispatch it.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">4</span>
                <div><strong>Notify the Aftersales Team</strong><p>Contact simurepairs with the subject: <em>Third Party Recovery [IMEI / Loan Number]</em> including the third party's name, NIN, and phone number.</p></div>
              </li>
            </ol>
            <div className="pb-callout pb-callout-danger">
              <strong>Failure to follow the recovery process will result in an error being recorded.</strong>
            </div>
          </section>

          {/* 7 — Repair Status */}
          <section id="status" className="sop-section">
            <h2 className="sop-section-title">7. Following Up on Repair Status</h2>
            <p className="pb-intro">
              Search the device IMEI in the Aftersales Master Queries sheet under the
              <strong> UG_repairs</strong> tab. Key columns:
            </p>
            <table className="pb-table" style={{ marginBottom: "1.25rem" }}>
              <thead>
                <tr><th>Column</th><th>What it shows</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>P</strong></td><td>Date device was received at the service centre</td></tr>
                <tr><td><strong>T</strong></td><td>Part needed for repair</td></tr>
                <tr><td><strong>U</strong></td><td>Device status — <em>Ready</em> means at Transtel, ready for dispatch</td></tr>
                <tr><td><strong>V</strong></td><td>Delay reason (waiting for parts / awaiting Samsung approval)</td></tr>
                <tr><td><strong>X</strong></td><td>Dispatch date — date the courier was called to collect from Transtel</td></tr>
              </tbody>
            </table>

            <p className="pb-intro"><strong>Common technician abbreviations:</strong></p>
            <table className="pb-table">
              <thead>
                <tr><th>Category</th><th>Abbreviation</th><th>Meaning</th></tr>
              </thead>
              <tbody>
                <tr><td rowSpan={4}><strong>Motherboard / PBA</strong></td><td>PBA / PCB</td><td>Needs motherboard</td></tr>
                <tr><td>Sub PBA</td><td>Needs sub-motherboard</td></tr>
                <tr><td>PBA/PCB/OOW</td><td>Needs motherboard — not repaired (Out of Warranty)</td></tr>
                <tr><td>Sub PBA/OOW</td><td>Needs sub-motherboard — not repaired (Out of Warranty)</td></tr>
                <tr><td rowSpan={3}><strong>Screen / LCD</strong></td><td>LCD</td><td>Needs screen</td></tr>
                <tr><td>OOW/LCD</td><td>Out of Warranty — not repaired, needs screen</td></tr>
                <tr><td>OOW/LCD QR NOT MATCH</td><td>Out of Warranty — screen not original (changed by client), needs original screen</td></tr>
                <tr><td rowSpan={5}><strong>Other</strong></td><td>FRP WATU PAID</td><td>Factory reset — paid by client or Watu</td></tr>
                <tr><td>Ready</td><td>Ready for dispatch from Transtel</td></tr>
                <tr><td>Ready/OOW</td><td>Out of Warranty — not repaired, ready for dispatch</td></tr>
                <tr><td>BER</td><td>Beyond Economical Repair</td></tr>
                <tr><td>Chassis</td><td>Phone housing / physical body</td></tr>
              </tbody>
            </table>
          </section>

          {/* 8 — Post-Repair Handover */}
          <section id="post-repair" className="sop-section">
            <h2 className="sop-section-title">8. Post-Repair Device Handover</h2>
            <p className="pb-intro">Steps to complete when a repaired device arrives back at the branch, before handing it to the customer.</p>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Log receipt</strong><p>Record the device in the incoming device log.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div><strong>Request Remove LS</strong><p>Raise a <em>Remove LS</em> request to reverse the Watu Repairs legal status.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Verify Watu App credentials</strong><p>Ensure the customer remembers their Watu App login. Perform a PIN reset if needed.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">4</span>
                <div>
                  <strong>Brief the customer on the Watu App</strong>
                  <p>Cover: Temporary Unlock, paying via the app, Transaction History, how much to pay.</p>
                </div>
              </li>
            </ol>
            <div className="pb-callout pb-callout-warning">
              <strong>30-day collection rule.</strong> If the client fails to collect their repaired device within 30 days, it is considered surrendered to Watu and will be marked as returned. No compensation or refund will be made.
            </div>
          </section>

          {/* 9 — Device Unlocking */}
          <section id="unlocking" className="sop-section">
            <h2 className="sop-section-title">9. Device Unlocking</h2>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div>
                  <strong>Verify minimum daily payment</strong>
                  <p>In MIFOS, check the last payment amount. It must be ≥ the minimum daily payment.</p>
                  <p style={{ marginTop: "0.25rem" }}>Formula: <strong>Daily Payment = Weekly Payment ÷ 7</strong></p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div>
                  <strong>Unlock the device</strong>
                  <p>If the device has internet access — use <em>Send TMP Unlock</em> to unlock remotely.</p>
                  <p>If the device has no internet — use <em>Unlock PIN</em> to retrieve the offline code and enter it on the support screen.</p>
                </div>
              </li>
            </ol>

            <p className="sop-sub-heading">Customer self-unlock instructions</p>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Prepare the device</strong><p>VPN off. One SIM card inserted with active data.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div>
                  <strong>Pay via the Watu App</strong>
                  <p>Open the Watu App → confirm the correct payment amount → pay. A mobile money debit prompt will appear. Enter Mobile Money PIN to complete.</p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div>
                  <strong>If device is locked</strong>
                  <p>Tap <em>Temporarily Unlock</em> in the Watu App to pay via USSD instead.</p>
                </div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">4</span>
                <div><strong>Confirm payment</strong><p>Check <em>Transaction History</em> in the Watu App to verify the payment is reflected correctly.</p></div>
              </li>
            </ol>
          </section>

          {/* 10 — Aramex Dispatch */}
          <section id="dispatch" className="sop-section">
            <h2 className="sop-section-title">10. Aramex Dispatch</h2>

            <div className="pb-callout pb-callout-danger" style={{ marginBottom: "1rem" }}>
              <strong>OOW devices do not go directly to Transtel.</strong> Out-of-warranty (physically damaged) devices must be routed to Watu HQ. Aramex will not accept damaged devices destined for Transtel.
            </div>

            <p className="sop-sub-heading">Packaging rules</p>
            <ul className="sop-list">
              <li>Always separate <strong>Watu HQ devices</strong> (OOW, returns, recoveries) from <strong>Transtel devices</strong> (IW) — they must never be in the same package.</li>
              <li>Maximum <strong>5 devices</strong> per package.</li>
              <li>Wrap all devices in <strong>bubble wrap</strong>. Request bubble wrap from the Aftersales Team if needed.</li>
              <li>Do not include employee devices in the same package as customer devices.</li>
            </ul>

            <p className="sop-sub-heading">Waybill rules</p>
            <ul className="sop-list">
              <li>Every waybill must list all IMEIs inside the package.</li>
              <li>Include the correct receiver name: <em>Transtel</em> or <em>Watu SIMU HQ</em>.</li>
            </ul>

            <p className="sop-sub-heading">Pickup request</p>
            <p className="pb-intro">
              A pickup request must be sent to Aramex for <strong>every single device</strong>, regardless of destination or reason (return, IW, OOW, uncollected, etc.).
            </p>
            <p className="pb-intro">Include in every pickup request email:</p>
            <ul className="sop-list">
              <li>Origin branch location</li>
              <li>Number of devices</li>
              <li>Job card number(s)</li>
              <li>IMEI number(s)</li>
            </ul>
            <p className="pb-intro">Use subject line: <strong>Pick Up Request [Branch Name]</strong></p>

            <p className="sop-sub-heading">When the courier arrives</p>
            <ol className="pb-steps">
              <li className="pb-step">
                <span className="pb-step-num">1</span>
                <div><strong>Log the device out</strong><p>Follow the outgoing device procedure in the branch tracking system.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">2</span>
                <div><strong>Enter the waybill number</strong><p>For Aramex: use the Aramex waybill. For in-house courier: format is <code>MSD-Date[dd/mm/yyyy]</code> e.g. EUG1005-20Feb2025.</p></div>
              </li>
              <li className="pb-step">
                <span className="pb-step-num">3</span>
                <div><strong>Upload the waybill</strong><p>Use the Doc Upload Ticket link. For in-house courier, photograph the courier holding the device(s) and upload as the waybill document.</p></div>
              </li>
            </ol>
          </section>

        </main>
      </div>
    </div>
  );
}
