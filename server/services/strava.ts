/**
 * Strava API integration — OAuth token exchange and activity upload.
 *
 * Strava OAuth flow:
 *  1. Frontend redirects user to Strava authorization URL
 *  2. Strava redirects back with an authorization code
 *  3. Backend exchanges code for access + refresh tokens
 *  4. Tokens are stored (in-memory or DB) per user session
 *  5. After a run, the backend uploads the activity using the access token
 */

// -- Types --------------------------------------------------------------------

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
  athleteId: number;
  athleteName: string;
}

export interface StravaActivityData {
  name: string;
  description?: string;
  elapsedSeconds: number;
  distanceMeters: number;
  startDate: string; // ISO 8601
  positions: Array<{ lat: number; lng: number; time: number }>; // time = Unix ms
}

// -- Configuration ------------------------------------------------------------

function getConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

export function isStravaConfigured(): boolean {
  return getConfig() !== null;
}

// -- In-memory token store (keyed by session ID) ------------------------------

const tokenStore = new Map<string, StravaTokens>();

export function getTokens(sessionId: string): StravaTokens | undefined {
  return tokenStore.get(sessionId);
}

export function setTokens(sessionId: string, tokens: StravaTokens): void {
  tokenStore.set(sessionId, tokens);
}

export function clearTokens(sessionId: string): void {
  tokenStore.delete(sessionId);
}

// -- OAuth helpers ------------------------------------------------------------

export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const config = getConfig();
  if (!config) throw new Error("Strava is not configured");

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:write,activity:read_all",
    state,
  });

  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<StravaTokens> {
  const config = getConfig();
  if (!config) throw new Error("Strava is not configured");

  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava token exchange failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteId: data.athlete?.id,
    athleteName: `${data.athlete?.firstname ?? ""} ${data.athlete?.lastname ?? ""}`.trim(),
  };
}

async function refreshAccessToken(tokens: StravaTokens): Promise<StravaTokens> {
  const config = getConfig();
  if (!config) throw new Error("Strava is not configured");

  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava token refresh failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return {
    ...tokens,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

/** Return a valid access token, refreshing if expired. */
export async function getValidAccessToken(sessionId: string): Promise<string> {
  let tokens = tokenStore.get(sessionId);
  if (!tokens) throw new Error("Not connected to Strava");

  // Refresh if token expires in the next 60 seconds
  if (Date.now() / 1000 >= tokens.expiresAt - 60) {
    tokens = await refreshAccessToken(tokens);
    tokenStore.set(sessionId, tokens);
  }

  return tokens.accessToken;
}

// -- Activity upload ----------------------------------------------------------

function buildGpxXml(activity: StravaActivityData): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<gpx version="1.1" creator="RunFlex"');
  lines.push('  xmlns="http://www.topografix.com/GPX/1/1"');
  lines.push('  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
  lines.push('  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">');
  lines.push('  <trk>');
  lines.push(`    <name>${escapeXml(activity.name)}</name>`);
  lines.push('    <type>running</type>');
  lines.push('    <trkseg>');

  for (const pos of activity.positions) {
    const isoTime = new Date(pos.time).toISOString();
    lines.push(`      <trkpt lat="${pos.lat}" lon="${pos.lng}"><time>${isoTime}</time></trkpt>`);
  }

  lines.push('    </trkseg>');
  lines.push('  </trk>');
  lines.push('</gpx>');
  return lines.join("\n");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function uploadActivity(
  sessionId: string,
  activity: StravaActivityData
): Promise<{ stravaActivityId: number }> {
  const accessToken = await getValidAccessToken(sessionId);

  const gpx = buildGpxXml(activity);

  // Strava upload API expects multipart/form-data
  const boundary = "----RunFlexBoundary" + Date.now();
  const parts: string[] = [];

  function addField(name: string, value: string) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`);
  }

  addField("activity_type", "run");
  addField("name", activity.name);
  addField("data_type", "gpx");
  if (activity.description) addField("description", activity.description);

  // File part
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="activity.gpx"\r\nContent-Type: application/gpx+xml\r\n\r\n${gpx}`
  );
  parts.push(`--${boundary}--`);

  const body = parts.join("\r\n");

  const resp = await fetch("https://www.strava.com/api/v3/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava upload failed (${resp.status}): ${text}`);
  }

  const upload = await resp.json();

  // Strava processes uploads asynchronously. Poll for completion.
  const uploadId = upload.id;
  let activityId: number | null = upload.activity_id;

  if (!activityId && uploadId) {
    // Poll up to 10 times (1s intervals)
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const check = await fetch(`https://www.strava.com/api/v3/uploads/${uploadId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (check.ok) {
        const status = await check.json();
        if (status.activity_id) {
          activityId = status.activity_id;
          break;
        }
        if (status.error) {
          throw new Error(`Strava processing error: ${status.error}`);
        }
      }
    }
  }

  return { stravaActivityId: activityId ?? 0 };
}
