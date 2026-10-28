#!/usr/bin/env bash
set -Eeuo pipefail

revision=${1:?Pass the tested Git commit SHA}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA' >&2; exit 1; }
cd /home/ubuntu/moctruyen

# Also serialize manual deploys with workflow deploys.
exec 9>/home/ubuntu/.moc-deploy.lock
flock -w 1200 9
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || {
  echo 'Tracked files have local changes; commit or resolve them before deploy.' >&2
  exit 1
}
[[ "$(git branch --show-current)" == main ]] || { echo 'Expected main branch' >&2; exit 1; }
GIT_TERMINAL_PROMPT=0 git fetch origin main
# An older queued run must never deploy over a newer main revision.
if [[ "$(git rev-parse origin/main)" != "$revision" ]]; then
  echo 'A newer main commit exists; skipping stale deployment.'
  exit 0
fi
git merge --ff-only "$revision"
cd TruyenBackend
test -s .docker.env || { echo 'Missing server .docker.env with database password' >&2; exit 1; }

# Server secrets first, tracked deployment settings second (override stale CORS).
unset CORS_ORIGINS API_PORT
compose=(docker compose --env-file .docker.env --env-file docker/production.env)
"${compose[@]}" config --quiet
# Build while the previous API container keeps serving requests.
"${compose[@]}" build api
"${compose[@]}" up -d --wait --wait-timeout 120 db
"${compose[@]}" run --rm --no-deps migrate
# The image startup seeds its bundled data; no web/static seed service is started.
"${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 300 api
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8000/ready
printf '\nDeployed %s\n' "$revision"
