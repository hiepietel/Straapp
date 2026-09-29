# Straapp

Your Strava activities in your own database, with statistics, gear history and a heatmap of everywhere you've been.

| Folder | What |
| --- | --- |
| [`api/`](api) | .NET 10 API (clean architecture): logs in with Strava, syncs activities into PostgreSQL, serves statistics |
| [`ui/`](ui) | React + Vite web app |
| [`infra/`](infra) | Kubernetes manifests and server scripts; see [infra/README.md](infra/README.md) |
| [`.github/workflows/`](.github/workflows) | CI on every push, deploy to the server on every push to `main` |

Strava is only ever called by the API's sync jobs. The pages read what's already in the database.

## Run it locally (development)

Needs the .NET 10 SDK, Node 22+ and PostgreSQL. Strava keys come from <https://www.strava.com/settings/api>
(Strava always allows `localhost` as a login callback).

One-time setup:

```bash
cd api
dotnet user-secrets set "Strava:ClientId" "<client id>" --project src/Straapp.Api
dotnet user-secrets set "Strava:ClientSecret" "<client secret>" --project src/Straapp.Api
dotnet user-secrets set "Auth:SigningKey" "$(openssl rand -base64 64 | tr -d '\n')" --project src/Straapp.Api
dotnet user-secrets set "ConnectionStrings:Straapp" "Host=localhost;Database=straapp;Username=postgres;Password=<password>" --project src/Straapp.Api

cd ../ui
npm install
```

Then, in two terminals:

```bash
# 1. API on http://localhost:5080; creates/migrates the database, opens Swagger after a Strava login
cd api && dotnet run --project src/Straapp.Api

# 2. Web app on http://localhost:5173 (proxies /api to the API)
cd ui && npm run dev
```

Log in on the web app. About a minute later the API starts syncing your whole history, newest first;
follow it with `GET /api/sync/status` in Swagger.

Database changes:

```bash
cd api
dotnet tool restore
dotnet ef migrations add <Name> --project src/Straapp.Persistence --startup-project src/Straapp.Api -o Migrations
```

## Run it with Docker (the production images, locally)

Needs Docker. Builds the same images the server runs, with PostgreSQL next to them:

```bash
cp .env.example .env        # fill in the Strava keys, a database password and a signing key
docker compose up --build   # the app is at http://localhost:8080
docker compose down         # stop (add -v to also delete the database)
```

## Run it on a server (production)

Push to `main` on GitHub, and the Deploy workflow builds the images and rolls them out to your server
over SSH. The one-time server and GitHub setup is in [infra/README.md](infra/README.md).
