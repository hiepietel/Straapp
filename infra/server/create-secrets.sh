#!/usr/bin/env bash
# Creates the secrets Straapp reads, straight in the cluster; they never go into git.
#   straapp-postgres  database user and password (generated)
#   straapp-api       Strava client id and secret (asked for), token signing key (generated)
#   ghcr              optional: lets the cluster pull private images from GitHub
#
# Run on the server as the deploy user (or anyone with kubectl access):  ./create-secrets.sh
# Existing secrets are kept unless you pass --replace: changing the database password of a running
# database locks the app out, so it is never replaced silently.
set -euo pipefail

NS=straapp
REPLACE="${1:-}"

kubectl get namespace "$NS" &>/dev/null || kubectl create namespace "$NS"
kubectl label namespace "$NS" pod-security.kubernetes.io/enforce=restricted --overwrite >/dev/null

exists() { kubectl -n "$NS" get secret "$1" &>/dev/null; }
apply_secret() { kubectl -n "$NS" create secret generic "$@" --dry-run=client -o yaml | kubectl apply -f -; }

if exists straapp-postgres && [[ "$REPLACE" != "--replace" ]]; then
  echo "straapp-postgres exists, keeping it."
else
  apply_secret straapp-postgres \
    --from-literal=username=straapp \
    --from-literal=password="$(openssl rand -hex 24)"
fi

if exists straapp-api && [[ "$REPLACE" != "--replace" ]]; then
  echo "straapp-api exists, keeping it (use --replace to enter new Strava keys)."
else
  echo "Strava API keys, from https://www.strava.com/settings/api"
  read -rp  "  Client ID: " client_id
  read -rsp "  Client secret: " client_secret; echo
  apply_secret straapp-api \
    --from-literal=strava-client-id="$client_id" \
    --from-literal=strava-client-secret="$client_secret" \
    --from-literal=auth-signing-key="$(openssl rand -base64 64 | tr -d '\n')"
fi

read -rp "Are the GitHub packages (images) private? Then the cluster needs a token to pull them. [y/N] " private
if [[ "$private" =~ ^[Yy] ]]; then
  echo "A GitHub personal access token (classic) with only the read:packages scope."
  read -rp  "  GitHub user name: " gh_user
  read -rsp "  Token: " gh_token; echo
  kubectl -n "$NS" create secret docker-registry ghcr \
    --docker-server=ghcr.io --docker-username="$gh_user" --docker-password="$gh_token" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

echo
kubectl -n "$NS" get secrets
