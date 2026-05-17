# API Contract

This project uses semantic versioning for the frontend/backend startup contract.

## Contract endpoint

- `GET /meta`
- Response shape:

```json
{
  "api_version": "1.0.0",
  "schema_version": "1",
  "build": "abc1234"
}
```

## Liveness endpoint

- `GET /health`
- Response shape:

```json
{
  "status": "ok",
  "db": true,
  "version": "1.0.0"
}
```

`status` is `ok` when the lightweight database check passes and `degraded` when it fails. The endpoint still returns HTTP `200` so platform liveness checks do not restart an otherwise reachable process; use `GET /ready` for strict readiness gating.

## Version rules

- `api_version` follows `MAJOR.MINOR.PATCH`.
- The generated OpenAPI schema uses the same `api_version` as `/meta`.
- Frontend expected version is compiled from `NEXT_PUBLIC_EXPECTED_API_VERSION`.
- Startup behavior:
  - **Major mismatch** (`MAJOR` differs): block UI startup and show update-required banner.
  - **Minor mismatch** (`MINOR` differs with same major): allow startup and log warning.
  - **Patch mismatch** (`PATCH` differs with same major/minor): allow startup.

## Schema governance rules

- JSON routes must declare explicit Pydantic response models.
- POST routes with request bodies must use Pydantic request models.
- Text/CSV export routes may use a non-JSON response class instead of a response model.
- Stable endpoint response schema references are tested so accidental contract drift fails in CI.
- Breaking response changes require a major `API_VERSION` update and coordinated frontend rollout.
- Additive response fields are allowed when old clients can safely ignore them.

## Environment controls

Backend:
- `API_META_ENABLED` (`true`/`false`) toggles `/meta`.
- `API_VERSION` sets `api_version`.
- `SCHEMA_VERSION` sets `schema_version`.
- `BUILD_SHA` sets `build`.

Frontend:
- `NEXT_PUBLIC_API_VERSION_CHECK_ENABLED` toggles `/meta` verification.
- `NEXT_PUBLIC_EXPECTED_API_VERSION` sets expected `api_version`.

## Correlation IDs

- Frontend sends `X-Client-Request-ID` for request tracing (toggle with `NEXT_PUBLIC_CLIENT_REQUEST_ID_ENABLED`).
- Backend returns `X-Request-ID` on every response and logs the `(client_request_id, request_id)` pair.
- Backend correlation logic can be toggled with `REQUEST_CORRELATION_ENABLED`.

## Standardized error envelope

When `STANDARDIZE_ERROR_RESPONSES=true`, backend non-2xx responses follow:

```json
{
  "code": "NOT_FOUND",
  "message": "The requested resource was not found.",
  "detail": "Repair family not found.",
  "request_id": "<request-id>"
}
```

Supported `code` values:
- `NOT_READY`
- `AUTH_REQUIRED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `TIMEOUT`
- `UPSTREAM_ERROR`
- `INTERNAL_ERROR`

## Gateway boundary

The frontend must use `NEXT_PUBLIC_API_BASE_URL=/api` in production.
Any other value fails startup to prevent direct backend calls that bypass the Next.js gateway rewrite.
