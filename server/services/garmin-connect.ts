/**
 * Garmin Connect API Service
 *
 * Implements OAuth2 PKCE authentication with Garmin Connect and
 * the Courses API for pushing routes directly to a user's Garmin watch.
 *
 * Flow (same as Strava):
 * 1. User links their Garmin account once via OAuth (Profile page)
 * 2. Tap "Send to Garmin Watch" → course is pushed via the Courses API
 * 3. Garmin Connect syncs the course to their paired watch automatically
 *
 * Required env vars:
 *   GARMIN_CLIENT_ID     — from Garmin Developer Portal
 *   GARMIN_CLIENT_SECRET — from Garmin Developer Portal
 *   GARMIN_REDIRECT_URI  — e.g. https://yourapp.com/api/garmin/callback
 */

import crypto from 'crypto';

// Garmin Connect OAuth2 endpoints (per official PKCE spec)
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauth2Confirm';
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const GARMIN_COURSES_API = 'https://apis.garmin.com/partner-gateway/rest/courses';
const GARMIN_PERMISSIONS_URL = 'https://apis.garmin.com/wellness-api/rest/user/permissions';

interface GarminTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
}

// In-memory token store (keyed by RunFlex userId)
// In production this should be in the database
const garminTokenStore = new Map<number, GarminTokens>();

// PKCE code verifier store (keyed by state param, short-lived)
const pkceStore = new Map<string, { codeVerifier: string; userId: number; expiresAt: number }>();

/**
 * Generate a PKCE code verifier and challenge.
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Build the Garmin OAuth2 authorization URL.
 * The user is redirected here to grant RunFlex access to their Garmin account.
 */
export function getGarminAuthUrl(userId: number): string {
  const clientId = process.env.GARMIN_CLIENT_ID;
  const redirectUri = process.env.GARMIN_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('GARMIN_CLIENT_ID and GARMIN_REDIRECT_URI must be set');
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  // Store PKCE verifier for the callback (expires in 10 minutes)
  pkceStore.set(state, {
    codeVerifier,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Clean up expired PKCE entries
  const now = Date.now();
  pkceStore.forEach((val, key) => {
    if (val.expiresAt < now) pkceStore.delete(key);
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'COURSE_READ COURSE_WRITE',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${GARMIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called from the OAuth callback route.
 */
export async function exchangeGarminCode(
  code: string,
  state: string
): Promise<{ userId: number; tokens: GarminTokens }> {
  const pkceEntry = pkceStore.get(state);
  if (!pkceEntry) {
    throw new Error('Invalid or expired OAuth state');
  }

  if (pkceEntry.expiresAt < Date.now()) {
    pkceStore.delete(state);
    throw new Error('OAuth state expired');
  }

  const clientId = process.env.GARMIN_CLIENT_ID!;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET!;
  const redirectUri = process.env.GARMIN_REDIRECT_URI!;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: pkceEntry.codeVerifier,
  });

  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Garmin token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  const tokens: GarminTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  // Store tokens and clean up PKCE
  garminTokenStore.set(pkceEntry.userId, tokens);
  pkceStore.delete(state);

  return { userId: pkceEntry.userId, tokens };
}

/**
 * Refresh an expired access token using the refresh token.
 */
async function refreshGarminToken(userId: number): Promise<GarminTokens> {
  const existing = garminTokenStore.get(userId);
  if (!existing?.refreshToken) {
    throw new Error('No Garmin refresh token available — user must re-link');
  }

  const clientId = process.env.GARMIN_CLIENT_ID!;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET!;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: existing.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    // Refresh token expired — user must re-link
    garminTokenStore.delete(userId);
    throw new Error('Garmin refresh token expired — user must re-link their account');
  }

  const data = await response.json();

  const tokens: GarminTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || existing.refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  garminTokenStore.set(userId, tokens);
  return tokens;
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 */
async function getValidToken(userId: number): Promise<string> {
  const tokens = garminTokenStore.get(userId);
  if (!tokens) {
    throw new Error('Garmin account not linked');
  }

  // Refresh if token expires within 5 minutes
  if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshGarminToken(userId);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Push a course to the user's Garmin Connect account via the Courses API.
 * Garmin Connect then syncs it to their paired watch automatically.
 */
export async function pushCourseToGarmin(
  userId: number,
  course: {
    name: string;
    description?: string;
    distance: number; // km
    routePath: Array<{ lat: number; lng: number }>;
    directions: Array<{ instruction: string; distance: number; duration: number }>;
  }
): Promise<{ courseId: string; success: boolean }> {
  const accessToken = await getValidToken(userId);

  // Build geo points array (Garmin expects ~1 point per 100m for best results)
  const geoPoints = course.routePath.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const coursePayload = {
    courseName: course.name.replace(/\s*\([0-9.]+km\)/i, ''),
    description: course.description || 'Generated by RunFlex Router',
    distance: course.distance * 1000, // Garmin expects meters
    elevationGain: 0,
    elevationLoss: 0,
    geoPoints,
  };

  const response = await fetch(GARMIN_COURSES_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(coursePayload),
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Token might be invalid — try refresh once
    if (response.status === 401) {
      const refreshed = await refreshGarminToken(userId);
      const retryResponse = await fetch(GARMIN_COURSES_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshed.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(coursePayload),
      });

      if (!retryResponse.ok) {
        throw new Error(`Garmin Courses API error: ${retryResponse.status}`);
      }

      const retryData = await retryResponse.json();
      return { courseId: retryData.courseId || retryData.id || 'unknown', success: true };
    }

    throw new Error(`Garmin Courses API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { courseId: data.courseId || data.id || 'unknown', success: true };
}

/**
 * Check if a user has a linked Garmin account.
 */
export function isGarminLinked(userId: number): boolean {
  return garminTokenStore.has(userId);
}

/**
 * Unlink a user's Garmin account.
 */
export function unlinkGarmin(userId: number): void {
  garminTokenStore.delete(userId);
}

