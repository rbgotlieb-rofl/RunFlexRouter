/**
 * COROS Training Hub API Service
 *
 * Implements OAuth2 authentication with COROS and the Routes API
 * for pushing courses directly to a user's COROS watch.
 *
 * Flow (mirrors the Garmin integration):
 * 1. User links their COROS account once via OAuth (Profile page)
 * 2. Tap "Send to COROS Watch" → course is pushed via the COROS API
 * 3. COROS Training Hub syncs the course to their paired watch automatically
 *
 * Required env vars:
 *   COROS_CLIENT_ID     — from COROS Open Platform
 *   COROS_CLIENT_SECRET — from COROS Open Platform
 *   COROS_REDIRECT_URI  — e.g. https://yourapp.com/api/coros/callback
 */

import crypto from 'crypto';

// COROS Open Platform OAuth2 endpoints
const COROS_AUTH_URL = 'https://open.coros.com/oauth2/authorize';
const COROS_TOKEN_URL = 'https://open.coros.com/oauth2/accesstoken';
const COROS_ROUTES_API = 'https://open.coros.com/api/route/push';

interface CorosTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  openId: string;    // COROS user identifier
}

// In-memory token store (keyed by RunFlex userId)
// In production this should be in the database
const corosTokenStore = new Map<number, CorosTokens>();

// State store for OAuth flow (keyed by state param, short-lived)
const oauthStateStore = new Map<string, { userId: number; expiresAt: number }>();

/**
 * Build the COROS OAuth2 authorization URL.
 * The user is redirected here to grant RunFlex access to their COROS account.
 */
export function getCorosAuthUrl(userId: number): string {
  const clientId = process.env.COROS_CLIENT_ID;
  const redirectUri = process.env.COROS_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('COROS_CLIENT_ID and COROS_REDIRECT_URI must be set');
  }

  const state = crypto.randomBytes(16).toString('hex');

  // Store state for the callback (expires in 10 minutes)
  oauthStateStore.set(state, {
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Clean up expired entries
  const now = Date.now();
  oauthStateStore.forEach((val, key) => {
    if (val.expiresAt < now) oauthStateStore.delete(key);
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });

  return `${COROS_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called from the OAuth callback route.
 */
export async function exchangeCorosCode(
  code: string,
  state: string
): Promise<{ userId: number; tokens: CorosTokens }> {
  const stateEntry = oauthStateStore.get(state);
  if (!stateEntry) {
    throw new Error('Invalid or expired OAuth state');
  }

  if (stateEntry.expiresAt < Date.now()) {
    oauthStateStore.delete(state);
    throw new Error('OAuth state expired');
  }

  const clientId = process.env.COROS_CLIENT_ID!;
  const clientSecret = process.env.COROS_CLIENT_SECRET!;
  const redirectUri = process.env.COROS_REDIRECT_URI!;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(COROS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`COROS token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  const tokens: CorosTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    openId: data.openId || data.open_id || '',
  };

  // Store tokens and clean up state
  corosTokenStore.set(stateEntry.userId, tokens);
  oauthStateStore.delete(state);

  return { userId: stateEntry.userId, tokens };
}

/**
 * Refresh an expired access token using the refresh token.
 */
async function refreshCorosToken(userId: number): Promise<CorosTokens> {
  const existing = corosTokenStore.get(userId);
  if (!existing?.refreshToken) {
    throw new Error('No COROS refresh token available — user must re-link');
  }

  const clientId = process.env.COROS_CLIENT_ID!;
  const clientSecret = process.env.COROS_CLIENT_SECRET!;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: existing.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(COROS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    corosTokenStore.delete(userId);
    throw new Error('COROS refresh token expired — user must re-link their account');
  }

  const data = await response.json();

  const tokens: CorosTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || existing.refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    openId: existing.openId,
  };

  corosTokenStore.set(userId, tokens);
  return tokens;
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 */
async function getValidToken(userId: number): Promise<{ accessToken: string; openId: string }> {
  const tokens = corosTokenStore.get(userId);
  if (!tokens) {
    throw new Error('COROS account not linked');
  }

  // Refresh if token expires within 5 minutes
  if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshCorosToken(userId);
    return { accessToken: refreshed.accessToken, openId: refreshed.openId };
  }

  return { accessToken: tokens.accessToken, openId: tokens.openId };
}

/**
 * Push a course to the user's COROS Training Hub account.
 * COROS syncs it to their paired watch automatically.
 *
 * The COROS route push API accepts a GPX file as the route data.
 */
export async function pushCourseToCoros(
  userId: number,
  course: {
    name: string;
    description?: string;
    distance: number; // km
    gpxData: string;  // GPX XML string
    sportType?: number; // 1=running, 2=cycling, etc. Default: 1 (running)
  }
): Promise<{ routeId: string; success: boolean }> {
  const { accessToken, openId } = await getValidToken(userId);

  const formData = new FormData();
  const gpxBlob = new Blob([course.gpxData], { type: 'application/gpx+xml' });
  formData.append('routeFile', gpxBlob, `${course.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.gpx`);
  formData.append('openId', openId);
  formData.append('sportType', String(course.sportType || 1));
  formData.append('routeName', course.name.replace(/\s*\([0-9.]+km\)/i, ''));
  if (course.description) {
    formData.append('routeDesc', course.description);
  }

  const response = await fetch(COROS_ROUTES_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Token might be invalid — try refresh once
    if (response.status === 401) {
      const refreshed = await refreshCorosToken(userId);

      const retryFormData = new FormData();
      const retryBlob = new Blob([course.gpxData], { type: 'application/gpx+xml' });
      retryFormData.append('routeFile', retryBlob, `${course.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.gpx`);
      retryFormData.append('openId', refreshed.openId);
      retryFormData.append('sportType', String(course.sportType || 1));
      retryFormData.append('routeName', course.name.replace(/\s*\([0-9.]+km\)/i, ''));
      if (course.description) {
        retryFormData.append('routeDesc', course.description);
      }

      const retryResponse = await fetch(COROS_ROUTES_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshed.accessToken}`,
        },
        body: retryFormData,
      });

      if (!retryResponse.ok) {
        throw new Error(`COROS Routes API error: ${retryResponse.status}`);
      }

      const retryData = await retryResponse.json();
      return { routeId: retryData.routeId || retryData.id || 'unknown', success: true };
    }

    throw new Error(`COROS Routes API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { routeId: data.routeId || data.id || 'unknown', success: true };
}

/**
 * Check if a user has a linked COROS account.
 */
export function isCorosLinked(userId: number): boolean {
  return corosTokenStore.has(userId);
}

/**
 * Unlink a user's COROS account.
 */
export function unlinkCoros(userId: number): void {
  corosTokenStore.delete(userId);
}
