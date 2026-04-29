# Deployment Guide

## Overview

The repository now supports a three-service container stack:

- `postgres`: primary relational database
- `backend`: FastAPI API service
- `frontend`: Next.js production server

This keeps Docker-specific environment values separate from local `.env` files that are used for direct development.

## Files Added

- `docker-compose.yml`
- `.env.compose.example`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `.github/workflows/ci.yml`

## Environment Separation

Use the existing files for direct local development:

- `backend/.env`
- `frontend/.env.local`

Use a separate root compose env file for the container stack:

```powershell
Copy-Item .env.compose.example .env.compose
```

For HTTPS rollout or pilot deployment, start from the production-safe template instead:

```powershell
Copy-Item .env.compose.production.example .env.compose
```

The compose file reads values such as:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `BACKEND_CORS_ORIGINS`
- `FRONTEND_PUBLIC_API_BASE_URL`

## Rollout Config Gate

Before pilot rollout, validate the backend and compose environment files:

```powershell
.\scripts\check-rollout-env.ps1
```

This check confirms:

- PostgreSQL is configured instead of SQLite
- ops password and session secret are not placeholders
- secure cookies are enabled for rollout
- frontend and backend public URLs use HTTPS

## Docker Startup

After installing Docker Desktop or Docker Engine, start the stack with:

```powershell
docker compose --env-file .env.compose up --build
```

Run it in the background with:

```powershell
docker compose --env-file .env.compose up --build -d
```

Stop it with:

```powershell
docker compose --env-file .env.compose down
```

Remove volumes as well when you want a clean database reset:

```powershell
docker compose --env-file .env.compose down -v
```

## Service Endpoints

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Backend health: `http://localhost:8000/health`
- Backend docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

## CI Pipeline

The GitHub Actions workflow in `.github/workflows/ci.yml` does three things:

1. Runs backend unit tests.
2. Runs frontend tests, typecheck, and production build.
3. Builds backend and frontend container images and validates the Compose file.

This gives us a useful minimum release gate before deployment.

## Ubuntu + Apache FQDN Pack

For direct Ubuntu hosting behind Apache on a real FQDN (for example `diaghub.watuafrica.co.ug`), use the deployment pack at:

- [deploy/ubuntu/README.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/deploy/ubuntu/README.md)

The pack includes:

- Apache vhost template (`deploy/ubuntu/apache`)
- `systemd` runtime and autodeploy units (`deploy/ubuntu/systemd`)
- atomic deploy + rollback scripts (`deploy/ubuntu/scripts`)
- production env templates (`deploy/ubuntu/env`)
- GitHub Actions production trigger (`.github/workflows/deploy-production.yml`)

This path supports automatic git probe and rollout using `diaghub-autodeploy.timer`, with optional immediate deploy trigger from GitHub Actions on `main` pushes.

## Current Limitation

The current workspace where this pass was implemented does not have Docker installed, so the Docker build and Compose startup could not be executed locally here. The application tests and production frontend build were verified successfully in the existing local toolchain.
