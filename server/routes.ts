import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { routeFilterSchema } from "@shared/schema";
import { generateRoutes } from "./services/route-generator";
import { searchLocations, geocodeLocation } from "./services/location-service";
import { generateCircularRoute, hasRetracing, isGoodLoop, computeLoopScore } from "./generateCircularRoute";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function findFurthestPoint(
  routePath: { lat: number; lng: number }[],
  start: { lat: number; lng: number }
): { lat: number; lng: number } {
  let maxDist = 0;
  let furthest = routePath[0];
  for (const p of routePath) {
    const d = haversineKm(start.lat, start.lng, p.lat, p.lng);
    if (d > maxDist) { maxDist = d; furthest = p; }
  }
  return furthest;
}

async function reverseGeocodeAtPoint(lat: number, lng: number, types: string = 'address,poi'): Promise<{ name: string; isVenue: boolean } | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=${types}&limit=3&access_token=${token}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.features || data.features.length === 0) return null;

    for (const feat of data.features) {
      const cats = (feat.properties?.category || '') + ' ' + (feat.place_type || []).join(' ');
      if (/bar|pub|restaurant|cafe|club|cinema|theatre|theater|music|bowling|arcade|entertainment/i.test(cats)) {
        const venueName = feat.text || feat.properties?.name;
        if (venueName) return { name: venueName, isVenue: true };
      }
    }

    const feat = data.features[0];
    const placeName: string = feat.place_name || '';
    const roadMatch = placeName.split(',')[0]?.trim();
    if (roadMatch && roadMatch.length > 2) {
      return { name: roadMatch.replace(/^\d+\s+/, ''), isVenue: false };
    }
    return feat.text ? { name: feat.text, isVenue: false } : null;
  } catch {
    return null;
  }
}

async function resolveStartAreaName(lat: number, lng: number, queryHint?: string): Promise<string> {
  if (queryHint) {
    const cleaned = queryHint.trim().replace(/^Your Location.*$/, '');
    if (cleaned && !/^[A-Z]{1,2}\d/.test(cleaned)) {
      return cleaned.split(',')[0].trim();
    }
  }
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return '';
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,locality,place&limit=1&access_token=${token}`;
    const resp = await fetch(url);
    if (!resp.ok) return '';
    const data = await resp.json();
    if (data.features?.[0]?.text) return data.features[0].text;
    return '';
  } catch {
    return '';
  }
}

// Discover nearby POIs along a route using reverse geocoding at sampled points
async function findNearbyPOIsViaGeocode(
  routePath: { lat: number; lng: number }[],
  usedNames: Set<string>,
  startAreaName: string,
  maxResults: number = 3
): Promise<string[]> {
  if (routePath.length < 4) return [];

  const startLower = startAreaName.toLowerCase();
  const sampleIndices = [
    Math.floor(routePath.length * 0.25),
    Math.floor(routePath.length * 0.5),
    Math.floor(routePath.length * 0.75),
  ];

  const names: string[] = [];
  for (const idx of sampleIndices) {
    if (names.length >= maxResults) break;
    const pt = routePath[idx];
    const result = await reverseGeocodeAtPoint(pt.lat, pt.lng, 'poi,neighborhood,locality');
    if (result && !usedNames.has(result.name) && !result.name.toLowerCase().includes(startLower)) {
      names.push(result.name);
    }
  }
  return names;
}

async function generateLoopName(
  routePath: { lat: number; lng: number }[],
  km: number,
  mins: string | number,
  usedNames: Set<string>,
  fallbackIdx: number,
  startAreaName: string
): Promise<string> {
  const suffix = ` (${typeof km === 'number' ? km.toFixed(1) : km} km • ${mins} min)`;
  const maxPrefix = 44 - suffix.length;

  // Try reverse geocoding at sampled points along the route
  const nearby = await findNearbyPOIsViaGeocode(routePath, usedNames, startAreaName, 3);

  const prefixes = [
    ...nearby.map(n => `Loop via ${n}`),
    ...nearby.map(n => `Loop past ${n}`),
  ];

  for (const prefix of prefixes) {
    if (prefix.length <= maxPrefix && !usedNames.has(prefix)) {
      usedNames.add(prefix);
      return prefix + suffix;
    }
  }

  const furthest = findFurthestPoint(routePath, routePath[0]);
  const geocoded = await reverseGeocodeAtPoint(furthest.lat, furthest.lng);
  if (geocoded) {
    const label = geocoded.name;
    const verb = geocoded.isVenue ? 'past' : 'via';
    const candidatePrefixes = [
      `Loop ${verb} ${label}`,
      `Loop via ${label}`,
      `Loop past ${label}`,
    ];
    for (const prefix of candidatePrefixes) {
      if (prefix.length <= maxPrefix && !usedNames.has(prefix)) {
        usedNames.add(prefix);
        usedNames.add(label);
        return prefix + suffix;
      }
    }
  }

  const midIdx = Math.floor(routePath.length * 0.35);
  const midPoint = routePath[midIdx];
  if (midPoint) {
    const midGeocoded = await reverseGeocodeAtPoint(midPoint.lat, midPoint.lng);
    if (midGeocoded) {
      const label = midGeocoded.name;
      const verb = midGeocoded.isVenue ? 'past' : 'via';
      const candidatePrefixes = [
        `Loop ${verb} ${label}`,
        `Loop via ${label}`,
      ];
      for (const prefix of candidatePrefixes) {
        if (prefix.length <= maxPrefix && !usedNames.has(prefix) && !usedNames.has(label)) {
          usedNames.add(prefix);
          usedNames.add(label);
          return prefix + suffix;
        }
      }
    }
  }

  const fb = `Loop Route ${fallbackIdx}`;
  usedNames.add(fb);
  return fb + suffix;
}

/**
 * Try to build a start point from any of:
 *  - startPoint (JSON)  e.g. {"lat":51.5,"lng":-0.12}
 *  - startLat/startLng  e.g. 51.5 / -0.12
 *  - startPostcode OR q e.g. "NW7 3DS"  (will resolve via getLondonLocations)
 */
async function resolveStartPoint(req: any): Promise<{ lat: number; lng: number } | null> {
  // 1) startPoint JSON
  const startPointStr = req.query.startPoint as string | undefined;
  if (startPointStr) {
    try {
      const sp = JSON.parse(startPointStr);
      if (sp && typeof sp.lat === "number" && typeof sp.lng === "number") {
        return { lat: sp.lat, lng: sp.lng };
      }
    } catch {
      // fall through
    }
  }

  // 2) startLat/startLng
  const startLat = req.query.startLat ? parseFloat(req.query.startLat as string) : undefined;
  const startLng = req.query.startLng ? parseFloat(req.query.startLng as string) : undefined;
  if (Number.isFinite(startLat) && Number.isFinite(startLng)) {
    return { lat: startLat as number, lng: startLng as number };
  }

  // 3) startPostcode or q (free text). Resolve via locations service.
  const postcodeOrQuery =
    (req.query.startPostcode as string | undefined) ||
    (req.query.q as string | undefined) ||
    undefined;

  if (postcodeOrQuery && postcodeOrQuery.trim()) {
    const query = postcodeOrQuery.trim();

    if (query.startsWith("Your Location (") && query.endsWith(")")) {
      try {
        const coordString = query.substring("Your Location (".length, query.length - 1);
        const [latStr, lngStr] = coordString.split(",");
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      } catch {
        // fall through
      }
    }

    const geocoded = await geocodeLocation(query);
    if (geocoded) {
      return geocoded;
    }

    try {
      const matches = await searchLocations(query);
      const picked = matches[0];
      if (picked?.point?.lat != null && picked?.point?.lng != null) {
        return { lat: picked.point.lat, lng: picked.point.lng };
      }
    } catch {
      // ignore and fall through
    }
  }

  return null;
}

/**
 * Classify a route's surface type from Mapbox Directions step data.
 * Analyzes step names and distance to determine road vs trail vs mixed.
 */
function classifySurfaceType(steps: any[]): 'road' | 'trail' | 'mixed' {
  if (!steps || steps.length === 0) return 'road';

  const trailPatterns = /\b(path|footpath|foot path|track|trail|bridleway|towpath|footway|cycleway|cycle path|park|garden|wood|forest|heath|common|green|meadow|field)\b/i;
  const roadPatterns = /\b(road|street|avenue|lane|drive|close|crescent|terrace|way|boulevard|highway|grove|place|court|square|parade|rise|hill|mount|row|walk|mews|passage)\b/i;

  let trailDistance = 0;
  let roadDistance = 0;

  for (const step of steps) {
    const name = step.name || '';
    const dist = step.distance || 0;

    if (!name || name === '') {
      // Unnamed segments are typically paths/trails
      trailDistance += dist;
    } else if (trailPatterns.test(name)) {
      trailDistance += dist;
    } else if (roadPatterns.test(name)) {
      roadDistance += dist;
    } else {
      // Default unknown named segments to road
      roadDistance += dist;
    }
  }

  const total = trailDistance + roadDistance;
  if (total === 0) return 'road';

  const trailRatio = trailDistance / total;
  if (trailRatio >= 0.6) return 'trail';
  if (trailRatio >= 0.25) return 'mixed';
  return 'road';
}

/**
 * Check if it's near sunset or dark at the user's location.
 * Returns { daytime, nearSunset } where nearSunset means within 2h of sunset or after.
 */
async function getSunsetStatus(lat: number, lng: number): Promise<{ daytime: boolean; nearSunset: boolean }> {
  try {
    const res = await fetch(`https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=today&timezone=auto`);
    if (!res.ok) return { daytime: true, nearSunset: false };
    const data = await res.json();
    if (data.status !== 'OK') return { daytime: true, nearSunset: false };

    // Parse sunset time (format: "7:42:18 PM")
    const sunsetStr = data.results?.sunset;
    if (!sunsetStr) return { daytime: true, nearSunset: false };

    // Build today's date with the sunset time
    const now = new Date();
    const [time, period] = sunsetStr.split(' ');
    const [h, m] = time.split(':').map(Number);
    let hour = h;
    if (period === 'PM' && h !== 12) hour += 12;
    if (period === 'AM' && h === 12) hour = 0;

    const sunset = new Date(now);
    sunset.setHours(hour, m, 0, 0);

    const hoursUntilSunset = (sunset.getTime() - now.getTime()) / (1000 * 60 * 60);

    return {
      daytime: hoursUntilSunset > 2,
      nearSunset: hoursUntilSunset <= 2,
    };
  } catch {
    return { daytime: true, nearSunset: false }; // Default to daytime if API fails
  }
}

/**
 * Check if a route follows well-lit streets using OpenStreetMap Overpass API.
 * Samples points along the route and checks for streets tagged lit=yes.
 */
async function isRouteLit(routePath: { lat: number; lng: number }[]): Promise<boolean> {
  if (routePath.length < 2) return false;
  try {
    // Sample 5 evenly spaced points along the route
    const indices = [0, 0.25, 0.5, 0.75, 1].map(f => Math.floor(f * (routePath.length - 1)));
    const samplePoints = indices.map(i => routePath[i]);

    const aroundClauses = samplePoints
      .map(p => `way["lit"="yes"]["highway"](around:150,${p.lat},${p.lng});`)
      .join('');

    const query = `[out:json][timeout:10];(${aroundClauses});out count;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    const totalLitWays = data.elements?.[0]?.tags?.total ? parseInt(data.elements[0].tags.total) : 0;

    // Route is well-lit if we found lit streets near most sample points
    // (each sample should find ~2-5 ways if the area is well lit)
    return totalLitWays >= samplePoints.length;
  } catch {
    return false;
  }
}

