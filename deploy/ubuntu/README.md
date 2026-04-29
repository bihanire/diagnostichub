# Ubuntu Deployment Pack

This pack deploys DiagHub behind Apache on Ubuntu with:

- FQDN reverse proxy (`diaghub.watuafrica.co.ug`)
- `systemd` managed backend/frontend services
- automatic git probe + atomic deploy + rollback
- optional GitHub Actions trigger for immediate deploy on new commits

It supports two modes:

- HTTPS mode (default): for WAN/public environments with TLS.
- HTTP-only LAN mode: for private network rollout without Let's Encrypt.

## Deployment Model

1. Apache is the only internet-facing entry point on `:80` and `:443`.
2. FastAPI listens on `127.0.0.1:8000`.
3. Next.js listens on `127.0.0.1:3000`.
4. A timer (`diaghub-autodeploy.timer`) periodically checks `origin/main`.
5. When SHA changes, `deploy.sh` fetches, builds, restarts services, and runs health checks.
6. On failure, it rolls back to the previous known-good SHA.

## Files

- `apache/diaghub.watuafrica.co.ug.conf`: Apache HTTPS vhost template.
- `apache/diaghub.watuafrica.co.ug.http.conf`: Apache HTTP-only LAN template.
- `systemd/diaghub-backend.service`: FastAPI runtime service.
- `systemd/diaghub-frontend.service`: Next.js runtime service.
- `systemd/diaghub-autodeploy.service`: oneshot deploy worker.
- `systemd/diaghub-autodeploy.timer`: periodic update probe.
- `scripts/deploy.sh`: atomic deploy + rollback script.
- `scripts/health-check.sh`: reusable health checks.
- `scripts/install-pack.sh`: installer to wire files on Ubuntu.
- `env/*.example`: sample environment files for backend/frontend/deploy worker.

## Prerequisites

- Ubuntu with `apache2`, `git`, `python3`, `python3-venv`, `nodejs`, `npm`, `curl`.
- DNS record for `diaghub.watuafrica.co.ug` pointing to the server.
- TLS certificate (for example via Certbot) only if using HTTPS mode.
- A GitHub deploy key with read access to this repository.

## Quick Install

Run on the Ubuntu server from this repository root:

```bash
sudo bash deploy/ubuntu/scripts/install-pack.sh \
  --fqdn diaghub.watuafrica.co.ug \
  --repo-url git@github.com:<org>/<repo>.git \
  --branch main
```

### Quick Install (HTTP-only LAN mode)

```bash
sudo bash deploy/ubuntu/scripts/install-pack.sh \
  --fqdn diaghub.watuafrica.co.ug \
  --repo-url git@github.com:<org>/<repo>.git \
  --branch main \
  --http-only
```

Then:

1. Fill `/etc/diaghub/backend.env` using `deploy/ubuntu/env/backend.env.example`.
2. Fill `/etc/diaghub/frontend.env` using `deploy/ubuntu/env/frontend.env.example`.
3. Fill `/etc/diaghub/deploy.env` using `deploy/ubuntu/env/deploy.env.example`.
4. Enable services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now diaghub-backend.service diaghub-frontend.service
sudo systemctl enable --now diaghub-autodeploy.timer
```

5. Enable Apache site:

```bash
sudo a2enmod proxy proxy_http headers ssl rewrite
sudo a2ensite diaghub.watuafrica.co.ug.conf
sudo apachectl configtest
sudo systemctl reload apache2
```

For HTTP-only LAN mode:

```bash
sudo a2enmod proxy proxy_http headers
sudo a2ensite diaghub.watuafrica.co.ug.conf
sudo apachectl configtest
sudo systemctl reload apache2
```

## Manual Deploy Trigger

```bash
sudo systemctl start diaghub-autodeploy.service
sudo journalctl -u diaghub-autodeploy.service -n 200 --no-pager
```

## Health and Status

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8000/ready
curl -fsS http://127.0.0.1:3000 >/dev/null
sudo systemctl status diaghub-backend.service diaghub-frontend.service
sudo systemctl list-timers | grep diaghub-autodeploy
```

## Security Notes

- Keep app ports private (bind to `127.0.0.1`).
- Set `OPS_COOKIE_SECURE=true` in `/etc/diaghub/backend.env` for HTTPS production.
- Set CORS to include `https://diaghub.watuafrica.co.ug`.
- Keep deploy worker env (`/etc/diaghub/deploy.env`) root-readable only.

For HTTP-only LAN mode:

- Use `deploy/ubuntu/env/backend.env.lan.example`.
- Set `OPS_COOKIE_SECURE=false`.
- Restrict LAN access at network/firewall level.

## GitHub Actions Trigger

Use `.github/workflows/deploy-production.yml` with these secrets:

- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_PRIVATE_KEY`
- `PROD_SSH_PORT` (optional, defaults to `22`)

The workflow calls the server-side deploy worker, while the timer remains the resilience fallback.

If your SSH user is not `root`, allow deploy commands in sudoers:

```bash
sudo visudo -f /etc/sudoers.d/diaghub-deploy
```

Example entry:

```text
<ssh-user> ALL=(root) NOPASSWD: /opt/diaghub/bin/deploy.sh, /usr/bin/tail
```
