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

// Garmin Connect OAuth2 endpoints
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauthConfirm';
const GARMIN_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/token';
const GARMIN_COURSES_API = 'https://connectapi.garmin.com/course-service/course';
const GARMIN_USERINFO_URL = 'https://connectapi.garmin.com/userprofile-service/usersocialprofile';

interface GarminTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
}

interface GarminCoursePoint {
  lat: number;
  lng: number;
}

interface GarminCuePoint {
  pointIndex: number;
  type: string; // "LEFT", "RIGHT", "STRAIGHT", "GENERIC"
  notes: string;
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
    routePath: GarminCoursePoint[];
    directions: Array<{ instruction: string; distance: number; duration: number }>;
  }
): Promise<{ courseId: string; success: boolean }> {
  const accessToken = await getValidToken(userId);

  // Build course points array
  const coursePoints = course.routePath.map((p, i) => ({
    latitude: p.lat,
    longitude: p.lng,
    altitude: 0,
    distanceInCourse: null,
    valid: true,
    index: i,
  }));

  // Build cue points (turn-by-turn) from directions
  const cuePoints = buildCuePoints(course.routePath, course.directions);

  const coursePayload = {
    courseName: course.name.replace(/\s*\([0-9.]+km\)/i, ''),
    description: course.description || `Generated by RunFlex Router`,
    distanceInMeters: course.distance * 1000,
    courseType: 'RUNNING',
    coursePoints,
    cuePoints,
  };

  const response = await fetch(GARMIN_COURSES_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'NK': 'NT', // Required Garmin header
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
          'NK': 'NT',
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

/**
 * Build Garmin cue points from RunFlex direction steps.
 */
function buildCuePoints(
  routePath: GarminCoursePoint[],
  directions: Array<{ instruction: string; distance: number; duration: number }>
): GarminCuePoint[] {
  const cuePoints: GarminCuePoint[] = [];
  let cumDistKm = 0;

  for (const step of directions) {
    // Find the closest route point index for this cumulative distance
    const pointIndex = findPointIndexAtDistance(routePath, cumDistKm);
    const cueType = classifyTurnForGarmin(step.instruction);

    cuePoints.push({
      pointIndex,
      type: cueType,
      notes: step.instruction,
    });

    cumDistKm += step.distance;
  }

  return cuePoints;
}

function findPointIndexAtDistance(routePath: GarminCoursePoint[], targetKm: number): number {
  let cumDist = 0;
  for (let i = 1; i < routePath.length; i++) {
    cumDist += haversineKm(
      routePath[i - 1].lat, routePath[i - 1].lng,
      routePath[i].lat, routePath[i].lng
    );
    if (cumDist >= targetKm) return i;
  }
  return routePath.length - 1;
}

function classifyTurnForGarmin(instruction: string): string {
  const lower = instruction.toLowerCase();
  if (/\bu[ -]?turn\b/.test(lower)) return 'U_TURN';
  if (/\bsharp\s+left\b/.test(lower)) return 'SHARP_LEFT';
  if (/\bsharp\s+right\b/.test(lower)) return 'SHARP_RIGHT';
  if (/\bleft\b/.test(lower)) return 'LEFT';
  if (/\bright\b/.test(lower)) return 'RIGHT';
  if (/\bstraight\b|\bcontinue\b|\bhead\b/.test(lower)) return 'STRAIGHT';
  return 'GENERIC';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
