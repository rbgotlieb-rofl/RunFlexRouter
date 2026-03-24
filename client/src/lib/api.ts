// API base URL — set VITE_API_URL at build time for Capacitor builds
// pointing to your Railway backend (e.g. "https://runflex.up.railway.app").
// When running on the same origin (web), this defaults to empty string
// so relative URLs like "/api/routes" continue to work.
export const API_BASE = import.meta.env.VITE_API_URL || '';