/**
 * Check if a route passes near cultural sites (museums, galleries, theatres, monuments).
 * Uses Mapbox geocoding to search for cultural POIs near sample points.
 * Returns an array of found cultural sites with their names and locations.
 */
type CulturalSiteResult = { name: string; lat: number; lng: number };

async function findCulturalSitesAlongRoute(routePath: { lat: number; lng: number }[]): Promise<CulturalSiteResult[]> {
  if (routePath.length < 2) return [];
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return [];

  const culturalQueries = ['museum', 'gallery', 'theatre', 'monument', 'historic', 'cathedral', 'castle'];

  // Check at 3 points along the route
  const sampleIndices = [
    Math.floor(routePath.length * 0.25),
    Math.floor(routePath.length * 0.5),
    Math.floor(routePath.length * 0.75),
  ];

  const found: CulturalSiteResult[] = [];
  const seenNames = new Set<string>();

  for (const idx of sampleIndices) {
    const pt = routePath[idx];
    for (const query of culturalQueries) {
      try {
        const params = new URLSearchParams({
          access_token: token,
          types: 'poi',
          proximity: `${pt.lng},${pt.lat}`,
          limit: '1',
        });
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data.features?.length > 0) {
          const poi = data.features[0];
          const poiLat = poi.center[1];
          const poiLng = poi.center[0];
          const dLat = (poiLat - pt.lat) * 111;
          const dLng = (poiLng - pt.lng) * 111 * Math.cos(pt.lat * Math.PI / 180);
          const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
          if (distKm < 1.0 && !seenNames.has(poi.text)) {
            seenNames.add(poi.text);
            found.push({ name: poi.text, lat: poiLat, lng: poiLng });
          }
        }
      } catch { continue; }
    }
  }
  return found;
}

/**
 * Annotate direction steps with nearby cultural site names.
 * For each cultural site, finds the closest point on the route path, then maps
 * that to the corresponding direction step based on cumulative distance.
 */
function annotateCulturalSitesOnDirections(
  directions: { instruction: string; distance: number; duration: number; culturalSite?: string }[],
  routePath: { lat: number; lng: number }[],
  culturalSites: CulturalSiteResult[]
) {
  if (!routePath.length || !directions.length || !culturalSites.length) return;

  // Build cumulative distance along route path points
  const cumDist: number[] = [0];
  for (let i = 1; i < routePath.length; i++) {
    const dLat = (routePath[i].lat - routePath[i - 1].lat) * 111;
    const dLng = (routePath[i].lng - routePath[i - 1].lng) * 111 * Math.cos(routePath[i].lat * Math.PI / 180);
    cumDist.push(cumDist[i - 1] + Math.sqrt(dLat * dLat + dLng * dLng));
  }
  const totalRouteDist = cumDist[cumDist.length - 1];

  // Build cumulative distance thresholds for each direction step
  const stepEnds: number[] = [];
  let acc = 0;
  for (const step of directions) {
    acc += step.distance;
    stepEnds.push(acc);
  }

  for (const site of culturalSites) {
    // Find the closest route path point to this cultural site
    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < routePath.length; i++) {
      const dLat = (site.lat - routePath[i].lat) * 111;
      const dLng = (site.lng - routePath[i].lng) * 111 * Math.cos(routePath[i].lat * Math.PI / 180);
      const d = Math.sqrt(dLat * dLat + dLng * dLng);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    // Map route path position to direction step
    const siteRouteKm = cumDist[closestIdx];
    // Scale to direction step distances (they may not match route path total exactly)
    const totalStepDist = stepEnds[stepEnds.length - 1] || 1;
    const scaledKm = (siteRouteKm / (totalRouteDist || 1)) * totalStepDist;

    let stepIdx = directions.length - 1;
    for (let i = 0; i < stepEnds.length; i++) {
      if (scaledKm <= stepEnds[i]) {
        stepIdx = i;
        break;
      }
    }

    // Only set if this step doesn't already have a cultural site
    if (!directions[stepIdx].culturalSite) {
      directions[stepIdx].culturalSite = site.name;
    }
  }
}

