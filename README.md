# Relational Encyclopedia

Relational Encyclopedia is a guided decision-support web app for after-sales branch teams. It accepts messy customer descriptions, finds the most likely procedure, walks staff through one yes/no question at a time, and returns a plain-language action with customer care guidance.

## High-level architecture

- `frontend/`: Next.js mobile-first UI for search, triage, and result delivery.
- `backend/`: FastAPI service with modular search, triage, and related-procedure engines.
- `backend/app/db/schema.sql`: PostgreSQL schema for procedures, tags, decision nodes, and links.
- Local development defaults to SQLite for quick startup, while PostgreSQL remains the primary production database target.
- `docker-compose.yml`: production-style local stack for Postgres, FastAPI, and Next.js.
- Local browser storage: saves the active triage session so a branch officer can pause and resume.
- Lightweight operator feedback capture: the result screen can now save branch feedback for review.

## Implementation plan delivered

1. Built the PostgreSQL schema and seeded sample procedures with decision trees.
2. Implemented FastAPI endpoints for search, triage start, triage next, and related procedures.
3. Implemented deterministic fuzzy search for sentence input, tag matching, and misspellings.
4. Built a mobile-first Next.js flow with one question per screen, progress tracking, and large answer buttons.
5. Added branch-ready result delivery with immediate action, explanation support, linked follow-ups, and customer scripts.
6. Added RFC and API documentation in `docs/`.

## Project structure

```text
backend/
  app/
    api/routes/
    core/
    db/
    models/
    schemas/
    services/
frontend/
  app/
  components/
  lib/
docs/
  api-reference.md
  knowledge-expansion-batch-001.md
  policy-overlay-map.md
  rfc-001-relational-encyclopedia.md
```

## Key features

- Free-text search with structured intent extraction.
- Guided triage using decision-tree nodes.
- Related-procedure suggestions through linked nodes.
- SOP delivery in clear layers:
  - Immediate action
  - Explanation
  - Related actions
- Customer care prompts for greeting, listening, and expectation setting.
- Resume support for abandoned flows on the same device.
- Structured request logging with `X-Request-ID` tracing.
- Startup workflow validation so broken decision-tree links are caught early.
- Built-in feedback collection from result screens.
- Shared-password protection for ops reporting and CSV export.
- Policy-overlay guidance for warranty, routing, LS, replacement, transfer, and refund handling.

## Sample procedures included

- Phone Not Powering On
- Screen Issue
- Stolen Phone
- Charging Issue
- Overheating or Swollen Battery
- Battery Draining Fast
- Freezing, Hanging, or App Issue
- Random Restart or Safe Mode Issue
- SIM or Network Issue
- Speaker, Microphone, or Audio Issue
- FRP, Password, or Locked Device
- Liquid or Physical Damage
- Repair Ticket, Dispatch, or Legal Status Handling
- Replacement Request Eligibility
- Asset Transfer or Loan Reschedule
- Return, Refund, or Recovered Device Handling

## Local setup

### 1. Fastest local path

The backend now defaults to SQLite for local development, so you can start it without installing PostgreSQL first.

```powershell
.\scripts\bootstrap-backend.ps1
.\scripts\start-backend.ps1
```

For the frontend:

```powershell
.\scripts\bootstrap-frontend.ps1
.\scripts\start-frontend.ps1
```

You can quickly inspect local readiness with:

```powershell
.\scripts\check-local-dev.ps1
```

You can also verify that the configured backend database is reachable:

```powershell
.\scripts\check-local-dev.ps1 -VerifyDatabase
```

You can run an end-to-end local smoke test with:

```powershell
.\scripts\smoke-test-stack.ps1
```

Or point the backend at Postgres for a single run without editing files:

```powershell
.\scripts\smoke-test-stack.ps1 -DatabaseUrl "postgresql+psycopg://<username>:<password>@localhost:5432/relational_encyclopedia"
```

If the backend cannot start because of a database problem such as invalid Postgres credentials, the smoke test now exits early and prints the backend startup log instead of waiting for a generic timeout.

### 2. PostgreSQL path

If you want to use PostgreSQL locally instead of SQLite, create the database and update `backend\.env`. A template is available in `backend\.env.postgres.example`.

```sql
CREATE DATABASE relational_encyclopedia;
```

Optional: apply the schema manually.

```bash
psql -U postgres -d relational_encyclopedia -f backend/app/db/schema.sql
```

The FastAPI app also creates tables automatically on startup.

Example PostgreSQL setting:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/relational_encyclopedia
OPS_AUTH_ENABLED=true
OPS_SHARED_PASSWORD=<set-shared-ops-password>
OPS_SESSION_SECRET=change-me-before-production
```

Current configured backend database:

- `postgresql+psycopg` on `localhost:5432`
- database name: `diaghub`

### 3. Docker compose path

Docker configuration now lives separately from the direct local `.env` files.

Create a compose env file:

```powershell
Copy-Item .env.compose.example .env.compose
```

Before HTTPS rollout, update these values in `.env.compose`:

- `OPS_SHARED_PASSWORD`
- `OPS_SESSION_SECRET`
- `OPS_COOKIE_SECURE=true`
- `BACKEND_CORS_ORIGINS=https://your-frontend-host`
- `FRONTEND_PUBLIC_API_BASE_URL=https://your-api-host`

