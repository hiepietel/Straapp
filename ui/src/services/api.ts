import { getAccessToken, sessionEnded } from "./auth";

/** What the API sends alongside an error status (RFC 9457 problem details). */
interface ProblemDetails {
  title?: string;
  detail?: string;
}

export type QueryParams = Record<string, string | number | undefined>;

/** GET from the Straapp API (Vite proxies /api in dev), with the login token. */
export async function apiGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]]))
  ).toString();

  const token = getAccessToken();
  const res = await fetch(`${path}${query ? `?${query}` : ""}`, {
    headers: { Accept: "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
  });

  if (res.status === 401) {
    sessionEnded();
    throw new Error("Your session has ended. Please log in again.");
  }
  if (!res.ok) {
    const problem = (await res.json().catch((): ProblemDetails => ({}))) as ProblemDetails;
    throw new Error(problem.detail ?? problem.title ?? `The Straapp API responded with ${res.status}.`);
  }

  return readJson<T>(res);
}

/**
 * The body as JSON. An HTML page instead means the request never reached the API:
 * Vite answers unknown paths with index.html when its /api proxy isn't set up.
 */
export async function readJson<T>(res: Response): Promise<T> {
  if (!res.headers.get("Content-Type")?.includes("json")) {
    throw new Error("Got a web page instead of the Straapp API's answer. Restart `npm run dev` so the /api proxy is active.");
  }
  return (await res.json()) as T;
}
