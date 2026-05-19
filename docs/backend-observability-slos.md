# Backend Observability And SLOs

DiagnosticHub backend observability is designed for fast incident triage without changing diagnostic behavior. The current implementation is intentionally lightweight: structured JSON logs, request correlation, in-memory telemetry, and ops-only summaries.

## Request Tracing

Every request receives an `X-Request-ID` response header. If the frontend sends `X-Client-Request-ID`, the backend adopts it as the request ID; otherwise it generates one.

Use this ID to connect:

1. frontend error banners
2. backend JSON logs
3. telemetry `recent_events`
4. route latency and failure-category metrics

## Structured Log Fields

Backend logs include:

- `request_id`
- `event`
- `method`
- `path`
- `route`
- `status_code`
- `duration_ms`
- `failure_category`

Failure categories are normalized as:

- `unauthorized`
- `forbidden`
- `not_found`
- `validation_error`
- `rate_limited`
- `server_error`
- `unhandled_exception`
- `client_error`

## SLO Targets

These targets are reported from `GET /ops/telemetry/summary`.

| SLO | Route | p95 target | Error-rate target |
|---|---:|---:|---:|
| Search response | `POST /search` | 750 ms | <= 2% |
| Triage start response | `POST /triage/start` | 500 ms | <= 2% |
| Triage answer response | `POST /triage/answer` | 500 ms | <= 2% |
| Feedback submission | `POST /feedback` | 500 ms | <= 3% |
| Health liveness | `GET /health` | 150 ms | 0% |
| Readiness probe | `GET /ready` | 300 ms | 0% |
| Ops telemetry summary | `GET /ops/telemetry/summary` | 750 ms | <= 2% |

## Incident Triage Steps

1. Ask for the frontend `Request ID` or copy it from the failing API response header.
2. Search backend logs for the same `request_id`.
3. Check `GET /ops/telemetry/summary` for the route's p95, error rate, and `failure_categories`.
4. If `/health` is degraded, check database connectivity first.
5. If `/ready` is degraded, inspect `failed` checks for `db`, `required_env`, `workflow_validation`, or `data_integrity`.
6. If search quality is affected, compare `search.no_match_rate`, `search.review_required_rate`, and confidence-state counts against recent content changes.
7. If feedback reporting is affected, check `POST /feedback` SLO status and recent `feedback_saved` or `feedback_rejected` events.

## Production Notes

- `/health` stays HTTP 200 for liveness, even when reporting `status: degraded`.
- `/ready` returns HTTP 503 when deploy readiness checks fail.
- Telemetry is in memory and resets on process restart. It is useful for live triage, not long-term analytics.
- No customer issue text is stored in telemetry event metadata; detailed content remains in the existing database-backed feedback/search flows.
