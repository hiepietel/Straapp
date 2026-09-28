# Straapp

A personal, read-only view of your own Strava activities. No comparisons, no feed of other people.

Built with React, TypeScript, Vite and Tailwind CSS v4, structured with atomic design.

## Run it

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run typecheck   # tsc, no emit
npm run build       # typecheck, then production build
```

With no `.env` file the app shows demo data, so you can look around straight away.

## Connect your Strava account

1. Create an API application at https://www.strava.com/settings/api
   (set "Authorization Callback Domain" to `localhost`).
2. Copy `.env.example` to `.env` and fill in the client id and client secret.
3. Restart `npm run dev` and open http://localhost:5173.
4. Click **Log in with Strava**, authorize the app, and you land back on your activities.

The app gets its token from that login, so there is no token to copy around. It is kept in
this browser's local storage and refreshed automatically when it expires. **Log out** clears it.

> **Security note:** `VITE_` variables are bundled into the browser code, and Strava only lets the
> client secret (not PKCE) exchange the login code for a token. That is fine on your own machine,
> but do not deploy this publicly with your client secret in it. For deployment, move the two token
> requests in `src/services/auth.ts` (`requestToken`) to a small backend or serverless function.

## Structure (atomic design)

```
src/
  components/
    atoms/       Button, Spinner, SportIcon, RouteTrace
    molecules/   StatItem, SportBadge, FilterTabs, Notice
    organisms/   Header, SummaryStrip, ActivityCard, ActivityGrid
    templates/   DashboardTemplate (layout only)
    pages/       ActivitiesPage (data + wiring), LoginPage
  hooks/         useActivities, useAuth
  services/      auth (Strava login + tokens), stravaApi (real API + demo fallback), mockActivities
  types/         strava (Activity, Athlete — the API shapes we consume)
  utils/         format, sports, polyline, errors
```

Everything is `.ts`/`.tsx` under `strict` mode. Component prop types are exported next to each
component (`ButtonProps`, `ActivityCardProps`, …), and the Strava wire format lives in one place,
`src/types/strava.ts`.
