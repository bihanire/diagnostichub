#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND_HEALTH_URL=${BACKEND_HEALTH_URL:-http://127.0.0.1:8000/health}
BACKEND_READY_URL=${BACKEND_READY_URL:-http://127.0.0.1:8000/ready}
FRONTEND_HEALTH_URL=${FRONTEND_HEALTH_URL:-http://127.0.0.1:3000}

ATTEMPTS=${HEALTH_ATTEMPTS:-30}
SLEEP_SECONDS=${HEALTH_SLEEP_SECONDS:-2}

check_url() {
  local name="$1"
  local url="$2"
  local attempt

  for ((attempt = 1; attempt <= ATTEMPTS; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 8 "$url" >/dev/null; then
      printf '[health] %s ok (%s)\n' "$name" "$url"
      return 0
    fi
    sleep "$SLEEP_SECONDS"
  done

  printf '[health] %s failed after %s attempts (%s)\n' "$name" "$ATTEMPTS" "$url" >&2
  return 1
}

check_url "backend health" "$BACKEND_HEALTH_URL"
check_url "backend ready" "$BACKEND_READY_URL"
check_url "frontend" "$FRONTEND_HEALTH_URL"
