#!/usr/bin/env bash
# One-time setup of a fresh Linux server for Straapp: k3s (Kubernetes with Traefik and local storage
# built in), cert-manager with a Let's Encrypt issuer, and kubectl access for the deploy user.
#
# Run as root from a copy of the repo's infra/ folder:
#   sudo ./bootstrap.sh you@example.com deploy
#
# Safe to run again: every step checks what's already there.
set -euo pipefail

EMAIL="${1:?usage: bootstrap.sh <letsencrypt-email> <deploy-user>}"
DEPLOY_USER="${2:?usage: bootstrap.sh <letsencrypt-email> <deploy-user>}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.18.2}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }
id "$DEPLOY_USER" &>/dev/null || { echo "User $DEPLOY_USER doesn't exist; create it first (adduser $DEPLOY_USER)." >&2; exit 1; }

echo "==> k3s"
if ! command -v k3s &>/dev/null; then
  curl -sfL https://get.k3s.io | sh -
fi
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
until kubectl get nodes 2>/dev/null | grep -q ' Ready'; do echo "   waiting for the node..."; sleep 5; done

echo "==> kubectl for $DEPLOY_USER"
home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/.kube"
install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /etc/rancher/k3s/k3s.yaml "$home/.kube/config"

echo "==> cert-manager $CERT_MANAGER_VERSION"
kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"
kubectl -n cert-manager rollout status deployment/cert-manager-webhook --timeout=5m

echo "==> Let's Encrypt issuer ($EMAIL)"
# The webhook can take a moment to accept requests after it reports ready.
for attempt in 1 2 3 4 5 6; do
  if sed "s/\${LETSENCRYPT_EMAIL}/$EMAIL/" "$SCRIPT_DIR/../k8s/cluster/cluster-issuer.yaml" | kubectl apply -f -; then break; fi
  echo "   cert-manager not ready yet, retrying..."; sleep 10
done

echo
echo "Done. Next:"
echo "  1. As $DEPLOY_USER, create the app's secrets:   ./create-secrets.sh"
echo "  2. Point your domain's DNS A record at this server, and open ports 80 and 443."
echo "  3. Push to main on GitHub; the Deploy workflow does the rest."
