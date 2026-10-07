#!/usr/bin/env bash
# Makes Straapp on minikube reachable from the rest of the network. Minikube runs in its own container
# or VM with an address only this server can reach (e.g. 192.168.49.2); the minikube overlay puts the
# web app on port 30080 there. This installs a small systemd service (socat) that forwards this
# server's port 80 to it, so other machines open http://<this server>.
#
# Run on the server as the user that runs minikube, with minikube started (it asks for sudo):
#   ./minikube-expose.sh            # or: ./minikube-expose.sh 8080   to listen on another port
#
# Safe to run again, e.g. after `minikube delete` gave the node a new address.
set -euo pipefail

PORT="${1:-80}"
NODE_PORT=30080

[[ $EUID -ne 0 ]] || { echo "Run as the user that runs minikube, not root; it uses sudo where needed." >&2; exit 1; }
NODE_IP="$(minikube ip)"

if ! command -v socat &>/dev/null; then
  echo "==> Installing socat"
  if command -v apt-get &>/dev/null; then sudo apt-get update -q && sudo apt-get install -y -q socat
  elif command -v dnf &>/dev/null; then sudo dnf install -y socat
  else echo "Install socat with your package manager, then run this again." >&2; exit 1; fi
fi

echo "==> Forwarding port $PORT to $NODE_IP:$NODE_PORT"
sudo tee /etc/systemd/system/straapp-forward.service >/dev/null <<EOF
[Unit]
Description=Forward port $PORT to Straapp on minikube
After=network-online.target

[Service]
ExecStart=$(command -v socat) TCP-LISTEN:$PORT,fork,reuseaddr TCP:$NODE_IP:$NODE_PORT
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now straapp-forward
sudo systemctl restart straapp-forward

echo
echo "Done. Open http://$(hostname -I | awk '{print $1}')$([[ $PORT == 80 ]] || echo ":$PORT") from another machine."
