# Straapp infrastructure

Straapp runs on a single Linux server with [k3s](https://k3s.io), a small Kubernetes distribution
that includes the Traefik ingress and local disk storage. You deploy from your own machine: nothing
else has access to the server, and there is no image registry.

```
 Your machine                              Your server (k3s)
 ────────────                              ─────────────────
 ./infra/deploy.sh root@server             namespace "straapp"
   1. docker build api, ui                   Ingress (Traefik, HTTPS via Let's Encrypt)
   2. ssh → k3s ctr images import  ──────►     └─ straapp-ui    nginx: web app, forwards /api ──┐
   3. ssh → kubectl apply -k                                                                    │
                                             straapp-api     .NET API, 1 replica  ◄─────────────┘
 ./infra/import-db.sh root@server              └─ straapp-postgres  PostgreSQL 18, 10 Gi volume
   local pg_dump → ssh → pg_restore  ─────►       └─ nightly pg_dump → straapp-backups volume
```

GitHub only runs CI (build and typecheck); it never touches the server.

| Path | What |
| --- | --- |
| `deploy.sh` | Builds both images, loads them into k3s over SSH, applies the manifests |
| `import-db.sh` | Replaces the server's database with your local one |
| `k8s/base/` | Every resource: PostgreSQL + nightly backup, API, web app, ingress |
| `k8s/overlays/production/` | Your domain; `deploy.sh` sets the image tag here |
| `k8s/overlays/lan/` | Home network: plain http on the server's IP, no domain (`STRAAPP_OVERLAY=lan`) |
| `k8s/overlays/minikube/` | Minikube instead of k3s: no ingress, web app on node port 30080 |
| `server/minikube-expose.sh` | Minikube only: forwards the server's port 80 into minikube |
| `k8s/cluster/` | The Let's Encrypt issuer, applied once by `bootstrap.sh` |
| `server/bootstrap.sh` | One-time server setup: k3s, cert-manager, the Let's Encrypt issuer |
| `server/create-secrets.sh` | Creates the app's secrets in the cluster (never in git) |

## First-time setup

On your machine you need Docker, SSH, and on Windows Git Bash (it comes with Git) to run the scripts.

### 1. The server

Any Linux server with a public IP. 2 GB of RAM and 20 GB of disk are plenty. Then:

- Point your domain's DNS **A record** at the server's IP.
- Open ports **22** (SSH), **80** and **443**. Port 80 is needed for Let's Encrypt.
- Make sure you can `ssh root@<server>` with a key (or as a user with passwordless `sudo`).

### 2. Kubernetes, HTTPS and secrets

Copy this folder to the server and run the bootstrap as root. It installs k3s, cert-manager and the
Let's Encrypt issuer. Add a user name at the end to also give that user `kubectl` access.

```bash
scp -r infra root@<server>:/root/straapp-infra
ssh root@<server>
cd /root/straapp-infra/server
chmod +x *.sh
./bootstrap.sh you@example.com
```

Then create the app's secrets. The script asks for the Strava client ID and secret, and generates the
database password and token signing key:

```bash
./create-secrets.sh
```

### 3. Strava

On <https://www.strava.com/settings/api>, set **Authorization Callback Domain** to your domain,
e.g. `straapp.example.com`. Strava still allows `localhost`, so local development keeps working.

### 4. Deploy

Replace `straapp.example.com` with your domain (two places) in
`k8s/overlays/production/kustomization.yaml`. Then, from the repository root in Git Bash:

```bash
./infra/deploy.sh root@<server>
```

It builds both images for the server's CPU, streams them into k3s, applies the manifests and waits
until everything runs. The first run takes a few minutes; later ones reuse Docker's cache.

### 5. Your data

If your local database already has your history, copy it over now (next section), so the server
doesn't spend days fetching it from Strava. Then open `https://<your domain>` and log in with Strava.
The first certificate can take a minute.

## On your home network instead (no domain)

To run Straapp on a server in your home network, e.g. `192.168.1.100`, reached only from inside it:

- Skip the DNS and the open ports. `bootstrap.sh` still needs an email; it isn't used without a domain.
- On the Strava API settings page, set **Authorization Callback Domain** to the server's IP, e.g. `192.168.1.100`.
- Deploy the `lan` overlay, which serves plain http on any host name or IP, with no certificate:

  ```bash
  STRAAPP_OVERLAY=lan ./infra/deploy.sh root@192.168.1.100
  ```

- Open `http://192.168.1.100`. Traffic isn't encrypted, which is fine on a network you trust.

Every later deploy needs `STRAAPP_OVERLAY=lan` too; without it, `deploy.sh` applies the production overlay.

### With minikube instead of k3s

If the server already runs minikube, use it instead of `bootstrap.sh`. Everything runs as the user that
runs minikube (no root, no sudo), and the scripts notice minikube by themselves.

```bash
scp -r infra you@192.168.1.100:~/straapp-infra
ssh you@192.168.1.100
cd ~/straapp-infra/server && chmod +x *.sh
minikube start                 # if it isn't running; it doesn't start by itself after a reboot
./create-secrets.sh
./minikube-expose.sh           # forwards the server's port 80 into minikube (asks for sudo once)
exit
```

Then from your machine, with the `minikube` overlay. It has no ingress; the web app listens on port 30080
of the minikube node, and `minikube-expose.sh` forwards port 80 there:

```bash
STRAAPP_OVERLAY=minikube ./infra/deploy.sh you@192.168.1.100
PGPASSWORD=... ./infra/import-db.sh you@192.168.1.100
```

Open `http://192.168.1.100`. As with k3s, set Strava's callback domain to `192.168.1.100`. On the server,
`kubectl` is `minikube kubectl --`, e.g. `minikube kubectl -- -n straapp get pods`.

## Moving your local database to the server

Strava allows about 100 requests per 15 minutes and 1,000 a day, and each activity takes several, so
syncing a whole history takes days. If your local database already has it, copy it over. The server's
sync skips every activity it already has and fetches only newer ones. The database holds only your
Strava data, no passwords or tokens, so it works on the server as is.

Stop the local API first, then from the repository root in Git Bash:

```bash
PGPASSWORD=<your local postgres password> ./infra/import-db.sh root@<server>
```

It dumps the local database (`localhost`, user `postgres`, database `straapp`; set `LOCAL_DB` to a
connection string like `"host=localhost port=5432 user=postgres dbname=straapp"` for another one),
asks before going on, then on the server stops the API, **replaces the whole database**, and starts
the API again. The API applies newer migrations on start, so a dump from an older version of the app
is fine. If the import stops halfway, the API stays stopped; run the script again.

Then log in on the web app. About a minute later the sync starts and fetches only what's missing.

## Day to day

**Deploying a change:** commit it, then `./infra/deploy.sh root@<server>`. Each deploy is tagged with
the commit (uncommitted changes get a `-dirty-<time>` tag), so Kubernetes always sees a new image.

**Rolling back:** check out the older commit and deploy it: `git checkout <sha> && ./infra/deploy.sh
root@<server>`, then `git checkout main`.

On the server:

```bash
kubectl -n straapp get pods                         # is everything running?
kubectl -n straapp logs deploy/straapp-api -f       # API logs (sync progress, errors)
kubectl -n straapp logs deploy/straapp-ui           # nginx logs
kubectl -n straapp rollout restart deploy/straapp-api
kubectl -n straapp get certificate                  # HTTPS certificate status
kubectl -n straapp describe pod <name>              # why is a pod not starting?
sudo k3s crictl rmi --prune                         # free disk from old images now and then
```

**Every API restart ends the Strava session**, including each deploy: the API keeps it in memory. Log in
again on the web app; the scheduled sync resumes about a minute later.

## Backups

A CronJob dumps the database every night at 03:00 into the `straapp-backups` volume and keeps 14 days.
A backup on the same disk doesn't protect against losing the disk, so copy the dumps elsewhere now and then.

```bash
kubectl -n straapp create job --from=cronjob/straapp-postgres-backup backup-now   # back up right now
kubectl -n straapp logs job/backup-now                                          # lists the backups

# Copy the newest dump to your machine (it lives in a local-path volume on the server):
sudo ls /var/lib/rancher/k3s/storage/ | grep straapp-backups
sudo cp /var/lib/rancher/k3s/storage/<that folder>/straapp-<date>.sql.gz ~
```

Restore a dump. This replaces what's in the database:

```bash
kubectl -n straapp scale deploy/straapp-api --replicas=0
gunzip -c straapp-<date>.sql.gz | kubectl -n straapp exec -i statefulset/straapp-postgres -- \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d straapp -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d straapp'
kubectl -n straapp scale deploy/straapp-api --replicas=1
```

## Secrets

The secrets live only in the cluster. See them with `kubectl -n straapp get secrets`.

- **New Strava keys:** run `./create-secrets.sh --replace`. This also makes a new database password, which
  locks the API out of the existing database. To change only the Strava keys:

  ```bash
  kubectl -n straapp create secret generic straapp-api --dry-run=client -o yaml \
    --from-literal=strava-client-id=<id> --from-literal=strava-client-secret=<secret> \
    --from-literal=auth-signing-key="$(kubectl -n straapp get secret straapp-api -o jsonpath='{.data.auth-signing-key}' | base64 -d)" \
    | kubectl apply -f -
  kubectl -n straapp rollout restart deploy/straapp-api
  ```

- **Everyone logged out:** a new `auth-signing-key` invalidates every login token.
