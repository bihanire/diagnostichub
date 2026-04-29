#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/ubuntu/scripts/install-pack.sh ..." >&2
  exit 1
fi

FQDN="diaghub.watuafrica.co.ug"
APP_USER="diaghub"
APP_GROUP="diaghub"
APP_ROOT="/opt/diaghub"
REPO_URL=""
REPO_BRANCH="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fqdn)
      FQDN="${2:-$FQDN}"
      shift 2
      ;;
    --repo-url)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --branch)
      REPO_BRANCH="${2:-main}"
      shift 2
      ;;
    --app-user)
      APP_USER="${2:-diaghub}"
      APP_GROUP="$APP_USER"
      shift 2
      ;;
    --app-root)
      APP_ROOT="${2:-/opt/diaghub}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PACK_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$APP_ROOT/repo"
BIN_DIR="$APP_ROOT/bin"

echo "[install] ensuring user/group: $APP_USER"
if ! getent group "$APP_GROUP" >/dev/null; then
  groupadd --system "$APP_GROUP"
fi
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$APP_ROOT" --gid "$APP_GROUP" --shell /bin/bash "$APP_USER"
fi

echo "[install] ensuring directories"
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_ROOT" "$BIN_DIR"
install -d -m 0755 -o root -g root /etc/diaghub
install -d -m 0755 -o root -g root /var/lib/diaghub
install -d -m 0755 -o root -g root /var/log

if [[ ! -d "$REPO_DIR/.git" ]]; then
  if [[ -z "$REPO_URL" ]]; then
    echo "[install] repo missing at $REPO_DIR and --repo-url not provided" >&2
    exit 1
  fi
  echo "[install] cloning repository into $REPO_DIR"
  sudo -u "$APP_USER" git clone --branch "$REPO_BRANCH" "$REPO_URL" "$REPO_DIR"
else
  echo "[install] repository already exists at $REPO_DIR"
fi

echo "[install] installing deploy scripts"
install -m 0750 -o root -g root "$PACK_ROOT/scripts/deploy.sh" "$BIN_DIR/deploy.sh"
install -m 0750 -o root -g root "$PACK_ROOT/scripts/health-check.sh" "$BIN_DIR/health-check.sh"

echo "[install] installing environment templates (if missing)"
[[ -f /etc/diaghub/backend.env ]] || install -m 0640 -o root -g "$APP_GROUP" "$PACK_ROOT/env/backend.env.example" /etc/diaghub/backend.env
[[ -f /etc/diaghub/frontend.env ]] || install -m 0640 -o root -g "$APP_GROUP" "$PACK_ROOT/env/frontend.env.example" /etc/diaghub/frontend.env
[[ -f /etc/diaghub/deploy.env ]] || install -m 0640 -o root -g "$APP_GROUP" "$PACK_ROOT/env/deploy.env.example" /etc/diaghub/deploy.env

echo "[install] installing systemd units"
install -m 0644 -o root -g root "$PACK_ROOT/systemd/diaghub-backend.service" /etc/systemd/system/diaghub-backend.service
install -m 0644 -o root -g root "$PACK_ROOT/systemd/diaghub-frontend.service" /etc/systemd/system/diaghub-frontend.service
install -m 0644 -o root -g root "$PACK_ROOT/systemd/diaghub-autodeploy.service" /etc/systemd/system/diaghub-autodeploy.service
install -m 0644 -o root -g root "$PACK_ROOT/systemd/diaghub-autodeploy.timer" /etc/systemd/system/diaghub-autodeploy.timer

echo "[install] installing Apache vhost template"
VHOST_OUT="/etc/apache2/sites-available/${FQDN}.conf"
sed "s/diaghub.watuafrica.co.ug/${FQDN}/g" "$PACK_ROOT/apache/diaghub.watuafrica.co.ug.conf" >"$VHOST_OUT"
chmod 0644 "$VHOST_OUT"

echo "[install] reloading systemd daemon"
systemctl daemon-reload

echo
echo "[install] done"
echo "Next:"
echo "1) Edit /etc/diaghub/backend.env, /etc/diaghub/frontend.env, /etc/diaghub/deploy.env"
echo "2) Enable services: systemctl enable --now diaghub-backend.service diaghub-frontend.service diaghub-autodeploy.timer"
echo "3) Enable Apache modules/site:"
echo "   a2enmod proxy proxy_http headers ssl rewrite"
echo "   a2ensite ${FQDN}.conf"
echo "   apachectl configtest && systemctl reload apache2"
