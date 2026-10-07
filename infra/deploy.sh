#!/usr/bin/env bash
# Deploys Straapp from your machine: builds both images with Docker, streams them over SSH straight
# into the server's k3s or minikube (no registry), then applies the Kubernetes manifests and waits for
# the rollout.
#
#   ./infra/deploy.sh root@your-server        # or: STRAAPP_SERVER=root@your-server ./infra/deploy.sh
#   STRAAPP_OVERLAY=lan ./infra/deploy.sh root@192.168.1.100        # k3s on a home network: plain http
#   STRAAPP_OVERLAY=minikube ./infra/deploy.sh you@192.168.1.100    # minikube (see infra/README.md)
#
# Needs Docker running locally, and SSH access to the server: for k3s as root (or a user with
# passwordless sudo for k3s), for minikube as the user that runs minikube.
# On Windows, run it from Git Bash.
set -euo pipefail

SERVER="${1:-${STRAAPP_SERVER:-}}"
[[ -n "$SERVER" ]] || { echo "usage: deploy.sh <user@server>   (or set STRAAPP_SERVER)" >&2; exit 1; }
SSH_OPTS=(${SSH_OPTS:-})
OVERLAY="${STRAAPP_OVERLAY:-production}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
[[ -d "infra/k8s/overlays/$OVERLAY" ]] || { echo "No overlay infra/k8s/overlays/$OVERLAY." >&2; exit 1; }

# Each deploy gets its own tag, so Kubernetes always notices the new image.
TAG="$(git rev-parse --short HEAD)"
[[ -z "$(git status --porcelain)" ]] || TAG="$TAG-dirty-$(date +%Y%m%d%H%M%S)"

# Build for the server's CPU, whatever this machine is.
case "$(ssh "${SSH_OPTS[@]}" "$SERVER" uname -m)" in
  x86_64) PLATFORM=linux/amd64 ;;
  aarch64 | arm64) PLATFORM=linux/arm64 ;;
  *) echo "Unknown server architecture." >&2; exit 1 ;;
esac

echo "==> Building straapp-api:$TAG and straapp-ui:$TAG ($PLATFORM)"
docker build --platform "$PLATFORM" -t "straapp-api:$TAG" api
docker build --platform "$PLATFORM" -t "straapp-ui:$TAG" ui

echo "==> Loading the images into the cluster on $SERVER"
for image in "straapp-api:$TAG" "straapp-ui:$TAG"; do
  docker save "$image" | gzip | ssh "${SSH_OPTS[@]}" "$SERVER" '
    set -e
    file=$(mktemp --suffix=.tar); trap "rm -f $file" EXIT
    gunzip > "$file"
    if command -v k3s >/dev/null; then $([ "$(id -u)" -eq 0 ] || echo sudo) k3s ctr images import "$file"
    else minikube image load "$file"; fi
  '
done

echo "==> Applying the manifests ($OVERLAY)"
tar -C infra -cf - k8s | ssh "${SSH_OPTS[@]}" "$SERVER" "
  set -e
  if command -v k3s >/dev/null; then k() { \$([ \"\$(id -u)\" -eq 0 ] || echo sudo) k3s kubectl \"\$@\"; }
  else k() { minikube kubectl -- \"\$@\"; }; fi
  dir=\$(mktemp -d); trap 'rm -rf \"\$dir\"' EXIT
  tar -C \"\$dir\" -xf -
  sed -i 's/newTag: .*/newTag: $TAG/' \"\$dir/k8s/overlays/$OVERLAY/kustomization.yaml\"
  k apply -k \"\$dir/k8s/overlays/$OVERLAY\"
  k -n straapp rollout status statefulset/straapp-postgres --timeout=5m
  k -n straapp rollout status deployment/straapp-api --timeout=10m
  k -n straapp rollout status deployment/straapp-ui --timeout=5m
  k -n straapp get pods
"
echo "==> Deployed $TAG"
