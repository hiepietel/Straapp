/*
 * Logging in, driven from here:
 *   1. ask the API for Strava's "Authorize" link and send the browser there;
 *   2. Strava sends the browser back to this app with a one-time ?code=;
 *   3. POST the code to the API, which swaps it with Strava (it holds the secret)
 *      and answers with the app's own access token;
 *   4. send that token as "Authorization: Bearer …" with every API request.
 */

import { readJson } from "./api";

const TOKEN_KEY = "straapp.token";
const STATE_KEY = "straapp.oauth-state";
/** Where to go back to once the login round-trip lands on the app's root. */
const RETURN_KEY = "straapp.oauth-return";

// Opt-in demo mode: made-up data and no login, for trying the UI without the API.
export const isDemo: boolean = import.meta.env.VITE_DEMO === "true";

/** The logged-in athlete, as the API knows them. */
export interface CurrentUser {
  id: number;
  firstname: string | null;
  lastname: string | null;
  profileUrl: string | null;
}

interface StoredToken {
  accessToken: string;
  /** ISO date-time. */
  expiresAt: string;
}

interface LoginResult extends StoredToken {
  user: CurrentUser;
}

/** The login failed for a reason worth showing (as opposed to the network failing). */
export class AuthError extends Error {
  override name = "AuthError";
}

// ---- token storage ----

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    const token = raw ? (JSON.parse(raw) as StoredToken) : null;
    return token && Date.parse(token.expiresAt) > Date.now() ? token : null;
  } catch {
    return null;
  }
}

let token: StoredToken | null = isDemo ? null : readToken();

function setToken(next: StoredToken | null): void {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the token still works until the tab closes.
  }
}

/** For the Authorization header; null when logged out. */
export const getAccessToken = (): string | null => token?.accessToken ?? null;

const authHeaders = (): HeadersInit => (token ? { Authorization: `Bearer ${token.accessToken}` } : {});

// ---- session state + change notification (for useSyncExternalStore) ----

/** undefined = not known yet (still asking the API). */
let user: CurrentUser | null | undefined = isDemo ? null : undefined;
const listeners = new Set<() => void>();

function setUser(next: CurrentUser | null): void {
  user = next;
  listeners.forEach((notify) => notify());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const isSignedIn = (): boolean => user != null;

/** Who is logged in, from the API's database (never asked of Strava); null when logged out. */
export const getCurrentUser = (): CurrentUser | null => user ?? null;

export const isChecking = (): boolean => user === undefined;

/**
 * Call when the API answers 401: the token expired, or the API restarted and lost the
 * Strava session behind it. The login screen then shows.
 */
export function sessionEnded(): void {
  setToken(null);
  if (user !== null) setUser(null);
}

export async function signOut(): Promise<void> {
  try {
    if (token) await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() });
  } finally {
    sessionEnded();
  }
}

// ---- logging in ----

/** Asks the API for Strava's "Authorize" link and sends the browser there. */
export async function startLogin(): Promise<void> {
  // Not crypto.randomUUID(): browsers only offer it on https or localhost, and the app may be served
  // over plain http on a home network.
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search + window.location.hash);
  } catch {
    throw new Error("Your browser is blocking storage, so login can't be verified.");
  }

  // Strava comes back to the app's root; every page there can finish the login.
  const params = new URLSearchParams({ redirectUri: `${window.location.origin}/`, state });
  const res = await fetch(`/api/auth/authorize-url?${params}`);
  if (!res.ok) throw new Error(`The Straapp API responded with ${res.status}. Is it running?`);
  const { url } = await readJson<{ url: string }>(res);
  window.location.assign(url);
}

/** True when the current URL is Strava sending the user back to us. */
function hasPendingRedirect(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("code") || params.has("error");
}

async function finishLogin(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const denied = params.get("error");

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? "/";
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  // The code is single-use, so take it out of the address bar straight away.
  window.history.replaceState(null, "", returnTo);

  if (denied) {
    throw new AuthError(denied === "access_denied" ? "Login was cancelled." : `Strava returned an error: ${denied}.`);
  }
  if (!expectedState || params.get("state") !== expectedState) {
    throw new AuthError("The login could not be verified. Please try again.");
  }

  const res = await fetch("/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, scope: params.get("scope") }),
  });
  if (!res.ok) {
    // The API explains itself in problem details, e.g. a permission that was unticked.
    const problem = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new AuthError(problem.detail ?? `Login failed (${res.status}).`);
  }

  const result = await readJson<LoginResult>(res);
  setToken({ accessToken: result.accessToken, expiresAt: result.expiresAt });
  setUser(result.user);
}

/** Checks a saved token with the API; no token means logged out without asking. */
async function restoreSession(): Promise<void> {
  if (!token) {
    setUser(null);
    return;
  }
  const res = await fetch("/api/auth/me", { headers: authHeaders() });
  if (res.status === 401) {
    sessionEnded();
  } else if (!res.ok) {
    setUser(null);
    throw new Error(`The Straapp API responded with ${res.status}. Is it running?`);
  } else {
    setUser(await readJson<CurrentUser>(res));
  }
}

let checked: Promise<void> | null = null;

/**
 * Finishes a login if Strava just sent us back, otherwise checks the saved token.
 * Memoised: React StrictMode runs effects twice, and Strava's code can only be used once.
 */
export function checkSession(): Promise<void> {
  checked ??= (async () => {
    if (isDemo) return;
    try {
      await (hasPendingRedirect() ? finishLogin() : restoreSession());
    } catch (err) {
      if (user === undefined) setUser(null);
      // fetch itself failing means nothing is listening.
      throw err instanceof TypeError ? new Error("Can't reach the Straapp API. Is it running?") : err;
    }
  })();
  return checked;
}
