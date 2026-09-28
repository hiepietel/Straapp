# Straapp infrastructure

Straapp runs on a single Linux server with [k3s](https://k3s.io), a small Kubernetes distribution
that includes the Traefik ingress and local disk storage. GitHub builds the Docker images and deploys
them over SSH.

```
 GitHub                                   Your server (k3s)
 ──────                                   ─────────────────
 push to main                             namespace "straapp"
   └─ Deploy workflow                       Ingress (Traefik, HTTPS via Let's Encrypt)
        1. CI: build + typecheck              └─ straapp-ui    nginx: web app, forwards /api ──┐
        2. images → ghcr.io                                                                    │
        3. ssh → kubectl apply  ───────────►   straapp-api     .NET API, 1 replica  ◄──────────┘
                                                └─ straapp-postgres  PostgreSQL 18, 10 Gi volume
                                                   └─ nightly pg_dump → straapp-backups volume
```

| Path | What |
| --- | --- |
| `k8s/base/` | Every resource: PostgreSQL + nightly backup, API, web app, ingress |
| `k8s/overlays/production/` | Your domain; the workflow pins the image tags here |
| `k8s/cluster/` | The Let's Encrypt issuer, applied once by `bootstrap.sh` |
| `server/bootstrap.sh` | One-time server setup: k3s, cert-manager, kubectl for the deploy user |
| `server/create-secrets.sh` | Creates the app's secrets in the cluster (never in git) |

## First-time setup

### 1. The server

Any Linux server with a public IP. 2 GB of RAM and 20 GB of disk are plenty. Then:

- Point your domain's DNS **A record** at the server's IP.
- Open ports **22** (SSH), **80** and **443**. Port 80 is needed for Let's Encrypt.

Create a user that GitHub will deploy as, and give it an SSH key that only GitHub has.
On your own machine:

```bash
ssh-keygen -t ed25519 -f straapp-deploy -N "" -C "github-deploy"   # makes straapp-deploy and straapp-deploy.pub
```

On the server, as root:

```bash
adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "<contents of straapp-deploy.pub>" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2. Kubernetes, HTTPS and secrets

Copy this folder to the server and run the bootstrap as root. It installs k3s, cert-manager and the
Let's Encrypt issuer, and gives `deploy` kubectl access.

```bash
scp -r infra root@<server>:/root/straapp-infra
ssh root@<server>
cd /root/straapp-infra/server
chmod +x *.sh
./bootstrap.sh you@example.com deploy
```

Then create the app's secrets. The script asks for the Strava client ID and secret, and generates the
database password and token signing key:

```bash
KUBECONFIG=/home/deploy/.kube/config ./create-secrets.sh
```

### 3. Strava

On <https://www.strava.com/settings/api>, set **Authorization Callback Domain** to your domain,
e.g. `straapp.example.com`. Strava still allows `localhost`, so local development keeps working.

### 4. The repository on GitHub

```bash
# Replace straapp.example.com with your domain (two places), then commit.
nano infra/k8s/overlays/production/kustomization.yaml

git remote add origin git@github.com:<you>/straapp.git
git push -u origin main
```

Under **Settings → Secrets and variables → Actions**, add these repository secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | The server's IP or host name |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | The contents of the private key file `straapp-deploy` |
| `DEPLOY_KNOWN_HOSTS` | The output of `ssh-keyscan <server>` on your machine, so GitHub can check it's really your server |

If SSH listens on a port other than 22, also add a **variable** `DEPLOY_PORT`.

**Private images:** the first push creates the packages `straapp-api` and `straapp-ui` under your GitHub
profile. They're private if the repository is. Either make them public (package → Package settings →
Change visibility), or run `create-secrets.sh` again, answer **y**, and give it a token with only
`read:packages`.

### 5. Deploy

Push to `main`, or open **Actions → Deploy → Run workflow**. When it's green, open
`https://<your domain>` and log in with Strava. The first certificate can take a minute.

## Day to day

Run these on the server as `deploy`:

```bash
kubectl -n straapp get pods                         # is everything running?
kubectl -n straapp logs deploy/straapp-api -f       # API logs (sync progress, errors)
kubectl -n straapp logs deploy/straapp-ui           # nginx logs
kubectl -n straapp rollout restart deploy/straapp-api
kubectl -n straapp get certificate                  # HTTPS certificate status
kubectl -n straapp describe pod <name>              # why is a pod not starting?
```

**Every API restart ends the Strava session**, including each deploy: the API keeps it in memory. Log in
again on the web app; the scheduled sync resumes about a minute later.

**Rolling back:** re-run an older successful Deploy run (Actions → Deploy → the run → Re-run all jobs).
It applies that run's images again.

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
