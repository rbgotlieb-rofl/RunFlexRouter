/**
 * Garmin Course Export Service
 *
 * Generates GPX course files compatible with Garmin devices.
 * GPX courses include the route path and turn-by-turn cue points
 * that Garmin watches use for on-wrist navigation.
 */

import { Point, DirectionStep } from "@shared/schema";

interface CourseExportInput {
  name: string;
  description?: string;
  distance: number; // km
  routePath: Point[];
  directions: DirectionStep[];
}

/**
 * Map a human-readable turn instruction to a Garmin-compatible cue type.
 */
function classifyTurn(instruction: string): { type: string; garminType: string } {
  const lower = instruction.toLowerCase();
  if (/\bu[ -]?turn\b/.test(lower)) return { type: "U-Turn", garminType: "U-Turn" };
  if (/\bsharp\s+left\b/.test(lower)) return { type: "SharpLeft", garminType: "SharpLeft" };
  if (/\bsharp\s+right\b/.test(lower)) return { type: "SharpRight", garminType: "SharpRight" };
  if (/\bleft\b/.test(lower)) return { type: "Left", garminType: "Left" };
  if (/\bright\b/.test(lower)) return { type: "Right", garminType: "Right" };
  if (/\bstraight\b|\bcontinue\b|\bhead\b/.test(lower)) return { type: "Straight", garminType: "Straight" };
  if (/\barrive\b|\bdestination\b|\bfinish\b/.test(lower)) return { type: "Generic", garminType: "Generic" };
  return { type: "Generic", garminType: "Generic" };
}

/**
 * Find the closest point on the route path to a cumulative distance.
 */
function findPointAtDistance(routePath: Point[], targetDistKm: number): Point {
  let cumDist = 0;
  for (let i = 1; i < routePath.length; i++) {
    const segDist = haversineKm(
      routePath[i - 1].lat, routePath[i - 1].lng,
      routePath[i].lat, routePath[i].lng
    );
    if (cumDist + segDist >= targetDistKm) {
      // Interpolate within this segment
      const fraction = segDist > 0 ? (targetDistKm - cumDist) / segDist : 0;
      return {
        lat: routePath[i - 1].lat + fraction * (routePath[i].lat - routePath[i - 1].lat),
        lng: routePath[i - 1].lng + fraction * (routePath[i].lng - routePath[i - 1].lng),
      };
    }
    cumDist += segDist;
  }
  return routePath[routePath.length - 1];
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate a GPX course file for a Garmin device.
 *
 * The GPX includes:
 * - A <trk> with the full route path as track points
 * - <wpt> elements for each turn/cue point with Garmin extensions
 */
export function generateGarminGpx(input: CourseExportInput): string {
  const { name, description, routePath, directions } = input;
  const timestamp = new Date().toISOString();

  // Build track points
  const trackPoints = routePath
    .map((p) => `        <trkpt lat="${p.lat}" lon="${p.lng}"><ele>0</ele></trkpt>`)
    .join("\n");

  // Build course/cue waypoints from direction steps
  const cuePoints: string[] = [];
  let cumDistKm = 0;

  for (let i = 0; i < directions.length; i++) {
    const step = directions[i];
    const point = findPointAtDistance(routePath, cumDistKm);
    const turnInfo = classifyTurn(step.instruction);

    cuePoints.push(
      `  <wpt lat="${point.lat}" lon="${point.lng}">` +
        `\n    <name>${escapeXml(step.instruction)}</name>` +
        `\n    <desc>Distance: ${step.distance.toFixed(2)}km</desc>` +
        `\n    <sym>${turnInfo.garminType}</sym>` +
        `\n    <type>Course Point</type>` +
        `\n    <extensions>` +
        `\n      <gpxx:WaypointExtension xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3">` +
        `\n        <gpxx:DisplayMode>SymbolAndName</gpxx:DisplayMode>` +
        `\n      </gpxx:WaypointExtension>` +
        `\n      <cxx:CoursePointExtension xmlns:cxx="http://www.garmin.com/xmlschemas/CourseExtension/v1">` +
        `\n        <cxx:PointType>${turnInfo.garminType}</cxx:PointType>` +
        `\n      </cxx:CoursePointExtension>` +
        `\n    </extensions>` +
        `\n  </wpt>`
    );

    cumDistKm += step.distance;
  }

  // Add finish waypoint
  const lastPoint = routePath[routePath.length - 1];
  if (lastPoint) {
    cuePoints.push(
      `  <wpt lat="${lastPoint.lat}" lon="${lastPoint.lng}">` +
        `\n    <name>Finish</name>` +
        `\n    <sym>Generic</sym>` +
        `\n    <type>Course Point</type>` +
        `\n  </wpt>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"
     xmlns:cxx="http://www.garmin.com/xmlschemas/CourseExtension/v1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     creator="RunFlex Router"
     version="1.1"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    ${description ? `<desc>${escapeXml(description)}</desc>` : ""}
    <time>${timestamp}</time>
  </metadata>
${cuePoints.join("\n")}
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Build simplified course data for sending to a Garmin watch via Connect IQ.
 * This is a lightweight JSON format for BLE transfer.
 */
export function buildGarminCourseData(input: CourseExportInput) {
  const { name, distance, routePath, directions } = input;

  // Build turn points with positions
  const turnPoints: Array<{
    position: { lat: number; lng: number };
    instruction: string;
    distanceFromStart: number;
    turnType: string;
  }> = [];

  let cumDistKm = 0;
  for (const step of directions) {
    const point = findPointAtDistance(routePath, cumDistKm);
    const turnInfo = classifyTurn(step.instruction);
    turnPoints.push({
      position: point,
      instruction: step.instruction,
      distanceFromStart: cumDistKm,
      turnType: turnInfo.type.toLowerCase().replace(/[^a-z-]/g, "-"),
    });
    cumDistKm += step.distance;
  }

  // Simplify route path for watch (reduce point density for BLE transfer)
  const simplifiedPath = simplifyPath(routePath, 0.00005); // ~5m tolerance

  return {
    name: name.replace(/\s*\([0-9.]+km\)/i, ""),
    distance,
    waypoints: simplifiedPath,
    turnPoints,
    totalDistance: distance,
  };
}

/**
 * Douglas-Peucker path simplification to reduce point count for BLE transfer.
 */
function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ddx = point.lng - lineStart.lng;
    const ddy = point.lat - lineStart.lat;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  let t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLng = lineStart.lng + t * dx;
  const projLat = lineStart.lat + t * dy;

  const ddx = point.lng - projLng;
  const ddy = point.lat - projLat;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}
