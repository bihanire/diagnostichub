# Pilot Rollout Checklist

## Goal

Launch Relational Encyclopedia to a small branch cohort with low operational risk, clear success criteria, and fast feedback loops.

## Recommended pilot scope

- `2-5` branches
- `1-2` branch champions per branch
- `1` ops lead responsible for weekly review
- `1` technical owner responsible for fixes during the pilot
- Pilot duration: `5-10` working days

## Phase 1: Environment readiness

- Confirm PostgreSQL target is correct and reachable.
- Set the real deployment `DATABASE_URL`.
- Set the production frontend host in `CORS_ORIGINS`.
- Set `OPS_COOKIE_SECURE=true`.
- Confirm the real shared ops password is stored securely.
- Confirm the real ops session secret is stored securely.
- Run:

```powershell
.\scripts\check-rollout-env.ps1
```

- If using Docker, create `.env.compose` from `.env.compose.production.example`.
- Replace:
  - `POSTGRES_PASSWORD`
  - `BACKEND_CORS_ORIGINS`
  - `FRONTEND_PUBLIC_API_BASE_URL`
  - any placeholder database host or credentials

## Phase 2: Release verification

- Run backend tests:

```powershell
.\scripts\run-backend-tests.ps1
```

- Run frontend tests:

```powershell
.\scripts\run-frontend-tests.ps1
```

- Run frontend typecheck:

```powershell
cd frontend
npm run typecheck
```

- Run frontend production build:

```powershell
cd frontend
npm run build
```

- If using Docker, start the stack:

```powershell
docker compose --env-file .env.compose up --build -d
```

- Verify:
  - frontend loads
  - backend `/health` returns `ok`
  - backend `/ready` returns `ok`
  - ops login works
  - protected insights routes return `401` before login and `200` after login

## Phase 3: Content readiness

- Review each pilot procedure for wording clarity.
- Confirm each procedure has:
  - search tags
  - customer-care guidance
  - complete yes/no branches
  - related procedures where helpful
- Make sure customer-facing scripts avoid technical jargon.
- Confirm warranty wording matches policy.

## Phase 4: Branch onboarding

- Brief branch champions in a `15-20` minute session.
- Explain the intended use:
  - describe the problem in plain language
  - answer one yes/no question at a time
  - read the customer script before closing the interaction
  - use the feedback form after difficult or unclear cases
- Share:
  - app URL
  - ops insights URL
  - shared ops password with ops leads only

## Phase 5: Pilot execution

- Ask each branch champion to run the UAT script in `docs/uat-branch-officer-script.md`.
- Run the focused flow review in `docs/top-five-flow-uat-pack.md` for:
  - `Phone Not Powering On`
  - `Screen Issue`
  - `Charging Issue`
  - `Freezing, Hanging, or App Issue`
  - `SIM or Network Issue`
- Capture:
  - search misses
  - confusing questions
  - wrong recommendations
  - slow pages or broken screens
  - repeated notes in feedback comments
- Record branch-vs-dispatch errors in `docs/top-five-flow-issue-log-template.md`.

## Phase 6: Daily pilot review

- Review branch feedback at least once per day.
- Check:
  - total submissions
  - not helpful rate
  - procedures with repeated confusion
  - branch notes mentioning missing SOP branches
- Update procedure content quickly when issues repeat.

## Go / no-go criteria for wider rollout

Go forward only if:

- readiness checks stay green
- branch officers complete the core flow without assistance
- no critical misrouting is found in triage
- no protected ops data is exposed without login
- most pilot feedback is neutral-to-positive

Pause wider rollout if:

- multiple searches fail for common issues
- triage produces incorrect outcomes
- ops login or cookie protection is unstable
- branches report that the wording is too complex

## Suggested pilot success metrics

- `80%+` of pilot cases complete without manual escalation caused by app confusion
- `70%+` helpful feedback rate
- zero unauthenticated access to `/insights` or reporting endpoints
- all critical issues fixed within `1` business day
