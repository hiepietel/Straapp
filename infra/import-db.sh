#!/usr/bin/env bash
# Copies your local Straapp database to the server, replacing the server's. Syncing a whole history
# from Strava takes days because of its rate limits; a local database that already has it moves over
# in a minute. Afterwards the server's sync skips every activity it has and fetches only newer ones.
# The database holds only Strava data, no passwords or tokens, so it works on the server as is.
#
#   ./infra/import-db.sh root@your-server        # or: STRAAPP_SERVER=root@your-server ./infra/import-db.sh
#
# Reads the local database with pg_dump (found on PATH or under C:\Program Files\PostgreSQL). Where it is:
#   LOCAL_DB="host=localhost port=5432 user=postgres dbname=straapp"   (the default)
#   PGPASSWORD=...                                                     (or it asks)
# Stop the local API first, so it isn't halfway through writing an activity.
# On Windows, run it from Git Bash.
set -euo pipefail

SERVER="${1:-${STRAAPP_SERVER:-}}"
[[ -n "$SERVER" ]] || { echo "usage: import-db.sh <user@server>   (or set STRAAPP_SERVER)" >&2; exit 1; }
SSH_OPTS=(${SSH_OPTS:-})
LOCAL_DB="${LOCAL_DB:-host=localhost port=5432 user=postgres dbname=straapp}"

PG_DUMP="$(command -v pg_dump || ls -d /c/Program\ Files/PostgreSQL/*/bin/pg_dump.exe 2>/dev/null | sort -V | tail -1 || true)"
[[ -n "$PG_DUMP" ]] || { echo "pg_dump not found; install PostgreSQL's client tools or put them on PATH." >&2; exit 1; }

DUMP="$(mktemp)"
trap 'rm -f "$DUMP"' EXIT

echo "==> Dumping the local database ($LOCAL_DB)"
# Custom format, no owners or grants: it restores under the server's database user.
"$PG_DUMP" -d "$LOCAL_DB" -Fc --no-owner --no-privileges > "$DUMP"
echo "   $(du -h "$DUMP" | cut -f1)"

read -rp "This replaces everything in the database on $SERVER. Continue? [y/N] " answer
[[ "$answer" =~ ^[Yy] ]] || exit 1

echo "==> Restoring on $SERVER"
# The API is stopped meanwhile, and applies any newer migrations when it starts again.
ssh "${SSH_OPTS[@]}" "$SERVER" '
  set -e
  if command -v k3s >/dev/null; then k() { $([ "$(id -u)" -eq 0 ] || echo sudo) k3s kubectl "$@"; }
  else k() { minikube kubectl -- "$@"; }; fi
  k -n straapp scale deploy/straapp-api --replicas=0
  k -n straapp wait --for=delete pod -l app.kubernetes.io/name=straapp-api --timeout=2m || true
  k -n straapp exec statefulset/straapp-postgres -- sh -c \
    '"'"'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d straapp -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'"'"'
  k -n straapp exec -i statefulset/straapp-postgres -- sh -c \
    '"'"'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d straapp'"'"'
  k -n straapp scale deploy/straapp-api --replicas=1
  k -n straapp rollout status deploy/straapp-api --timeout=10m
  k -n straapp exec statefulset/straapp-postgres -- sh -c \
    '"'"'psql -U "$POSTGRES_USER" -d straapp -c "SELECT count(*) AS activities FROM activities;"'"'"'
' < "$DUMP"

echo "==> Done. Log in on the web app; the sync then fetches only what's new."
