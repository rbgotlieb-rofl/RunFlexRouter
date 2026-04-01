// API base URL — set VITE_API_URL at build time for Capacitor builds
// pointing to your Railway backend (e.g. "https://runflex.up.railway.app").
// When running on the same origin (web), this defaults to empty string
// so relative URLs like "/api/routes" continue to work.
export const API_BASE = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = "runflex_auth_token";

/** Get auth headers for fetch calls. Includes Bearer token if available. */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {}
  return headers;
}

/** Make an authenticated fetch to the API */
export async function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...getAuthHeaders(),
      ...opts?.headers,
    },
    credentials: "include",
  });
}
