#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_SOURCE="manual"
FORCE_DEPLOY="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      DEPLOY_SOURCE="${2:-manual}"
      shift 2
      ;;
    --force)
      FORCE_DEPLOY="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-/etc/diaghub/deploy.env}"

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$DEPLOY_ENV_FILE"
  set +a
fi

APP_ROOT="${APP_ROOT:-/opt/diaghub}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
VENV_DIR="${VENV_DIR:-$APP_ROOT/venv}"
BACKEND_DIR="${BACKEND_DIR:-$REPO_DIR/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$REPO_DIR/frontend}"

BACKEND_SERVICE="${BACKEND_SERVICE:-diaghub-backend.service}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-diaghub-frontend.service}"

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8000/health}"
BACKEND_READY_URL="${BACKEND_READY_URL:-http://127.0.0.1:8000/ready}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:3000}"

LOCK_FILE="${LOCK_FILE:-/var/lock/diaghub-deploy.lock}"
STATE_DIR="${STATE_DIR:-/var/lib/diaghub}"
DEPLOY_LOG="${DEPLOY_LOG:-/var/log/diaghub-deploy.log}"
CURRENT_SHA_FILE="$STATE_DIR/current.sha"
LAST_GOOD_SHA_FILE="$STATE_DIR/last-good.sha"

mkdir -p "$(dirname "$LOCK_FILE")" "$STATE_DIR" "$(dirname "$DEPLOY_LOG")"
touch "$DEPLOY_LOG"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  printf '[deploy] another deploy process is already running\n'
  exit 0
fi

log() {
  local message="$1"
  local now
  now="$(date --iso-8601=seconds)"
  printf '%s %s\n' "$now" "$message" | tee -a "$DEPLOY_LOG"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "[deploy] missing command: $1"
    exit 1
  fi
}

for required_cmd in git python3 npm curl systemctl flock; do
  require_command "$required_cmd"
done

if [[ ! -d "$REPO_DIR/.git" ]]; then
  log "[deploy] repository missing at $REPO_DIR"
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/health-check.sh" ]]; then
  log "[deploy] health-check script missing at $SCRIPT_DIR/health-check.sh"
  exit 1
fi

cd "$REPO_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  log "[deploy] repository has local changes; refusing automatic deploy"
  exit 1
fi

if git ls-files --others --exclude-standard | grep -q .; then
  log "[deploy] repository has untracked files; refusing automatic deploy"
  exit 1
fi

previous_sha="$(git rev-parse HEAD)"
target_sha="$previous_sha"
rollback_pending="false"

rollback() {
  if [[ "$rollback_pending" != "true" ]]; then
    return 0
  fi

  log "[deploy] rollback started -> $previous_sha"
  cd "$REPO_DIR"
  git checkout --force "$previous_sha"
  "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" >>"$DEPLOY_LOG" 2>&1
  (cd "$FRONTEND_DIR" && npm ci --no-audit --no-fund >>"$DEPLOY_LOG" 2>&1)
  (cd "$FRONTEND_DIR" && npm run build >>"$DEPLOY_LOG" 2>&1)
  systemctl restart "$BACKEND_SERVICE" "$FRONTEND_SERVICE"
  BACKEND_HEALTH_URL="$BACKEND_HEALTH_URL" \
  BACKEND_READY_URL="$BACKEND_READY_URL" \
  FRONTEND_HEALTH_URL="$FRONTEND_HEALTH_URL" \
  "$SCRIPT_DIR/health-check.sh"
  printf '%s\n' "$previous_sha" >"$CURRENT_SHA_FILE"
  printf '%s\n' "$previous_sha" >"$LAST_GOOD_SHA_FILE"
  rollback_pending="false"
  log "[deploy] rollback complete"
}

on_error() {
  local exit_code="$?"
  log "[deploy] failed (source=$DEPLOY_SOURCE, line=${BASH_LINENO[0]}, exit=$exit_code)"
  rollback || true
  exit "$exit_code"
}
trap on_error ERR

log "[deploy] probe started (source=$DEPLOY_SOURCE)"
git fetch --prune "$GIT_REMOTE" "$DEPLOY_BRANCH"
target_sha="$(git rev-parse "$GIT_REMOTE/$DEPLOY_BRANCH")"

if [[ "$target_sha" == "$previous_sha" && "$FORCE_DEPLOY" != "true" ]]; then
  printf '%s\n' "$previous_sha" >"$CURRENT_SHA_FILE"
  log "[deploy] no new commit on $GIT_REMOTE/$DEPLOY_BRANCH"
  exit 0
fi

log "[deploy] updating $previous_sha -> $target_sha"
rollback_pending="true"
git checkout --force "$target_sha"

if [[ ! -d "$VENV_DIR" ]]; then
  log "[deploy] creating python virtualenv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

log "[deploy] installing backend dependencies"
"$VENV_DIR/bin/pip" install --upgrade pip >>"$DEPLOY_LOG" 2>&1
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" >>"$DEPLOY_LOG" 2>&1

log "[deploy] installing frontend dependencies"
(cd "$FRONTEND_DIR" && npm ci --no-audit --no-fund >>"$DEPLOY_LOG" 2>&1)

log "[deploy] building frontend"
(cd "$FRONTEND_DIR" && npm run build >>"$DEPLOY_LOG" 2>&1)

log "[deploy] restarting services"
systemctl daemon-reload
systemctl restart "$BACKEND_SERVICE" "$FRONTEND_SERVICE"

log "[deploy] running post-deploy health checks"
BACKEND_HEALTH_URL="$BACKEND_HEALTH_URL" \
BACKEND_READY_URL="$BACKEND_READY_URL" \
FRONTEND_HEALTH_URL="$FRONTEND_HEALTH_URL" \
"$SCRIPT_DIR/health-check.sh"

printf '%s\n' "$target_sha" >"$CURRENT_SHA_FILE"
printf '%s\n' "$target_sha" >"$LAST_GOOD_SHA_FILE"
rollback_pending="false"
log "[deploy] success at $target_sha"
