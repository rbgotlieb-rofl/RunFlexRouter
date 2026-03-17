type LngLat = [number, number];

type RouteGeometry = {
  type: "LineString";
  coordinates: LngLat[];
};

export type CircularRouteResult = {
  geometry: RouteGeometry;
  distance: number;
  duration: number;
  loopScore?: number;
};

type Options = {
  profile?: "walking" | "cycling" | "driving";
  tolerance?: number;
  maxIterations?: number;
  bearingOffset?: number;
};

function destination(
  [lng, lat]: LngLat,
  bearingDeg: number,
  distanceKm: number
): LngLat {
  const R = 6371.0088;
  const δ = distanceKm / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);

  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  const lat2 = (φ2 * 180) / Math.PI;
  let lng2 = ((λ2 * 180) / Math.PI + 540) % 360 - 180;
  return [lng2, lat2];
}

function haversineDistance([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const R = 6371008.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeLoopScore(coords: LngLat[]): number {
  const n = coords.length;
  if (n < 10) return 0;

  const start = coords[0];
  const cosLat = Math.cos(start[1] * Math.PI / 180);

  const samples = 10;
  let spreadSum = 0;
  for (let s = 1; s <= samples; s++) {
    const idx = Math.floor((s / (samples + 1)) * n);
    const pt = coords[Math.min(idx, n - 1)];
    const dist = haversineDistance(start, pt);
    spreadSum += dist;
  }
  const avgSpread = spreadSum / samples;

  const lats = coords.map(c => c[1]);
  const lngs = coords.map(c => c[0]);
  const latRange = (Math.max(...lats) - Math.min(...lats)) * 111000;
  const lngRange = (Math.max(...lngs) - Math.min(...lngs)) * 111000 * cosLat;
  const maxDim = Math.max(latRange, lngRange);
  const minDim = Math.min(latRange, lngRange);
  const aspectRatio = maxDim > 0 ? minDim / maxDim : 0;

  const mid = Math.floor(n / 2);
  const midDist = haversineDistance(start, coords[mid]);
  const midRatio = maxDim > 0 ? midDist / maxDim : 0;

  const firstHalf = coords.slice(0, mid);
  const secondHalf = coords.slice(mid);
  const fhStep = Math.max(1, Math.floor(firstHalf.length / 15));
  const shStep = Math.max(1, Math.floor(secondHalf.length / 15));
  let closeSegments = 0;
  let totalSegments = 0;
  for (let i = Math.floor(firstHalf.length * 0.15); i < Math.floor(firstHalf.length * 0.85); i += fhStep) {
    for (let j = Math.floor(secondHalf.length * 0.15); j < Math.floor(secondHalf.length * 0.85); j += shStep) {
      const dist = haversineDistance(firstHalf[i], secondHalf[j]);
      totalSegments++;
      if (dist < 30) closeSegments++;
    }
  }
  const overlapRatio = totalSegments > 0 ? closeSegments / totalSegments : 0;
  const separationScore = 1 - Math.min(overlapRatio * 10, 1);

  const score = (aspectRatio * 0.3) + (midRatio * 0.3) + (separationScore * 0.4);
  return score;
}

function isGoodLoop(coords: LngLat[]): boolean {
  const n = coords.length;
  if (n < 10) return false;
  
  const start = coords[0];
  const end = coords[n - 1];
  const totalDist = haversineDistance(start, end);
  let routeLength = 0;
  for (let i = 1; i < n; i++) {
    routeLength += haversineDistance(coords[i - 1], coords[i]);
  }
  const isSmallLoop = routeLength < 1500;

  const mid = Math.floor(n / 2);
  const midDist = haversineDistance(start, coords[mid]);
  
  const lats = coords.map(c => c[1]);
  const lngs = coords.map(c => c[0]);
  const cosLat = Math.cos(start[1] * Math.PI / 180);
  const latRange = (Math.max(...lats) - Math.min(...lats)) * 111000;
  const lngRange = (Math.max(...lngs) - Math.min(...lngs)) * 111000 * cosLat;
  const maxDim = Math.max(latRange, lngRange);
  
  const midRatioThreshold = isSmallLoop ? 0.12 : 0.22;
  if (maxDim > 0 && midDist / maxDim < midRatioThreshold) {
    return false;
  }

  const firstHalf = coords.slice(Math.floor(n * 0.15), Math.floor(n * 0.45));
  const secondHalf = coords.slice(Math.floor(n * 0.55), Math.floor(n * 0.85));
  const step1 = Math.max(1, Math.floor(firstHalf.length / 12));
  const step2 = Math.max(1, Math.floor(secondHalf.length / 12));
  let tooCloseCount = 0;
  let totalPairs = 0;
  const closeThreshold = isSmallLoop ? 15 : 40;
  for (let i = 0; i < firstHalf.length; i += step1) {
    let minDist = Infinity;
    for (let j = 0; j < secondHalf.length; j += step2) {
      const d = haversineDistance(firstHalf[i], secondHalf[j]);
      if (d < minDist) minDist = d;
    }
    totalPairs++;
    if (minDist < closeThreshold) tooCloseCount++;
  }
  
  const overlapThreshold = isSmallLoop ? 0.5 : 0.3;
  if (totalPairs > 0 && tooCloseCount / totalPairs > overlapThreshold) {
    return false;
  }

  const score = computeLoopScore(coords);
  const minScore = isSmallLoop ? 0.20 : 0.35;
  return score >= minScore;
}

function hasRetracing(coords: LngLat[], thresholdMeters: number = 25): boolean {
  const n = coords.length;
  if (n < 10) return false;

  const skipStart = Math.floor(n * 0.1);
  const skipEnd = n - Math.floor(n * 0.1);

  let retracedPoints = 0;
  let totalChecked = 0;
  const step = Math.max(1, Math.floor(n / 80));

  for (let i = skipStart; i < Math.floor(n / 2); i += step) {
    const p1 = coords[i];

    for (let j = Math.max(i + Math.floor(n * 0.3), Math.floor(n / 2)); j < skipEnd; j += step) {
      const p2 = coords[j];
      const dist = haversineDistance(p1, p2);
      totalChecked++;
      if (dist < thresholdMeters) {
        retracedPoints++;
      }
    }
  }

  if (totalChecked === 0) return false;
  const ratio = retracedPoints / totalChecked;
  return ratio > 0.05;
}

async function getMapboxRoute(
  coords: LngLat[],
  profile: "walking" | "cycling" | "driving",
  accessToken: string
): Promise<CircularRouteResult | null> {
  const coordStr = coords.map(([x, y]) => `${x},${y}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}.json?geometries=geojson&overview=full&access_token=${encodeURIComponent(
    accessToken
  )}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as any;
  const route = data?.routes?.[0];
  if (!route?.geometry?.coordinates) return null;

  return {
    geometry: route.geometry as RouteGeometry,
    distance: route.distance as number,
    duration: route.duration as number,
  };
}

function makeLoopWaypoints(
  start: LngLat,
  radiusKm: number,
  bearingOffset: number = 0,
  waypointCount: number = 4
): LngLat[] {
  const points: LngLat[] = [start];
  const angleStep = 360 / waypointCount;

  for (let i = 0; i < waypointCount; i++) {
    const bearing = bearingOffset + i * angleStep;
    const jitter = (Math.random() - 0.5) * 15;
    const radiusJitter = radiusKm * (0.88 + Math.random() * 0.24);
    points.push(destination(start, bearing + jitter, radiusJitter));
  }

  points.push(start);
  return points;
}

export async function generateCircularRoute(
  startLngLat: LngLat,
  targetDistanceKm: number,
  options: Options = {}
): Promise<CircularRouteResult> {
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MAPBOX_ACCESS_TOKEN is missing");
  }

  const profile = options.profile ?? "walking";
  const tolerance = options.tolerance ?? 0.15;
  const maxIterations = options.maxIterations ?? 8;
  const bearingOffset = options.bearingOffset ?? 0;

  let lowKm = Math.max(0.3, targetDistanceKm * 0.12);
  let highKm = Math.max(lowKm + 0.3, targetDistanceKm * 0.55);

  let best: CircularRouteResult | null = null;
  let bestScore = -1;

  for (let i = 0; i < maxIterations; i++) {
    const midKm = (lowKm + highKm) / 2;
    const wpCount = targetDistanceKm < 3 ? 3 : 4;
    const waypoints = makeLoopWaypoints(startLngLat, midKm, bearingOffset, wpCount);
    const route = await getMapboxRoute(waypoints, profile, accessToken);
    if (!route) {
      lowKm = midKm * 0.9;
      continue;
    }

    const distKm = route.distance / 1000;
    const err = Math.abs(distKm - targetDistanceKm);
    const within = err <= targetDistanceKm * tolerance;

    const score = computeLoopScore(route.geometry.coordinates);
    const isClean = !hasRetracing(route.geometry.coordinates) && isGoodLoop(route.geometry.coordinates);
    route.loopScore = score;

    if (score > bestScore || (score === bestScore && err < (best ? Math.abs(best.distance / 1000 - targetDistanceKm) : Infinity))) {
      best = route;
      bestScore = score;
    }

    if (within && isClean) {
      console.log(`  ✅ Loop accepted: ${distKm.toFixed(1)}km (target ${targetDistanceKm.toFixed(1)}km), bearing ${bearingOffset}°, score ${score.toFixed(2)}`);
      return route;
    }
    if (within && !isClean) {
      console.log(`  ❌ Loop rejected: ${distKm.toFixed(1)}km, bearing ${bearingOffset}°, score ${score.toFixed(2)} (poor loop shape)`);
    }

    if (distKm < targetDistanceKm) {
      lowKm = midKm;
    } else {
      highKm = midKm;
    }
  }

  if (!best) {
    throw new Error("Could not generate a loop route");
  }
  return best;
}

export { hasRetracing, isGoodLoop, computeLoopScore };
export default generateCircularRoute;
