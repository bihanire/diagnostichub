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

## Version rules

- `api_version` follows `MAJOR.MINOR.PATCH`.
- Frontend expected version is compiled from `NEXT_PUBLIC_EXPECTED_API_VERSION`.
- Startup behavior:
  - **Major mismatch** (`MAJOR` differs): block UI startup and show update-required banner.
  - **Minor mismatch** (`MINOR` differs with same major): allow startup and log warning.
  - **Patch mismatch** (`PATCH` differs with same major/minor): allow startup.

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

## Gateway boundary

The frontend must use `NEXT_PUBLIC_API_BASE_URL=/api` in production.
Any other value fails startup to prevent direct backend calls that bypass the Next.js gateway rewrite.
