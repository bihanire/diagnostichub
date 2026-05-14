# DiagnosticHub Final Project Plan

Reviewed: 2026-05-13

## North Star

DiagnosticHub should feel like a learning-first Watu/Samsung diagnostic assistant. It must help a branch officer understand the issue, teach the safest next step, preserve Watu SOP decisions, and produce a clean case packet that can later become a ticket through an approved iPaaS workflow.

The app should not pretend to be a free-form LLM that invents repair answers. It should behave like an intelligent teaching layer over deterministic SOP/search/triage logic, with source-backed context and visible operational guardrails.

## Source Governance

Use vendor documentation as reference context only. Do not copy manuals, tables, or proprietary service text into the product. The product may paraphrase high-level concepts, link back to official pages, and store source IDs for auditability.

Current source families:

- Samsung consumer support: Members diagnostics, Maintenance Mode, battery care, Device Care, moisture warnings, Safe Mode, software updates, screen behavior, factory reset/data risk, lost-device protection.
- Samsung Knox: managed-device policy, Knox Guard lock/unlock states, Knox Configure enrollment, asset/fleet signals.
- iPaaS and webhooks: Power Automate HTTP triggers, Zapier webhooks and REST Hooks, Make webhooks, webhook security and delivery best practices.
- Watu-owned SOP pack: the decision authority for warranty direction, branch routing, evidence, and operational handover.

## Phase 0 - Foundation And Guardrails

Status: implemented in this pass.

- Create a typed knowledge-source registry with reviewed date, vendor, source type, usage permission, copyright posture, and teaching summary.
- Add teaching guidance records that map source context to families, procedure categories, search signals, safe checks, and promises the app must avoid.
- Keep all external references as paraphrase-and-link only.
- Add regression tests that prevent external source text from becoming untracked internal content.

## Phase 1 - Product Teaching Layer

Status: implemented in this pass.

- Add a reusable teaching panel across the app.
- Surface source-backed teaching guidance on the homepage, family routes, triage route, result route, and ops insights.
- Add source IDs to the `CasePacket` type so future ticketing can carry audit context without copying vendor content.
- Keep all existing backend API contracts unchanged.
- Preserve existing deterministic triage and search behavior.

## Phase 2 - Learning Quality Expansion

Status: implemented in the second pass.

Goal: make teaching richer without turning the app into ungoverned advice.

- Build family-specific lesson cards for display, power, logic/software, security/access, connectivity, and physical/liquid.
- Add "why this matters" explanations to common branch decisions.
- Add model-aware caveats where Samsung behavior differs by device, carrier, Android version, One UI version, or Knox state.
- Add multilingual and local phrasing improvements from feedback data.
- Add content-health scoring in ops insights: low helpfulness, repeated wording confusion, high no-match recoveries, and high escalation reversals.

Implemented slice:

- Added typed family lesson cards with first-look checks, model caveats, local phrase examples, and source IDs.
- Added decision teaching notes for visible damage, battery safety, reset risk, managed-device policy, and ticket readiness.
- Added ops content-health signals for helpful rate, top wording watch, no-match recovery rate, and confidence-gate confirmation.
- Surfaced the learning-quality panel on family pages, triage, result, and insights without changing backend response contracts.

## Phase 3 - Case Packet And iPaaS Readiness

Status: implemented in the third pass as preview/readiness infrastructure. No live ticket creation was added.

Goal: make completed diagnoses automation-ready while still not creating tickets yet.

- Freeze a versioned case-packet schema.
- Add export preview for case packet JSON in ops-only context.
- Add idempotency key, source IDs, privacy classification, evidence checklist state, feedback state, and Watu decision metadata.
- Define outbound webhook requirements: signed delivery, retry policy, dead-letter review, payload versioning, and delivery audit logs.
- Validate candidate iPaaS targets: Power Automate, Zapier, Make, or a direct backend webhook consumer.

Implemented slice:

- Added `diagnostichub.case_packet.v1` as the internal case-packet schema version.
- Added idempotency key, event name, privacy classification, evidence state, delivery readiness, and Watu decision metadata to the frontend case packet.
- Added reusable webhook requirements and iPaaS candidate profiles for Power Automate, Zapier, Make, and direct webhook integration.
- Added a current-case automation preview on the result route and an ops-only schema preview on insights.
- Kept ticket sending disabled; all delivery states remain preview/operator-review only.

## Phase 4 - Ticketing Pilot

Status: implemented as dry-run pilot scaffolding only. No ticket persistence, assignment, SLA, external delivery, or status workflow was added.

Goal: introduce ticket creation only after the packet and governance are stable.

- Create a ticket draft endpoint behind ops/admin controls.
- Start with one integration target and one branch pilot.
- Require branch confirmation before sending.
- Store delivery result, external ticket ID, payload version, and retry state.
- Add operator-facing rollback and manual export path.

Implemented slice:

- Added an ops-protected `/ops/ticket-draft/preview` endpoint that validates a case packet and returns dry-run draft fields.
- The endpoint always returns `delivery_enabled=false` and `external_ticket_id=null`.
- Added blockers for incomplete triage, missing evidence, and non-review-ready delivery state.
- Added an ops UI dry-run button using a sample packet so operators can test the contract without customer data movement.
- Left persistence, assignment, SLA, external delivery, and rollback for a future live-ticketing pass.

## Phase 5 - Production Hardening

Status: implemented in the fifth pass as validation automation and deployment/cache guardrails.

Goal: keep the system demo-ready and operations-ready.

- Add browser route smoke tests for homepage, family page, triage, result, ops login, and insights.
- Add visual checks for dropdown stacking, light theme consistency, and responsive text fit.
- Add backend contract tests for search, triage, feedback, telemetry, ops auth, and SOP validation.
- Monitor search confidence drift and branch feedback after every content update.
- Document deployment cache behavior so local changes reliably appear after deployment.

Implemented slice:

- Added a standalone frontend route smoke script for the main deployed routes.
- Added dropdown behavior and CSS layering tests for the top command bar.
- Added a deployment/cache checklist for stale live assets, service workers, route smoke, and gateway configuration.
- Kept backend/SOP validation in the release checklist and extended backend tests in the ticket dry-run pass.

## Acceptance Criteria

- Frontend tests, typecheck, and build pass.
- Backend tests and SOP validation pass.
- All teaching content is paraphrased, source-linked, and traceable by source ID.
- No backend API contract is broken.
- The app reads as one product across homepage, family, triage, result, ops login, and insights.
- The result view can produce a ticket-ready case packet without claiming a ticket was created.

## Remaining Decisions

- Choose the first iPaaS target for pilot.
- Define privacy rules for customer notes and device identifiers before outbound automation.
- Decide whether future Samsung/Knox source review belongs in ops UI or a repo-based review workflow.
- Decide whether to add an actual LLM layer, and if so, keep it retrieval-grounded and subordinate to Watu SOP decisions.