For a rollout-ready compose starting point, use:

```powershell
Copy-Item .env.compose.production.example .env.compose
```

Start the full stack:

```powershell
docker compose --env-file .env.compose up --build
```

Run it in the background:

```powershell
docker compose --env-file .env.compose up --build -d
```

Stop the stack:

```powershell
docker compose --env-file .env.compose down
```

If you want a clean database reset:

```powershell
docker compose --env-file .env.compose down -v
```

Container endpoints:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

See [docs/deployment-guide.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/deployment-guide.md) for the deployment runbook and CI summary.

### 4. Backend manual setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m app.db.seed
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`.

Useful health endpoints:

- `http://localhost:8000/health`
- `http://localhost:8000/ready`
- `http://localhost:8000/docs`
- `http://localhost:8000/ops/session`

### 5. Frontend manual setup

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

Ops review now uses a separate sign-in route:

- `http://localhost:3000/ops/login`
- `http://localhost:3000/insights`

## Environment variables

### Backend

- `DATABASE_URL`
- `CORS_ORIGINS`
- `SEED_ON_STARTUP`
- `STRICT_WORKFLOW_VALIDATION`
- `LOG_LEVEL`
- `OPS_AUTH_ENABLED`
- `OPS_SHARED_PASSWORD`
- `OPS_SESSION_SECRET`
- `OPS_SESSION_TTL_HOURS`
- `OPS_COOKIE_NAME`
- `OPS_COOKIE_SECURE`

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`

## API summary

- `POST /search`
- `POST /triage/start`
- `POST /triage/next`
- `GET /related/{procedure_id}`
- `GET /health`
- `GET /ready`
- `POST /feedback`
- `POST /ops/login`
- `POST /ops/logout`
- `GET /ops/session`
- `GET /feedback/summary`
- `GET /feedback/by-procedure`
- `GET /feedback/by-branch`
- `GET /feedback/export.csv`

Detailed request and response examples are in [docs/api-reference.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/api-reference.md).

## Test commands

Backend tests:

```powershell
.\scripts\run-backend-tests.ps1
```

Frontend tests:

```powershell
.\scripts\run-frontend-tests.ps1
```

Type checking:

```powershell
cd frontend
npm run typecheck
```

Rollout env validation:

```powershell
.\scripts\check-rollout-env.ps1
```

SOP knowledge audit:

```powershell
cd backend
..\venv\Scripts\python.exe -m app.db.audit_sop --path ..\docs\sop-import-template --markdown ..\docs\sop-import-template\quality-report.md
```

Canonical SOP pack validation:

```powershell
.\scripts\validate-sop-pack.ps1
```

Search benchmark report:

- [search-benchmark-report.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/sop-import-template/search-benchmark-report.md)

## CI and Deployment

- GitHub Actions pipeline: [ci.yml](/C:/Users/eatugonza/Documents/projects/diagnostichub/.github/workflows/ci.yml)
- Deployment runbook: [deployment-guide.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/deployment-guide.md)
- Ubuntu Apache + FQDN deployment pack: [README.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/deploy/ubuntu/README.md)
- Photo library submission pack: [README.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/photo-library-template/README.md)
- SOP import/export pack: [README.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/sop-import-template/README.md)
- SOP quality report: [quality-report.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/sop-import-template/quality-report.md)
- Search benchmark pack: [search-benchmark.csv](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/sop-import-template/search-benchmark.csv)
- Search benchmark report: [search-benchmark-report.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/sop-import-template/search-benchmark-report.md)
- Outcome consistency guide: [outcome-consistency-guide.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/outcome-consistency-guide.md)
- Knowledge expansion batch map: [knowledge-expansion-batch-001.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/knowledge-expansion-batch-001.md)
- Policy overlay map: [policy-overlay-map.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/policy-overlay-map.md)
- Pilot rollout checklist: [pilot-rollout-checklist.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/pilot-rollout-checklist.md)
- Branch UAT script: [uat-branch-officer-script.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/uat-branch-officer-script.md)
- Top five flow UAT pack: [top-five-flow-uat-pack.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/top-five-flow-uat-pack.md)
- Top five flow issue log: [top-five-flow-issue-log-template.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/top-five-flow-issue-log-template.md)
- Top procedure precision review: [top-procedure-precision-review.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/top-procedure-precision-review.md)

## Notes

- The app was designed to stay lightweight and dependency-conscious.
- User-facing text avoids technical jargon where possible.
- The result screen feedback form is intended for branch-learning notes. It should not be used for customer private data.
- Reporting and export routes are protected with a shared ops password and a signed HttpOnly session cookie.
- `backend\.env.production.example` is the rollout-ready backend template for HTTPS environments.
- `.env.compose.production.example` is the rollout-ready compose template for HTTPS environments.
- `docs\sop-import-template` is now the canonical seeded knowledge pack used by backend seeding and validation.
- Docker could not be executed in this workspace because the `docker` CLI is not installed locally here, so container verification should be run on a machine with Docker Desktop or Docker Engine available.