/**
 * Check if a route passes through or near green areas (parks, woods, gardens).
 * Samples 3 points along the route and checks for nearby green POIs via Mapbox.
 */
async function routePassesThroughGreenArea(
  routePath: { lat: number; lng: number }[]
): Promise<boolean> {
  if (routePath.length < 4) return false;
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return false;

  const samplePoints = [
    routePath[Math.floor(routePath.length * 0.25)],
    routePath[Math.floor(routePath.length * 0.5)],
    routePath[Math.floor(routePath.length * 0.75)],
  ];

  // Search for multiple types of green spaces
  const greenQueries = ['park', 'garden', 'wood', 'nature'];

  for (const pt of samplePoints) {
    for (const query of greenQueries) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?proximity=${pt.lng},${pt.lat}&types=poi&limit=1&access_token=${token}`;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data.features?.length > 0) {
          const poi = data.features[0];
          const poiLat = poi.center[1];
          const poiLng = poi.center[0];
          const dLat = (poiLat - pt.lat) * 111;
          const dLng = (poiLng - pt.lng) * 111 * Math.cos(pt.lat * Math.PI / 180);
          const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
          if (distKm < 0.8) return true; // Within 800m of route
        }
      } catch {
        continue;
      }
    }
  }
  return false;
}

function filterValidRoutes(routes: any[], targetKm: number, targetType?: string, targetDurationMin?: number, surfaceType?: string, requiredFeatures?: string[]): any[] {
  const minDistanceKm = 0.2;
  const minRatioOfTarget = 0.3;
  const minTargetDistance = Math.max(minDistanceKm, targetKm * minRatioOfTarget);

  return routes.filter((route) => {
    if (!route.distance || route.distance < minDistanceKm) {
      console.log(`❌ Filtered out "${route.name}": distance ${route.distance}km is effectively zero`);
      return false;
    }

    if (route.distance < minTargetDistance) {
      console.log(`❌ Filtered out "${route.name}": distance ${route.distance.toFixed(1)}km is too far below target ${targetKm}km (min ${minTargetDistance.toFixed(1)}km)`);
      return false;
    }

    if (targetType === 'duration' && targetDurationMin && route.estimatedTime) {
      const isShortRun = targetDurationMin <= 15;
      const isMediumRun = targetDurationMin <= 30;
      const minFactor = isShortRun ? 0.40 : isMediumRun ? 0.50 : 0.65;
      const maxFactor = isShortRun ? 2.50 : isMediumRun ? 1.80 : 1.50;
      const minDuration = targetDurationMin * minFactor;
      const maxDuration = targetDurationMin * maxFactor;
      if (route.estimatedTime < minDuration) {
        console.log(`❌ Filtered out "${route.name}": estimated time ${route.estimatedTime}min is too far below target ${targetDurationMin}min (min ${minDuration.toFixed(0)}min)`);
        return false;
      }
      if (route.estimatedTime > maxDuration) {
        console.log(`❌ Filtered out "${route.name}": estimated time ${route.estimatedTime}min exceeds target ${targetDurationMin}min (max ${maxDuration.toFixed(0)}min)`);
        return false;
      }
    }

    // Surface type filter
    if (surfaceType && route.surfaceType && route.surfaceType !== surfaceType) {
      return false;
    }

    // Required features filter — route must have ALL requested features
    if (requiredFeatures && requiredFeatures.length > 0 && Array.isArray(route.features)) {
      const routeFeatures = route.features.map((f: string) => f.toLowerCase());
      const missing = requiredFeatures.some(rf => !routeFeatures.includes(rf.toLowerCase()));
      if (missing) return false;
    }

    return true;
  });
}

// --- helpers for LOOP mode ---
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function appendStartIfNeeded(
  geometry: { type: "LineString"; coordinates: [number, number][] },
  startLng: number,
  startLat: number
) {
  const coords = geometry.coordinates;
  if (!coords?.length) return;
  const last = coords[coords.length - 1];
  const distLastToStart = haversineMeters(last[1], last[0], startLat, startLng);
  if (distLastToStart > 50) {
    // ensure the loop *finishes* at the start
    coords.push([startLng, startLat]);
  }
  const first = coords[0];
  const distFirstToStart = haversineMeters(first[1], first[0], startLat, startLng);
  if (distFirstToStart > 50) {
    // ensure the loop *starts* at the start
    coords.unshift([startLng, startLat]);
  }
}

function withinTolerance(valueKm: number, targetKm: number, pct = 0.15) {
  if (!targetKm) return true;
  const min = targetKm * (1 - pct);
  const max = targetKm * (1 + pct);
  return valueKm >= min && valueKm <= max;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/routes
  app.get("/api/routes", async (req, res) => {
    try {
      // Mode & options
      let routeMode = (req.query.routeMode as string | undefined) || "loop";
      const targetDistance = req.query.targetDistance
        ? parseFloat(req.query.targetDistance as string)
        : undefined;

      // Resolve REQUIRED startPoint (from JSON, lat/lng, or postcode/q)
      const startPoint = await resolveStartPoint(req);
      console.log(
        startPoint
          ? `ℹ️ using startPoint lat=${startPoint.lat}, lng=${startPoint.lng}`
          : "ℹ️ startPoint still missing"
      );

      if (!startPoint) {
        return res.status(400).json({
          message:
            "A starting point is required. Provide startPoint (JSON), startLat/startLng, or startPostcode (or q).",
        });
      }

      const queryHint = (req.query.startPostcode as string) || (req.query.q as string) || undefined;
      const startAreaName = await resolveStartAreaName(startPoint.lat, startPoint.lng, queryHint);

      let endPoint: { lat: number; lng: number } | undefined = undefined;

      const endPointStr = req.query.endPoint as string | undefined;
      if (endPointStr) {
        try {
          const ep = JSON.parse(endPointStr);
          if (ep && typeof ep.lat === "number" && typeof ep.lng === "number" && (ep.lat !== 0 || ep.lng !== 0)) {
            endPoint = { lat: ep.lat, lng: ep.lng };
          }
        } catch {
          // not JSON, ignore
        }
      }

      if (!endPoint) {
        const endPostcode =
          (req.query.endPostcode as string | undefined) || undefined;
        if (endPostcode && endPostcode.trim()) {
          const query = endPostcode.trim();
          if (query.startsWith("Your Location (") && query.endsWith(")")) {
            try {
              const coordString = query.substring("Your Location (".length, query.length - 1);
              const [latStr, lngStr] = coordString.split(",");
              const lat = parseFloat(latStr);
              const lng = parseFloat(lngStr);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                endPoint = { lat, lng };
              }
            } catch {}
          }
          if (!endPoint) {
            const geocoded = await geocodeLocation(query);
            if (geocoded) {
              endPoint = geocoded;
            }
          }
          if (!endPoint) {
            try {
              const matches = await searchLocations(query);
              const picked = matches[0];
              if (picked?.point?.lat != null && picked?.point?.lng != null) {
                endPoint = { lat: picked.point.lat, lng: picked.point.lng };
              }
            } catch {}
          }
        }
      }

      if (endPoint) {
        console.log(`ℹ️ using endPoint lat=${endPoint.lat}, lng=${endPoint.lng}`);
      } else {
        console.log(`ℹ️ no endPoint resolved`);
        if (routeMode === "a_to_b" || routeMode === "duration") {
          console.log(`ℹ️ no endpoint provided for "${routeMode}" mode, falling back to "loop"`);
          routeMode = "loop";
        }
      }

      // Additional filters (all optional)
      const minDistance = req.query.minDistance
        ? parseFloat(req.query.minDistance as string)
        : undefined;
      const maxDistance = req.query.maxDistance
        ? parseFloat(req.query.maxDistance as string)
        : undefined;
      const sceneryRating = req.query.sceneryRating
        ? parseInt(req.query.sceneryRating as string, 10)
        : undefined;
      const trafficLevel = req.query.trafficLevel
        ? parseInt(req.query.trafficLevel as string, 10)
        : undefined;
      const routeType = req.query.routeType as string | undefined;
      const surfaceType = req.query.surfaceType as string | undefined;
      const requiredFeatures = req.query.requiredFeatures
        ? (req.query.requiredFeatures as string).split(",").filter(Boolean)
        : undefined;
      const targetType = (req.query.targetType as string | undefined) || 'distance';
      const distanceUnit = (req.query.distanceUnit as string | undefined) || 'km';
      const rawTargetDuration = req.query.targetDuration
        ? parseInt(req.query.targetDuration as string, 10)
        : undefined;

      let effectiveTargetDistance = targetDistance;
      if (effectiveTargetDistance && distanceUnit === 'miles') {
        effectiveTargetDistance = effectiveTargetDistance * 1.60934;
      }

      const effectiveTargetDuration = targetType === 'duration' ? rawTargetDuration : undefined;
      const effectiveDistance = targetType === 'distance' ? effectiveTargetDistance : undefined;

      console.log(`ℹ️ targetType=${targetType}, targetDistance=${effectiveDistance}km, targetDuration=${effectiveTargetDuration}min`);

      const filterCandidate: any = {
        startPoint,
        minDistance,
        maxDistance,
        sceneryRating,
        trafficLevel,
        routeType,
        surfaceType,
        requiredFeatures,
        routeMode,
        targetDuration: effectiveTargetDuration,
        targetDistance: effectiveDistance,
        targetType,
      };
      if (endPoint) filterCandidate.endPoint = endPoint;

      const filterResult = routeFilterSchema.safeParse(filterCandidate);
      if (!filterResult.success) {
        return res.status(400).json({
          message: "Invalid filter parameters",
          errors: filterResult.error,
        });
      }

      // Running pace: 5 min/km. Mapbox returns walking durations (~12 min/km).
      // Convert walking time to running time: multiply by 5/12 ≈ 0.42
      const RUNNING_PACE_MIN_PER_KM = 5;
      const WALK_TO_RUN_FACTOR = 0.42;
      const estimateRunningMins = (distKm: number) => Math.round(distKm * RUNNING_PACE_MIN_PER_KM);
      const walkingToRunningMins = (walkingSeconds: number) => Math.round((walkingSeconds / 60) * WALK_TO_RUN_FACTOR);

      // Shared helper: fetch walking route with step data for surface classification
      async function fetchMapboxWalkingWithSteps(coords: [number, number][]): Promise<{ geometry: any; distance: number; duration: number; steps?: any[] } | null> {
        const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordStr}.json?geometries=geojson&overview=full&steps=true&access_token=${encodeURIComponent(mapboxToken)}`;
        try {
          const res2 = await fetch(url);
          if (!res2.ok) return null;
          const data = (await res2.json()) as any;
          const route = data?.routes?.[0];
          if (!route?.geometry?.coordinates) return null;
          const steps: any[] = [];
          for (const leg of (route.legs || [])) {
            for (const step of (leg.steps || [])) {
              steps.push(step);
            }
          }
          return { geometry: route.geometry, distance: route.distance, duration: route.duration, steps };
        } catch { return null; }
      }

      // LOOP mode: build multiple circular options close to target distance,
      // all starting/ending at startPoint
      if (routeMode === "loop") {
        try {
          let baseKm: number;
          if (targetType === 'duration' && effectiveTargetDuration) {
            baseKm = Math.max(0.8, effectiveTargetDuration / RUNNING_PACE_MIN_PER_KM);
          } else {
            baseKm = effectiveDistance || targetDistance || 5;
          }
          const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
          const pass2Bearings = [22, 67, 112, 157, 202, 247, 292, 337];

          async function runVariants(bearingList: number[], distKm: number) {
            const multipliers = [0.95, 1.0, 1.05];
            return Promise.all(
              bearingList.map(async (b) => {
                const m = multipliers[Math.floor(Math.random() * multipliers.length)];
                try {
                  return await generateCircularRoute(
                    [startPoint.lng, startPoint.lat],
                    distKm * m,
                    { bearingOffset: b }
                  );
                } catch {
                  return null;
                }
              })
            ).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null));
          }

          let variantsRaw = await runVariants(bearings, baseKm);

          const loops = variantsRaw.map((r, idx) => {
            appendStartIfNeeded(r.geometry, startPoint.lng, startPoint.lat);
            const km = r.distance / 1000;
            const runMins = estimateRunningMins(km);
            const minStr = String(runMins);

            const routePath = r.geometry.coordinates.map(coord => ({
              lat: coord[1],
              lng: coord[0]
            }));
            
            const score = computeLoopScore(r.geometry.coordinates);
            const isCleanLoop = !hasRetracing(r.geometry.coordinates) && isGoodLoop(r.geometry.coordinates);
            
            const directions = [
              {
                instruction: `Start your ${km.toFixed(1)}km loop from the selected location. Follow the mapped route and return to this same point.`,
                distance: 0.1,
                duration: 0.5
              },
              {
                instruction: `Continue along the loop route for approximately ${(km/2).toFixed(1)}km to reach the halfway point.`,
                distance: km/2,
                duration: runMins / 2
              },
              {
                instruction: `Complete the second half of your loop, returning to your starting point.`,
                distance: km/2,
                duration: runMins / 2
              }
            ];

            return {
              id: idx + 1,
              name: `Loop Option ${idx + 1} (${km.toFixed(1)} km • ${minStr} min)`,
              description: `Circular running route starting and ending at your selected location`,
              startPoint: { lat: startPoint.lat, lng: startPoint.lng },
              endPoint: { lat: startPoint.lat, lng: startPoint.lng },
              geometry: r.geometry,
              routePath: routePath,
              distance: km,
              duration: runMins,
              estimatedTime: runMins,
              circular: true,
              routeType: 'loop',
              sceneryRating: 3,
              trafficLevel: 2,
              directions: directions,
              surfaceType: idx % 2 === 0 ? 'road' as const : 'trail' as const,
              features: ['loop'],
              _isCleanLoop: isCleanLoop,
              _loopScore: score,
            };
          });

          const loopUsedNames = new Set<string>();
          for (let i = 0; i < loops.length; i++) {
            const l = loops[i];
            l.name = await generateLoopName(l.routePath, l.distance, l.estimatedTime ?? Math.round(l.duration ?? 0), loopUsedNames, i + 1, startAreaName);
          }

          const cleanLoops = loops.filter(l => {
            if (l._isCleanLoop) return true;
            console.log(`  ⚠️ "${l.name}" — score ${l._loopScore.toFixed(2)} (non-ideal shape)`);
            return false;
          });
          const dirtyLoops = loops.filter(l => !l._isCleanLoop)
            .sort((a, b) => (b._loopScore ?? 0) - (a._loopScore ?? 0));

          let allLoops = [...cleanLoops];

          if (allLoops.length < 4 && dirtyLoops.length > 0) {
            const viableDirty = dirtyLoops.filter(l => withinTolerance(l.distance, baseKm, 0.30));
            const needed = Math.min(4 - allLoops.length, viableDirty.length);
            if (needed > 0) {
              console.log(`  📋 Adding ${needed} fallback loops (best-scored non-ideal shapes within distance)`);
              allLoops.push(...viableDirty.slice(0, needed));
            }
          }

          if (allLoops.length < 3) {
            console.log(`  🔄 Pass 1 yielded ${allLoops.length} loops, running pass 2...`);
            const pass2Raw = await runVariants(pass2Bearings, baseKm);
            const pass2Loops = pass2Raw.map((r, idx) => {
              appendStartIfNeeded(r.geometry, startPoint.lng, startPoint.lat);
              const km = r.distance / 1000;
              const runMins2 = estimateRunningMins(km);
              const routePath = r.geometry.coordinates.map(coord => ({
                lat: coord[1],
                lng: coord[0]
              }));
              const score = computeLoopScore(r.geometry.coordinates);
              const isClean = !hasRetracing(r.geometry.coordinates) && isGoodLoop(r.geometry.coordinates);
              const directions = [
                { instruction: `Start your ${km.toFixed(1)}km loop from the selected location.`, distance: 0.1, duration: 0.5 },
                { instruction: `Continue along the loop for ${(km/2).toFixed(1)}km to the halfway point.`, distance: km/2, duration: runMins2/2 },
                { instruction: `Complete the loop back to start.`, distance: km, duration: runMins2 },
              ];
              return {
                id: allLoops.length + idx + 1,
                name: '',
                startPoint, endPoint: startPoint,
                distance: km, estimatedTime: runMins2,
                elevationGain: Math.round(km * 8),
                routePath, routeType: 'loop' as const,
                sceneryRating: 3, trafficLevel: 2, directions,
                surfaceType: idx % 2 === 0 ? 'road' as const : 'trail' as const,
              features: ['loop'],
                _isCleanLoop: isClean,
                _loopScore: score,
              };
            });
            for (let i = 0; i < pass2Loops.length; i++) {
              const l = pass2Loops[i];
              l.name = await generateLoopName(l.routePath, l.distance, l.estimatedTime, loopUsedNames, allLoops.length + i + 1, startAreaName);
            }
            const p2Clean = pass2Loops.filter(l => l._isCleanLoop);
            const p2Dirty = pass2Loops.filter(l => !l._isCleanLoop)
              .sort((a, b) => (b._loopScore ?? 0) - (a._loopScore ?? 0));
            allLoops.push(...p2Clean);
            if (allLoops.length < 3) {
              allLoops.push(...p2Dirty.slice(0, 3 - allLoops.length));
            }
          }

          const inBand = allLoops.filter((L) => withinTolerance(L.distance, baseKm, 0.25));
          const pick = (arr: typeof allLoops) =>
            arr
              .slice()
              .sort((a, b) => (b._loopScore ?? 0) - (a._loopScore ?? 0))
              .slice(0, 6);

          const result = pick(inBand.length >= 2 ? inBand : allLoops);

          const validLoops = filterValidRoutes(result, baseKm, targetType, effectiveTargetDuration, surfaceType, requiredFeatures);

          // Classify surface type for each loop
          await Promise.all(validLoops.map(async (l: any) => {
            try {
              const path = l.routePath;
              if (!path || path.length < 4) return;
              const pts: [number, number][] = [
                [path[0].lng, path[0].lat],
                [path[Math.floor(path.length * 0.33)].lng, path[Math.floor(path.length * 0.33)].lat],
                [path[Math.floor(path.length * 0.66)].lng, path[Math.floor(path.length * 0.66)].lat],
                [path[path.length - 1].lng, path[path.length - 1].lat],
              ];
              const walkResult = await fetchMapboxWalkingWithSteps(pts);
              if (walkResult?.steps) {
                l.surfaceType = classifySurfaceType(walkResult.steps);
              }
            } catch {}
          }));

          validLoops.forEach((r: any, i: number) => { r.id = i + 1; });

          console.log(
            `✅ Generated ${result.length} loop options, ${validLoops.length} passed validation from lat=${startPoint.lat}, lng=${startPoint.lng} (target ${baseKm.toFixed(
              1
            )} km)`
          );

          return res.json(validLoops);
        } catch (err) {
          console.error("❌ Error generating loop routes:", err);
          return res.status(500).json({ message: "Error generating loop route(s)" });
        }
      }

      if (routeMode === "all") {
        const allResults: any[] = [];
        const hasEnd = !!endPoint;
        const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || "";

        async function fetchMapboxWalking(coords: [number, number][]): Promise<{ geometry: any; distance: number; duration: number; steps?: any[] } | null> {
          const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
          const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordStr}.json?geometries=geojson&overview=full&steps=true&access_token=${encodeURIComponent(mapboxToken)}`;
          try {
            const res2 = await fetch(url);
            if (!res2.ok) return null;
            const data = (await res2.json()) as any;
            const route = data?.routes?.[0];
            if (!route?.geometry?.coordinates) return null;
            // Collect all steps from all legs for surface analysis
            const steps: any[] = [];
            for (const leg of (route.legs || [])) {
              for (const step of (leg.steps || [])) {
                steps.push(step);
              }
            }
            return { geometry: route.geometry, distance: route.distance, duration: route.duration, steps };
          } catch { return null; }
        }

        // Find nearby POIs via Mapbox geocoding (works globally, not London-only)
        async function findNearbyPOIsForAllMode(lat: number, lng: number, limit: number) {
          const token = process.env.MAPBOX_ACCESS_TOKEN || "";
          if (!token) return [];
          const results: { name: string; point: { lat: number; lng: number }; distKm: number; category: string }[] = [];

          const searches = [
            { query: "park", category: "park" },
            { query: "wood", category: "park" },
            { query: "forest", category: "park" },
            { query: "nature reserve", category: "park" },
            { query: "common", category: "park" },
            { query: "heath", category: "park" },
            { query: "river", category: "water" },
            { query: "trail", category: "park" },
            { query: "museum", category: "landmark" },
          ];

          await Promise.all(searches.map(async ({ query, category }) => {
            try {
              const params = new URLSearchParams({
                access_token: token,
                types: 'poi,neighborhood,locality',
                proximity: `${lng},${lat}`,
                country: 'gb',
                limit: '5',
              });
              const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
              const resp = await fetch(url);
              if (!resp.ok) return;
              const data = await resp.json();
              for (const feat of (data.features || [])) {
                const pLat = feat.center[1];
                const pLng = feat.center[0];
                const dLat = (pLat - lat) * 111;
                const dLng = (pLng - lng) * 111 * Math.cos(lat * Math.PI / 180);
                const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
                if (distKm >= 0.2 && distKm <= 32) { // 200m to ~20 miles
                  const name = feat.text || feat.place_name?.split(',')[0] || query;
                  results.push({ name, point: { lat: pLat, lng: pLng }, distKm, category });
                }
              }
            } catch { /* skip */ }
          }));

          results.sort((a, b) => a.distKm - b.distKm);
          return results.slice(0, limit);
        }

        const td = effectiveTargetDuration || 30;

        // --- 1) LOOP ROUTES: 4 loops adapted to target duration ---
        // Alternate surface types: even indices = road, odd = trail/mixed
        try {
          const loopDurations = td <= 10
            ? [td * 0.8, td, td * 1.2, td * 1.5].map(Math.round)
            : td <= 20
            ? [td * 0.7, td, td * 1.3, td * 1.6].map(Math.round)
            : hasEnd ? [45, 50, 55, 60] : [30, 40, 50, 60];
          const loopBearings = [0, 90, 180, 270];
          const loopVariants = await Promise.all(
            loopDurations.map(async (dur, i) => {
              const km = Math.max(0.8, dur / RUNNING_PACE_MIN_PER_KM);
              try {
                return await generateCircularRoute(
                  [startPoint.lng, startPoint.lat],
                  km,
                  { bearingOffset: loopBearings[i % loopBearings.length] }
                );
              } catch { return null; }
            })
          ).then(r => r.filter((x): x is NonNullable<typeof x> => x !== null));

          const allModeLoopNames = new Set<string>();
          const loopRoutesRaw = loopVariants.map((r, idx) => {
            appendStartIfNeeded(r.geometry, startPoint.lng, startPoint.lat);
            const km = r.distance / 1000;
            const mins = estimateRunningMins(km);
            const routePath = r.geometry.coordinates.map((coord: [number, number]) => ({ lat: coord[1], lng: coord[0] }));
            const score = computeLoopScore(r.geometry.coordinates);
            const isClean = !hasRetracing(r.geometry.coordinates) && isGoodLoop(r.geometry.coordinates);
            return {
              id: 0, name: '',
              startPoint, endPoint: startPoint,
              distance: km, estimatedTime: mins,
              elevationGain: Math.round(km * 8),
              routePath, routeType: 'loop',
              surfaceType: idx % 2 === 0 ? 'road' as const : 'trail' as const,
              sceneryRating: 3, trafficLevel: 2,
              directions: [
                { instruction: `Start your ${km.toFixed(1)}km loop.`, distance: 0.1, duration: 0.5 },
                { instruction: `Continue to the halfway point.`, distance: km / 2, duration: mins / 2 },
                { instruction: `Complete the loop back to start.`, distance: km, duration: mins },
              ],
              features: ['loop'] as string[],
              _loopScore: score, _isClean: isClean,
            };
          });
          for (let i = 0; i < loopRoutesRaw.length; i++) {
            const l = loopRoutesRaw[i];
            l.name = await generateLoopName(l.routePath, l.distance, l.estimatedTime, allModeLoopNames, i + 1, startAreaName);
          }
          const loopRoutes = loopRoutesRaw
          .filter(l => l._isClean || (l._loopScore ?? 0) >= 0.45)
          .sort((a, b) => (b._loopScore ?? 0) - (a._loopScore ?? 0))
          .slice(0, 4);

          // Classify surface type for each loop using sampled waypoints
          await Promise.all(loopRoutes.map(async (l: any) => {
            try {
              const path = l.routePath;
              if (!path || path.length < 4) return;
              // Sample 3 waypoints from the loop path
              const pts: [number, number][] = [
                [path[0].lng, path[0].lat],
                [path[Math.floor(path.length * 0.33)].lng, path[Math.floor(path.length * 0.33)].lat],
                [path[Math.floor(path.length * 0.66)].lng, path[Math.floor(path.length * 0.66)].lat],
                [path[path.length - 1].lng, path[path.length - 1].lat],
              ];
              const result = await fetchMapboxWalking(pts);
              if (result?.steps) {
                l.surfaceType = classifySurfaceType(result.steps);
              }
            } catch {}
          }));

          allResults.push(...loopRoutes);
          console.log(`  ✅ "all" mode: ${loopRoutes.length} loop routes`);
        } catch (err) {
          console.log(`  ⚠️ "all" mode: loop generation failed:`, err);
        }

        // --- 2) OUT-AND-BACK ROUTES (20-30%): 3 routes adapted to target ---
        try {
          const oabDurations = td <= 10
            ? [td * 0.8, td, td * 1.3].map(Math.round)
            : td <= 20
            ? [td * 0.7, td, td * 1.5].map(Math.round)
            : [30, 50, 75];
          const oabBearings = [45, 165, 285];
          const oabRoutes = await Promise.all(
            oabDurations.map(async (dur, i) => {
              const oneWayKm = dur / RUNNING_PACE_MIN_PER_KM / 2;
              const bearing = oabBearings[i];
              const toRad = (d: number) => (d * Math.PI) / 180;
              const R = 6371;
              const lat1 = toRad(startPoint.lat);
              const lng1 = toRad(startPoint.lng);
              const d = oneWayKm / R;
              const brng = toRad(bearing);
              const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
              const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
              const turnPt: [number, number] = [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];

              const outbound = await fetchMapboxWalking([[startPoint.lng, startPoint.lat], turnPt]);
              if (!outbound) return null;
              const returnLeg = await fetchMapboxWalking([turnPt, [startPoint.lng, startPoint.lat]]);
              if (!returnLeg) return null;

              const totalDist = (outbound.distance + returnLeg.distance) / 1000;
              const totalDur = estimateRunningMins(totalDist);
              const outCoords = outbound.geometry.coordinates as [number, number][];
              const retCoords = (returnLeg.geometry.coordinates as [number, number][]).slice(1);
              const fullCoords = [...outCoords, ...retCoords];
              const routePath = fullCoords.map(([lng2, lat2]) => ({ lat: lat2, lng: lng2 }));

              // Classify surface from actual Mapbox step data
              const allSteps = [...(outbound.steps || []), ...(returnLeg.steps || [])];
              const detectedSurface = classifySurfaceType(allSteps);
              return {
                id: 0,
                name: `Out & Back (${totalDist.toFixed(1)} km • ${totalDur} min)`,
                startPoint, endPoint: startPoint,
                distance: totalDist, estimatedTime: totalDur,
                elevationGain: Math.round(totalDist * 8),
                routePath, routeType: 'out_and_back',
                surfaceType: detectedSurface,
                sceneryRating: 3, trafficLevel: 2,
                directions: [
                  { instruction: `Head out from your starting point.`, distance: 0.1, duration: 0.5 },
                  { instruction: `Continue to the turnaround point at ${(totalDist / 2).toFixed(1)}km.`, distance: totalDist / 2, duration: totalDur / 2 },
                  { instruction: `Turn around and retrace your steps back to start.`, distance: totalDist, duration: totalDur },
                ],
                features: ['out_and_back'] as string[],
              };
            })
          ).then(r => r.filter((x): x is NonNullable<typeof x> => x !== null));

          allResults.push(...oabRoutes.slice(0, 3));
          console.log(`  ✅ "all" mode: ${Math.min(oabRoutes.length, 3)} out-and-back routes`);
        } catch (err) {
          console.log(`  ⚠️ "all" mode: out-and-back generation failed:`, err);
        }

        // --- 3) A-TO-B to POI ROUTES: routes to parks/landmarks/water ---
        try {
          const nearbyPOIs = await findNearbyPOIsForAllMode(startPoint.lat, startPoint.lng, 10);
          console.log(`  Found ${nearbyPOIs.length} nearby POIs: ${nearbyPOIs.map(p => `${p.name}(${p.distKm.toFixed(1)}km,${p.category})`).join(', ')}`);

          const poiRoutes = await Promise.all(
            nearbyPOIs.slice(0, 6).map(async (poi) => {
              const route = await fetchMapboxWalking([
                [startPoint.lng, startPoint.lat],
                [poi.point.lng, poi.point.lat]
              ]);
              if (!route) { console.log(`    ❌ POI "${poi.name}": Mapbox walking route failed`); return null; }
              const km = route.distance / 1000;
              const mins = estimateRunningMins(km);
              const minPOIMins = 2; // Minimum 2 min running time
              if (mins < minPOIMins) { console.log(`    ❌ POI "${poi.name}": too close (${mins}min)`); return null; }
              if (mins > 120) { console.log(`    ❌ POI "${poi.name}": too far (${mins}min)`); return null; }
              const routePath = (route.geometry.coordinates as [number, number][]).map(([lng2, lat2]) => ({ lat: lat2, lng: lng2 }));
              // Classify surface from actual Mapbox step data
              const detectedPoiSurface = classifySurfaceType(route.steps || []);
              // Scenic only if destination is a park/green space
              const isGreenSpace = poi.category === 'park' || poi.category === 'water';
              const poiFeatures: string[] = [poi.category];
              if (isGreenSpace) poiFeatures.push('scenic');
              // Routes TO green spaces are classified as trail regardless of road detection
              // (runners will be running through the green space, not just on roads to reach it)
              const poiSurface = isGreenSpace ? 'trail' as const : detectedPoiSurface;

              return {
                id: 0,
                name: `Run to ${poi.name} (${km.toFixed(1)} km • ${mins} min)`,
                startPoint, endPoint: poi.point,
                distance: km, estimatedTime: mins,
                elevationGain: Math.round(km * 8),
                routePath, routeType: 'a_to_b',
                surfaceType: poiSurface,
                sceneryRating: isGreenSpace ? 4 : 2,
                trafficLevel: isGreenSpace ? 1 : 2,
                directions: [
                  { instruction: `Head towards ${poi.name}.`, distance: 0.1, duration: 0.5 },
                  { instruction: `Continue along the route to ${poi.name}.`, distance: km / 2, duration: mins / 2 },
                  { instruction: `Arrive at ${poi.name}. ${km.toFixed(1)}km total.`, distance: km, duration: mins },
                ],
                features: poiFeatures,
                _poiCategory: poi.category,
              };
            })
          ).then(r => r.filter((x): x is NonNullable<typeof x> => x !== null));

          allResults.push(...poiRoutes.slice(0, 4));
          console.log(`  ✅ "all" mode: ${poiRoutes.length} POI routes found, using ${Math.min(poiRoutes.length, 4)}`);
        } catch (err) {
          console.log(`  ⚠️ "all" mode: POI route generation failed:`, err);
        }

        // --- With endpoint: also add A-to-B direct routes ---
        if (hasEnd) {
          try {
            const atobRoutes = await generateRoutes(
              JSON.stringify(startPoint),
              JSON.stringify(endPoint),
              {
                minDistance, maxDistance, sceneryRating, trafficLevel, routeType,
                routeMode: "a_to_b",
                targetDuration: effectiveTargetDuration,
                targetDistance: effectiveDistance || targetDistance,
                targetType: targetType as 'duration' | 'distance',
              }
            );
            const validAtob = atobRoutes
              .filter((r: any) => r.distance && r.distance > 0.2)
              .slice(0, 3);
            allResults.push(...validAtob);
            console.log(`  ✅ "all" mode: ${validAtob.length} A-to-B direct routes`);
          } catch (err) {
            console.log(`  ⚠️ "all" mode: A-to-B generation failed:`, err);
          }
        }

        const allTargetKm = effectiveDistance || targetDistance || (targetType === 'duration' && effectiveTargetDuration ? effectiveTargetDuration / RUNNING_PACE_MIN_PER_KM : 5);
        // In "all" mode, skip duration/distance filtering — show the full variety of route types
        const validAllResults = filterValidRoutes(allResults, 0.2, undefined, undefined, surfaceType, requiredFeatures);

        // Enrich routes with real data: scenic, well-lit, cultural sites
        // 1. Check sunset status for well-lit determination
        const sunsetStatus = await getSunsetStatus(startPoint.lat, startPoint.lng);
        console.log(`  🌅 Sunset status: daytime=${sunsetStatus.daytime}, nearSunset=${sunsetStatus.nearSunset}`);

        // 2. Enrich each route
        await Promise.all(validAllResults.map(async (r: any) => {
          if (!r.routePath || !Array.isArray(r.routePath)) return;
          const features = r.features || [];

          // Scenic: check green areas
          if (!features.includes('scenic')) {
            const isScenic = await routePassesThroughGreenArea(r.routePath);
            if (isScenic) {
              features.push('scenic');
              r.sceneryRating = Math.max(r.sceneryRating || 0, 4);
            }
          }

          // Well-lit: if daytime, all routes are well-lit.
          // If near sunset, check OpenStreetMap for lit streets.
          if (!features.includes('well_lit')) {
            if (sunsetStatus.daytime) {
              features.push('well_lit');
            } else {
              const lit = await isRouteLit(r.routePath);
              if (lit) features.push('well_lit');
            }
          }

          // Cultural sites: check for museums, galleries, etc. near route
          if (!features.includes('cultural_sites')) {
            const culturalSites = await findCulturalSitesAlongRoute(r.routePath);
            if (culturalSites.length > 0) {
              features.push('cultural_sites');
              // Annotate the nearest direction step for each cultural site
              if (Array.isArray(r.directions) && r.directions.length > 0) {
                annotateCulturalSitesOnDirections(r.directions, r.routePath, culturalSites);
              }
            }
          }

          r.features = features;
        }));

        // Guarantee all route types
        const hasLoop = validAllResults.some((r: any) => r.routeType === 'loop');
        const hasOAB = validAllResults.some((r: any) => r.routeType === 'out_and_back');
        const hasAtoB = validAllResults.some((r: any) => r.routeType === 'a_to_b');
        if (!hasLoop) console.log(`  ⚠️ "all" mode: no loop routes generated`);
        if (!hasOAB) console.log(`  ⚠️ "all" mode: no out-and-back routes generated`);
        if (!hasAtoB) console.log(`  ⚠️ "all" mode: no A-to-B routes generated`);

        // Guarantee at least 1 trail route — search for green spaces within 20 miles
        const surfaceCounts = { road: 0, trail: 0, mixed: 0, none: 0 };
        validAllResults.forEach((r: any) => { surfaceCounts[r.surfaceType || 'none']++; });
        console.log(`  Surface types: road=${surfaceCounts.road} trail=${surfaceCounts.trail} mixed=${surfaceCounts.mixed} none=${surfaceCounts.none}`);
        const hasTrail = validAllResults.some((r: any) => r.surfaceType === 'trail');
        if (!hasTrail) {
          console.log(`  🌲 No trail routes found, searching for green spaces within 20 miles...`);
          try {
            const greenSearches = ['park', 'wood', 'forest', 'nature reserve', 'heath', 'common'];
            let greenPOI: { name: string; point: { lat: number; lng: number }; distKm: number } | null = null;

            for (const query of greenSearches) {
              if (greenPOI) break;
              try {
                const params = new URLSearchParams({
                  access_token: mapboxToken,
                  types: 'poi,neighborhood,locality',
                  proximity: `${startPoint.lng},${startPoint.lat}`,
                  country: 'gb',
                  limit: '5',
                });
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
                const resp = await fetch(url);
                if (!resp.ok) continue;
                const data = await resp.json();
                for (const feat of (data.features || [])) {
                  const pLat = feat.center[1];
                  const pLng = feat.center[0];
                  const dLat = (pLat - startPoint.lat) * 111;
                  const dLng = (pLng - startPoint.lng) * 111 * Math.cos(startPoint.lat * Math.PI / 180);
                  const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
                  if (distKm >= 0.2 && distKm <= 32) {
                    const name = feat.text || feat.place_name?.split(',')[0] || query;
                    console.log(`  🌲 Found green space: "${name}" (${distKm.toFixed(1)}km, query="${query}")`);
                    greenPOI = { name, point: { lat: pLat, lng: pLng }, distKm };
                    break;
                  }
                }
              } catch { continue; }
            }

            if (greenPOI) {
              const trailRoute = await fetchMapboxWalking([
                [startPoint.lng, startPoint.lat],
                [greenPOI.point.lng, greenPOI.point.lat]
              ]);
              if (trailRoute) {
                const km = trailRoute.distance / 1000;
                const mins = estimateRunningMins(km);
                const routePath = (trailRoute.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng }));
                const detectedSurface = classifySurfaceType(trailRoute.steps || []);
                validAllResults.push({
                  id: 0,
                  name: `Trail to ${greenPOI.name} (${km.toFixed(1)} km • ${mins} min)`,
                  startPoint, endPoint: greenPOI.point,
                  distance: km, estimatedTime: mins,
                  elevationGain: Math.round(km * 10),
                  routePath, routeType: 'a_to_b',
                  surfaceType: 'trail' as any, // Route to a green space is always trail
                  sceneryRating: 4, trafficLevel: 1,
                  directions: [
                    { instruction: `Head towards ${greenPOI.name}.`, distance: 0.1, duration: 0.5 },
                    { instruction: `Continue through green spaces to ${greenPOI.name}.`, distance: km / 2, duration: mins / 2 },
                    { instruction: `Arrive at ${greenPOI.name}. ${km.toFixed(1)}km total.`, distance: km, duration: mins },
                  ],
                  features: ['scenic', 'low_traffic', 'park'],
                } as any);
                console.log(`  🌲 Added trail route to ${greenPOI.name} (${km.toFixed(1)}km, ${detectedSurface})`);
              }
            }
          } catch (err) {
            console.log(`  ⚠️ Trail route generation failed:`, err);
          }
        }

        validAllResults.forEach((r: any, i: number) => { r.id = i + 1; });
        const trailCount = validAllResults.filter((r: any) => r.surfaceType === 'trail' || r.surfaceType === 'mixed').length;
        console.log(`✅ "all" mode total: ${validAllResults.length} routes (loop=${hasLoop}, oab=${hasOAB}, atob=${hasAtoB}, trail/mixed=${trailCount})`);
        return res.json(validAllResults);
      }

      // A_TO_B or duration → existing generator
      const effectiveEndPoint = endPoint || startPoint;
      const routes = await generateRoutes(
        JSON.stringify(startPoint),
        JSON.stringify(effectiveEndPoint),
        {
          minDistance,
          maxDistance,
          sceneryRating,
          trafficLevel,
          routeType,
          routeMode: routeMode as "a_to_b" | "loop" | "duration" | "all" | undefined,
          targetDuration: effectiveTargetDuration,
          targetDistance: effectiveDistance || targetDistance,
          targetType: targetType as 'duration' | 'distance',
        }
      );

      // Fix estimated times: generateRoutes uses Mapbox walking duration (~12 min/km)
      // but we need running pace (5 min/km)
      routes.forEach((r: any) => {
        if (r.distance > 0) {
          r.estimatedTime = estimateRunningMins(r.distance);
        }
      });

      // For A-to-B with a specific destination, skip strict duration filtering
      // — the user chose WHERE to go, not how long to run
      const isDirectAtoB = routeMode === 'a_to_b' && endPoint;
      const targetKm = effectiveDistance || targetDistance || (targetType === 'duration' && effectiveTargetDuration ? effectiveTargetDuration / RUNNING_PACE_MIN_PER_KM : 5);
      const validRoutes = isDirectAtoB
        ? filterValidRoutes(routes, 0.2, undefined, undefined, surfaceType, requiredFeatures)
        : filterValidRoutes(routes, targetKm, targetType, effectiveTargetDuration, surfaceType, requiredFeatures);
      validRoutes.forEach((r: any, i: number) => { r.id = i + 1; });

      console.log(
        `Generated ${routes.length} routes, ${validRoutes.length} passed validation. First route distance: ${validRoutes[0]?.distance}km`
      );
      return res.json(validRoutes);
    } catch (error) {
      console.error("Error generating routes:", error);
      return res.status(500).json({ message: "Error generating routes" });
    }
  });

  // --- Saved routes (using /api/saved/* to avoid conflict with /api/routes/:id) ---

  app.post("/api/saved", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const route = req.body;
      if (!route || !route.name || !route.startPoint || !route.endPoint || route.distance == null) {
        return res.status(400).json({ message: "Invalid route data" });
      }
      console.log(`Saving route for userId=${req.user!.id}, routeName="${route.name?.substring(0, 40)}"`);
      const saved = await storage.saveRoute({
        ...route,
        userId: req.user!.id,
      });
      console.log(`Saved route id=${saved.id}, userId=${saved.userId}`);
      res.status(201).json(saved);
    } catch (error) {
      console.error("Error saving route:", error);
      res.status(500).json({ message: "Error saving route", detail: (error as any)?.message || String(error) });
    }
  });

  app.get("/api/saved", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const userRoutes = await storage.getRoutesByUserId(req.user!.id);
      res.json(userRoutes);
    } catch (error) {
      console.error("Error fetching saved routes:", error);
      res.status(500).json({ message: "Error fetching saved routes" });
    }
  });

  app.delete("/api/saved/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const routeId = parseInt(req.params.id, 10);
      if (isNaN(routeId)) {
        return res.status(400).json({ message: "Invalid route ID" });
      }
      await storage.deleteRoute(routeId, req.user!.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting saved route:", error);
      res.status(500).json({ message: "Error deleting saved route" });
    }
  });

  // GET /api/routes/:id
  app.get("/api/routes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid route ID" });
      }
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ message: "Route not found" });
      }
      return res.json(route);
    } catch (error) {
      console.error("Error fetching route:", error);
      return res.status(500).json({ message: "Error fetching route" });
    }
  });

  // POST /api/preferences
  app.post("/api/preferences", async (req, res) => {
    try {
      const {
        minDistance,
        maxDistance,
        sceneryPreference,
        trafficPreference,
        routeType,
      } = req.body;

      const preferences = {
        minDistance,
        maxDistance,
        sceneryPreference,
        trafficPreference,
        routeType,
      };

      const savedPreferences = await storage.savePreferences(preferences);
      return res.json(savedPreferences);
    } catch (error) {
      console.error("Error saving preferences:", error);
      return res.status(500).json({ message: "Error saving preferences" });
    }
  });

  // GET /api/config
  // Returns only the public/URL-restricted token for map tile rendering.
  // Use MAPBOX_PUBLIC_TOKEN for client-side map display (should be URL-restricted in Mapbox dashboard).
  // Falls back to MAPBOX_ACCESS_TOKEN if no public token is set.
  app.get("/api/config", (_req, res) => {
    const mapboxToken = process.env.MAPBOX_PUBLIC_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || "";
    res.json({ mapboxToken });
  });

  // Server-side proxy for Mapbox Directions API -- keeps the secret token off the client
  app.get("/api/mapbox/directions", async (req, res) => {
    try {
      const token = process.env.MAPBOX_ACCESS_TOKEN || "";
      if (!token) return res.status(500).json({ message: "Mapbox token not configured" });

      const profile = req.query.profile || "walking";
      const coordinates = req.query.coordinates as string;
      if (!coordinates) return res.status(400).json({ message: "coordinates parameter required" });

      const params = new URLSearchParams({
        access_token: token,
        geometries: "geojson",
        overview: "full",
        steps: (req.query.steps as string) || "false",
      });

      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}.json?${params}`;
      const resp = await fetch(url);
      if (!resp.ok) return res.status(resp.status).json({ message: "Mapbox API error" });
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      console.error("Directions proxy error:", err);
      res.status(500).json({ message: "Error proxying directions request" });
    }
  });

  // Server-side proxy for Mapbox Geocoding API
  app.get("/api/mapbox/geocode", async (req, res) => {
    try {
      const token = process.env.MAPBOX_ACCESS_TOKEN || "";
      if (!token) return res.status(500).json({ message: "Mapbox token not configured" });

      const query = req.query.q as string;
      if (!query) return res.status(400).json({ message: "q parameter required" });

      const types = (req.query.types as string) || "place,locality,neighborhood,address,poi";
      const limit = (req.query.limit as string) || "5";
      const proximity = req.query.proximity as string | undefined;
      const country = req.query.country as string | undefined;

      const params = new URLSearchParams({ access_token: token, types, limit });
      if (proximity) params.set("proximity", proximity);
      if (country) params.set("country", country);

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
      const resp = await fetch(url);
      if (!resp.ok) return res.status(resp.status).json({ message: "Mapbox API error" });
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      console.error("Geocode proxy error:", err);
      res.status(500).json({ message: "Error proxying geocode request" });
    }
  });

  // GET /api/locations -- global search via Mapbox geocoding
  app.get("/api/locations", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const proximity = req.query.proximity as string | undefined;
      const country = req.query.country as string | undefined;
      const locations = await searchLocations(query, proximity, country);
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Error fetching locations" });
    }
  });

  app.get("/api/reverse-geocode", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_API_KEY || "";
      if (!token) {
        return res.json({ name: null });
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,locality,place,address&limit=1&access_token=${token}`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.json({ name: null });
      }

      const data = await response.json();
      const feature = data.features?.[0];
      const name = feature?.text || feature?.place_name || null;
      res.json({ name });
    } catch (error) {
      console.error("Reverse geocode error:", error);
      res.json({ name: null });
    }
  });

  // HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
