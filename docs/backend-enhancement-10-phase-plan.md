# Backend Enhancement 10-Phase Plan

## North Star

DiagnosticHub's backend should become a dependable learning and diagnostic engine for branch teams: deterministic, explainable, measurable, and ready for future service integrations without prematurely shipping a ticketing system. The backend must keep existing API behavior stable while improving contract safety, knowledge quality, feedback learning, observability, security, and release discipline.

## Guardrails

- Backend only: no frontend code changes in this plan.
- Preserve current public API behavior unless a versioned contract change is explicitly approved.
- Prefer additive fields, typed schemas, validation tests, and observable safety checks over rewrites.
- Keep diagnostics deterministic and grounded in approved internal knowledge. Future language-model behavior must sit behind policy, retrieval, and audit controls.
- Treat ticketing as long-term integration readiness, not an active feature in these phases.

## Phase 1: Foundation Baseline and Operational Contract

Goal: establish a clear backend foundation so deploy and runtime issues are visible before deeper work begins.

Deliverables:
- Document this 10-phase backend roadmap.
- Strengthen `GET /health` into a typed liveness contract: `status`, `db`, and `version`.
- Keep `GET /ready` as the strict readiness probe that can return HTTP `503`.
- Add tests proving health remains HTTP `200` while reporting degraded database state.
- Update API documentation so operations and frontend startup diagnostics share the same expectation.

Exit gate:
- Backend test suite passes.
- `GET /health` and `GET /ready` have separate, documented responsibilities.

Status: executed in this pass.

## Phase 2: API Contract and Schema Governance

Goal: stop silent frontend/backend drift and make contracts reviewable.

Deliverables:
- Ensure every JSON route has an explicit response model.
- Ensure every POST route with a request body uses a Pydantic request model.
- Add route-level contract tests for critical success and error shapes.
- Generate and snapshot or validate the OpenAPI schema in CI.
- Add compatibility rules for additive versus breaking changes.
- Expand `API_CONTRACT.md` with endpoint ownership and versioning expectations.

Exit gate:
- OpenAPI version metadata matches backend `API_VERSION`.
- Critical routes cannot return untyped dictionaries unless they are documented exceptions.
- Stable endpoint schema references are covered by tests.

Status: baseline governance guardrails executed in this pass. Future work can add a stored OpenAPI snapshot once CI ownership is settled.

## Phase 3: Diagnostic Search Quality Engine

Goal: make search and first-match routing more accurate, explainable, and benchmarked.

Deliverables:
- Expand benchmark fixtures from real branch phrasing and failed/no-match searches.
- Add confidence calibration checks for no-match, low-confidence, and ambiguous cases.
- Track why a procedure won: matched terms, category weights, and recovery hints.
- Add regression tests for duplicate or conflicting procedure titles.
- Keep scoring deterministic and source-backed.

Exit gate:
- Search benchmark suite passes with documented thresholds.
- No critical diagnostic family has untested routing examples.

Status: high-order quality guardrails executed in this pass. The search gate now covers canonical routing plus ambiguity, no-match recovery, typo tolerance, and branch-language cases.

## Phase 4: Triage Workflow Integrity

Goal: guarantee guided flows cannot dead-end, loop unexpectedly, or return incomplete outcomes.

Deliverables:
- Strengthen graph validation for every procedure node and transition.
- Detect unreachable nodes, circular branches, missing outcomes, and inconsistent warranty language.
- Add tests for resume safety and invalid-answer handling.
- Add a workflow audit report consumable by ops/release checks.

Exit gate:
- Startup validation catches broken procedure graphs.
- All production flows have complete terminal outcomes.

## Phase 5: Knowledge Repository and Content Pipeline

Goal: make knowledge ingestion safe, reviewable, and teaching-first.

Deliverables:
- Enforce source metadata: topic, reviewed date, owner, summary, and scope.
- Add import validation for duplicated concepts, stale review dates, and unsupported references.
- Keep summaries original and copyright-safe; never store copied external documentation blocks.
- Add freshness reports for content owners.
- Prepare PostgreSQL-backed knowledge tables without forcing a migration in this phase unless approved.

Exit gate:
- SOP/content validation reports freshness and source quality.
- Imports fail loudly on malformed or unsafe content.

## Phase 6: Feedback-to-Content Learning Loop

Goal: convert branch feedback into controlled improvements without letting noisy data mutate production guidance automatically.

Deliverables:
- Cluster repeated failed phrases and low-confidence searches.
- Link feedback to procedure, family, branch label, confidence, and outcome.
- Create review-ready candidate packs for benchmark and content updates.
- Add tests that feedback exports remain stable for ops workflows.

Exit gate:
- Operators can identify top content gaps from backend data.
- No automatic production guidance changes happen without review.

## Phase 7: Observability, Telemetry, and SLOs

Goal: make backend reliability measurable in production.

Deliverables:
- Standardize structured logs with request ID, route, latency, status, and failure category.
- Add route latency histograms and diagnostic success/no-match counters.
- Define SLOs for search, triage, feedback, and ops reporting.
- Add health/readiness telemetry events for deploy monitoring.
- Document incident triage steps.

Exit gate:
- A backend incident can be traced from request ID to route, latency, and failure reason.
- SLO breaches are observable without reading raw application logs.

## Phase 8: Security and Ops Controls

Goal: harden privileged surfaces and sensitive runtime behavior.

Deliverables:
- Audit ops authentication, cookie settings, session expiry, and brute-force protections.
- Add authorization checks around every ops-only route.
- Standardize security headers where backend owns them.
- Add audit events for login, logout, export, and protected-report access.
- Review environment-variable validation and secret handling.

Exit gate:
- Ops-only routes are covered by auth tests.
- Security-sensitive actions are auditable.

## Phase 9: Integration Readiness Without Ticketing

Goal: prepare clean backend contracts for future ticketing and external workflow tools without shipping assignment, SLA, or status management yet.

Deliverables:
- Define a backend-side case packet schema for diagnostic evidence and recommendation export.
- Add idempotency patterns for future outbound integrations.
- Design retry, dead-letter, and webhook validation rules.
- Keep all integration endpoints disabled or internal until product approval.

Exit gate:
- A future ticketing implementation can consume a typed case packet without scraping UI state.
- No live ticketing workflow is exposed.

## Phase 10: Production Release Governance

Goal: make backend changes boring to release and easy to roll back.

Deliverables:
- Establish migration policy, seed-data promotion rules, and rollback playbooks.
- Add release checklists for tests, data validation, API contract snapshots, and smoke tests.
- Gate deployments on readiness, content integrity, and benchmark health.
- Document backup and restore drills.

Exit gate:
- Each release has a repeatable backend go/no-go process.
- Rollback steps are documented and tested.

## Execution Order

Phases should run sequentially unless a production incident forces a targeted security or reliability fix. Each phase ends with tests, documentation updates, and a small changelog or implementation note. The highest-value near-term sequence is Phase 2 contract governance, Phase 3 search quality, then Phase 4 workflow integrity.
