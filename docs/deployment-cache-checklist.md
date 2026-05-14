# Deployment And Cache Checklist

Use this when local changes are pushed but the live page still looks old.

## Confirm the Deployed Commit

- Local source: `git rev-parse HEAD`
- Remote source: `git ls-remote origin main`
- Deployment should show the same commit SHA as `origin/main`.
- If the host builds from another branch, update the deployment branch before debugging UI code.

## Required Validation Before Deploy

Run from the repository root unless noted:

- Frontend tests: `cd frontend; npm test`
- Frontend typecheck: `cd frontend; npm run typecheck`
- Frontend production build: `cd frontend; npm run build`
- Frontend standalone route smoke: `.\scripts\smoke-frontend-routes.ps1`
- Backend tests: `cd backend; ..\venv\Scripts\python.exe -m pytest tests`
- SOP/content gate: `.\scripts\validate-sop-pack.ps1`

## Frontend Routing And Gateway

- Production frontend traffic should use `NEXT_PUBLIC_API_BASE_URL=/api`.
- If the deployed app points directly to a stale backend URL, frontend changes may load while API behavior appears old.
- For standalone Next deployments, start from `.next\standalone\server.js`; `next start` is not the correct runtime when `output: standalone` is enabled.

## Cache Checks

- Hard refresh the live page after deploy.
- Open a private/incognito window to rule out browser cache.
- If a service worker is enabled in production, verify it has been updated or temporarily unregister it from DevTools Application > Service Workers.
- Check CDN or host cache purge settings for HTML, JS, and image assets.
- Confirm the browser downloads new `/_next/static/...` asset filenames after deployment.

## UI Regression Checks

- Open `/`, `/families/display`, `/triage`, `/result`, `/ops/login`, and `/insights`.
- Open the Families dropdown and Utilities menu from each route.
- Confirm menus appear above page content, close on outside click, close on Escape, and close after family selection.
- Confirm the light product theme is consistent across redirected routes.
- Confirm result and insights pages show case-packet readiness without claiming a ticket was created.

## Rollback Trigger

Rollback or pause deployment if:

- Any validation command fails.
- Live route smoke returns a non-200 route.
- The app loads old assets after the deploy cache has been purged.
- Ops ticket draft preview ever reports `delivery_enabled=true` before a live integration is approved.
