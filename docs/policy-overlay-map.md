# Policy Overlay Map

## Purpose

This document explains how the general SOP rules should be applied inside Diagnosis Hub without replacing complaint-led triage logic.

## Design rule

- Complaint logs define the search and triage trees.
- SOP policy defines warranty framing, legal-status routing, documentation, dispatch, replacement, transfer, return, and recovery rules.

## Overlay groups and mapped procedures

## 1. Warranty and repair routing

Mapped procedures:

- `Phone Not Powering On`
- `Charging Issue`
- `Overheating or Swollen Battery`
- `Battery Draining Fast`
- `Freezing, Hanging, or App Issue`
- `Liquid or Physical Damage`
- `Repair Ticket, Dispatch, or Legal Status Handling`

Applied rules:

- In-warranty means manufacturer-originating issues only.
- In-warranty examples include overheating, freezing, and certain battery faults.
- In-warranty repair and transport are at no cost to the customer.
- Out-warranty includes physical damage, liquid damage, tampering, and forgotten-password handling.
- Out-warranty devices must not go directly to Transtel.
- Out-warranty repair assessment goes to Watu SIMU HQ first.

## 2. Forgotten password and access recovery

Mapped procedures:

- `FRP, Password, or Locked Device`
- `Repair Ticket, Dispatch, or Legal Status Handling`

Applied rules:

- Forgotten password is out-warranty.
- Customer pays UGX 25,000 directly to Transtel for processing.
- Forgotten-password handling still requires `Self Repairs LS`.

## 3. Repair logging, dispatch, and legal status

Mapped procedures:

- `Repair Ticket, Dispatch, or Legal Status Handling`

Applied rules:

- Every movement must be recorded in Incoming and Outgoing tracking.
- Branch Aftersales Sheet must reflect full traceability.
- All signed forms and waybills must be uploaded digitally immediately.
- Device stickers must be attached before dispatch.
- In-warranty and out-warranty devices must be separated.
- Waybills must list all IMEIs and the correct receiver.
- Pick-up requests must be sent for every dispatch.
- LS changes go through the IT Service Desk path with the required Excel attachment.

## 4. Theft, stolen LS, and replacement eligibility

Mapped procedures:

- `Stolen Phone`
- `Replacement Request Eligibility`

Applied rules:

- `Stolen` LS only after police abstract upload.
- `Stolen w/o Abstract` may be used when the abstract is not yet available.
- Replacement requires both:
  - at least 10 weekly payments
  - verified stolen LS
- BER replacement requires returned-device status handling first.
- Only one replacement is allowed.
- Replacement processing uses OBS with Loan Type `Repossessed`.

## 5. Asset transfer and loan reschedule

Mapped procedures:

- `Asset Transfer or Loan Reschedule`

Applied rules:

- Old owner must have no arrears.
- Old and new owner must appear with National IDs.
- Transfer agreement must be signed.
- Transfers are restricted for overdue or nearly cleared loans.
- Death cases require death certificate and arrears clearance before NOK transfer.
- Reschedule requires repair-centre fault confirmation and more than 15 days without Watu Repairs status.

## 6. Returns, refunds, and recovered devices

Mapped procedures:

- `Return, Refund, or Recovered Device Handling`

Applied rules:

- Refund is owner-only.
- No refund for damaged devices, replacement returns, matured-loan returns, or third-party returns.
- Password collection and factory reset are mandatory for returns.
- Refund deductions depend on condition, accessories, and FRP handling.
- Third-party recoveries require ID capture, email notification, and reward handling.
- Recovered devices stay in storage until rightful-owner verification.

## 7. Recovery, unlock, and post-repair access

Mapped procedures:

- `Stolen Phone`
- `Return, Refund, or Recovered Device Handling`
- `Repair Ticket, Dispatch, or Legal Status Handling`

Applied rules:

- Remove LS after repair when required.
- Borrower recovery requires Remove LS plus at least one day of payment before device use resumes.
- Manual unlocking requires payment compliance.
- Automatic unlocking requires one SIM, active data, and VPN off.

## Operational note

These rules should remain concise inside the app interface.
The app should guide branch action, not reproduce the entire SOP verbatim on every screen.
