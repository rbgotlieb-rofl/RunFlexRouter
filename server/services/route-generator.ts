import { Route, RouteFilter, RouteFeature, RouteType, Point, DirectionStep } from "@shared/schema";
import { storage } from "../storage";
import { LONDON_LOCATIONS, LONDON_POSTCODES, POSTCODE_STREETS, getLocationByName } from "./location-service";

// Function to fetch a route path with waypoints
async function fetchRoutePathWithWaypoints(startPoint: Point, endPoint: Point, waypoints: Point[], routePreference: string = 'walking'): Promise<Point[] | null> {
  try {
    console.log(`Fetching route with ${waypoints.length} waypoints from (${startPoint.lat},${startPoint.lng}) to (${endPoint.lat},${endPoint.lng})`);
    
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.error("Mapbox token is not available");
      return null;
    }
    
    // Validate coordinates before making API request
    const allPoints = [startPoint, ...waypoints, endPoint];
    for (let i = 0; i < allPoints.length; i++) {
      const point = allPoints[i];
      if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number' ||
          isNaN(point.lat) || isNaN(point.lng) ||
          Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
        console.error(`Invalid coordinate at index ${i}:`, point);
        return null;
      }
    }
    
    // Build the request URL with waypoints
    // Coordinates format for Mapbox is longitude,latitude
    let coordString = `${startPoint.lng},${startPoint.lat};`;
    
    // Add all waypoints
    waypoints.forEach(point => {
      coordString += `${point.lng},${point.lat};`;
    });
    
    // Add endpoint
    coordString += `${endPoint.lng},${endPoint.lat}`;
    
    // Set up parameters
    const params = new URLSearchParams({
      access_token: mapboxToken,
      geometries: 'geojson',
      steps: 'true',
      alternatives: 'false', // We don't need alternatives for waypoints
      overview: 'full'
    });
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/${routePreference}/${coordString}?${params.toString()}`;
    console.log(`Making waypoint request to: ${url.replace(mapboxToken, 'REDACTED')}`);
    
    // Make the request
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Mapbox Directions API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      console.error("No routes found in Mapbox Directions API response");
      return null;
    }
    
    // Get the route
    const route = data.routes[0];
    
    // Extract the geometry (the path points)
    const coordPoints = route.geometry.coordinates;
    
    // Convert to our Point format (Mapbox uses [lng, lat], we use {lat, lng})
    const path = coordPoints.map((coord: number[]) => ({ 
      lng: coord[0], 
      lat: coord[1] 
    }));
    
    return path;
  } catch (error) {
    console.error("Error fetching from Mapbox Directions API with waypoints:", error);
    return null;
  }
}

// Generate waypoints specifically for duration-based routes
function generateWaypointsForDuration(startPoint: Point, endPoint: Point, numWaypoints: number, extraDistanceNeeded: number): Point[] {
  const waypoints: Point[] = [];
  
  // Calculate the midpoint between start and end
  const midpoint = {
    lat: (startPoint.lat + endPoint.lat) / 2,
    lng: (startPoint.lng + endPoint.lng) / 2
  };
  
  // Calculate a vector perpendicular to the line from start to end
  const dx = endPoint.lng - startPoint.lng;
  const dy = endPoint.lat - startPoint.lat;
  
  // Perpendicular vector
  const perpDx = -dy;
  const perpDy = dx;
  
  // Normalize the perpendicular vector
  const length = Math.sqrt(perpDx * perpDx + perpDy * perpDy);
  const normalizedPerpDx = perpDx / length;
  const normalizedPerpDy = perpDy / length;
  
  // Scale to create appropriate waypoints
  const scale = (extraDistanceNeeded / numWaypoints) * 0.005; // Adjust scaling factor
  
  for (let i = 0; i < numWaypoints; i++) {
    // Alternate sides of the direct path
    const side = i % 2 === 0 ? 1 : -1;
    
    // Vary the distance from the midpoint
    const distanceVariation = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3
    
    const waypoint = {
      lat: midpoint.lat + (normalizedPerpDy * scale * side * distanceVariation),
      lng: midpoint.lng + (normalizedPerpDx * scale * side * distanceVariation)
    };
    
    waypoints.push(waypoint);
  }
  
  return waypoints;
}

// Generate a circular path around a center point
function generateCircularPath(centerPoint: Point, targetDistance: number, numPoints: number): Point[] {
  const path: Point[] = [];
  
  // Calculate radius based on target distance (circumference = 2πr)
  // But we'll use an oval shape which means we'll have different radiuses
  const avgRadius = targetDistance / (2 * Math.PI);
  
  // Create an oval by having different radiuses for latitude and longitude
  // This creates a more visually pleasing and realistic running route
  // The ratio varies to create different oval shapes
  const ratio = 0.6 + (Math.random() * 0.8); // Between 0.6 and 1.4
  
  // Convert to approximately to latitude/longitude (very rough approximation)
  // Make radiusLat and radiusLng different to create an oval shape
  const radiusLat = avgRadius * 0.009 * ratio; // Adjust lat radius by ratio
  const radiusLng = avgRadius * 0.009 / ratio; // Inverse ratio for lng to create oval
  
  // Add some randomness to make the loop more natural and avoid perfect ovals
  const randomFactors = [];
  for (let i = 0; i < numPoints; i++) {
    // Generate random factors between 0.85 and 1.15 (±15% variation)
    // This creates a more natural, less perfect oval shape
    randomFactors.push(0.85 + (Math.random() * 0.3));
  }
  
  // Generate points along the oval with natural variations
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    
    // Use the random factor to vary the radius at different points
    const randomFactor = randomFactors[i % randomFactors.length];
    
    // Apply some additional smoothing to create more natural curves
    // Use different formulas for different segments to create interesting paths
    // This makes it look more like a real running route with varied curves
    let latFactor = randomFactor;
    let lngFactor = randomFactor;
    
    // Add some "bulges" in certain segments to make it more interesting
    // These create areas where the route extends out a bit more
    if (angle > Math.PI/4 && angle < Math.PI/2) {
      latFactor *= 1.1; // Bulge out a bit in this quadrant
    } else if (angle > Math.PI && angle < 3*Math.PI/2) {
      lngFactor *= 1.15; // Different bulge in another quadrant
    }
    
    const point = {
      lat: centerPoint.lat + (radiusLat * latFactor) * Math.sin(angle),
      lng: centerPoint.lng + (radiusLng * lngFactor) * Math.cos(angle)
    };
    
    path.push(point);
  }
  
  // Add the start point at the end to close the loop
  path.push(path[0]);
  
  return path;
}

// Generate directions specifically for loop routes
function generateLoopDirections(
  routePath: Point[], 
  totalDistance: number, 
  totalDuration: number, 
  startStreetName?: string | null,
  endStreetName?: string | null,
  hasDistinctEndPoint?: boolean
): DirectionStep[] {
  if (!routePath || routePath.length < 3) {
    return [{
      instruction: `Start and end at ${startStreetName || 'your location'}.`,
      distance: totalDistance,
      duration: totalDuration
    }];
  }
  
  const directions: DirectionStep[] = [];
  
  // First instruction - start
  if (hasDistinctEndPoint && endStreetName) {
    directions.push({
      instruction: `Begin your loop from ${startStreetName || 'your location'}. You'll run to ${endStreetName} and then return to this same starting point.`,
      distance: 0.1,
      duration: 0.5
    });
  } else {
    directions.push({
      instruction: `Begin your loop from ${startStreetName || 'your location'}. You'll return to this same point at the end of your run.`,
      distance: 0.1,
      duration: 0.5
    });
  }
  
  // Divide the route into 5-8 segments for directions
  const segmentCount = Math.min(Math.max(5, Math.ceil(totalDistance)), 8);
  const pointsPerSegment = Math.floor(routePath.length / segmentCount);
  
  // Find the halfway point (approximate middle of the path)
  // This is where we'd typically be at the destination for out-and-back loops
  const halfwayIndex = Math.floor(routePath.length / 2);
  
  // Landmarks to make the directions more interesting
  const landmarks = [
    "a small park", "local shops", "a residential area", "some trees",
    "a pedestrian crossing", "a bus stop", "an open green space", "a row of houses",
    "a school", "a sports field", "a coffee shop", "a community center"
  ];
  
  // Generate segment directions
  for (let i = 1; i < segmentCount; i++) {
    const startIdx = i * pointsPerSegment;
    const segmentStart = routePath[Math.min(startIdx, routePath.length - 1)];
    const segmentEnd = routePath[Math.min(startIdx + pointsPerSegment, routePath.length - 1)];
    
    const segmentDistance = totalDistance / segmentCount;
    const segmentDuration = totalDuration / segmentCount;
    
    // Get direction from one segment to the next
    const direction = getDirection(segmentStart, segmentEnd);
    
    // Pick a random landmark
    const landmark = landmarks[Math.floor(Math.random() * landmarks.length)];
    
    let instruction = "";
    
    // Check if this segment is near the halfway point
    const isNearHalfway = Math.abs(startIdx - halfwayIndex) < pointsPerSegment;
    
    if (i === 1) {
      // First major segment
      instruction = `Head ${direction} from your starting point for about ${segmentDistance.toFixed(1)} km. You'll pass ${landmark}.`;
    } else if (hasDistinctEndPoint && isNearHalfway && endStreetName) {
      // At the destination point (for out-and-back style loops)
      instruction = `Continue ${direction} for ${segmentDistance.toFixed(1)} km until you reach ${endStreetName}. This is your halfway point before turning back.`;
    } else if (i === segmentCount - 1) {
      // Last segment, approaching the start point again
      instruction = `Continue ${direction} for the final ${segmentDistance.toFixed(1)} km, which will bring you back toward your starting point.`;
    } else {
      // Middle segments
      instruction = `Continue ${direction} for another ${segmentDistance.toFixed(1)} km, past ${landmark}.`;
    }
    
    directions.push({
      instruction,
      distance: segmentDistance,
      duration: segmentDuration
    });
  }
  
  // Final instruction - return to start
  directions.push({
    instruction: `Complete your loop by returning to ${startStreetName || 'your starting point'}, where you originally started.`,
    distance: totalDistance / segmentCount,
    duration: totalDuration / segmentCount
  });
  
  return directions;
}

// Generate directions for routes with waypoints
function generateDirectionsWithWaypoints(
  routePath: Point[], 
  totalDistance: number, 
  totalDuration: number, 
  waypoints: Point[],
  startStreetName?: string | null,
  endStreetName?: string | null
): DirectionStep[] {
  if (!routePath || routePath.length < 2) {
    return [{
      instruction: `Go from ${startStreetName || 'your location'} to ${endStreetName || 'destination'}.`,
      distance: totalDistance,
      duration: totalDuration
    }];
  }
  
  const directions: DirectionStep[] = [];
  
  // First instruction - start
  directions.push({
    instruction: `Begin your journey from ${startStreetName || 'your location'}.`,
    distance: 0.2,
    duration: 1
  });
  
  // Waypoint descriptions to make them sound more meaningful
  const waypointDescriptions = [
    "through a scenic area",
    "past some local landmarks",
    "through a quiet neighborhood",
    "via some interesting streets",
    "on a path with some nice views",
    "through an area with some charming architecture",
    "via a pleasant route",
    "through a part of town with some character"
  ];
  
  // Segment the route based on waypoints
  let totalSegments = waypoints.length + 2; // start -> waypoints -> end
  let remainingDistance = totalDistance;
  let remainingDuration = totalDuration;
  
  // For each waypoint, create a segment
  for (let i = 0; i < waypoints.length; i++) {
    // Calculate approximate segment distance (this is an estimation)
    const segmentDistance = remainingDistance / (waypoints.length - i + 1);
    const segmentDuration = remainingDuration / (waypoints.length - i + 1);
    
    // Create a meaningful instruction
    const description = waypointDescriptions[i % waypointDescriptions.length];
    let instruction = `Continue ${description} for about ${segmentDistance.toFixed(1)} km.`;
    
    if (i === waypoints.length - 1) {
      // Last waypoint before destination
      instruction = `Make your way toward your destination ${description}, covering about ${segmentDistance.toFixed(1)} km.`;
    }
    
    directions.push({
      instruction,
      distance: segmentDistance,
      duration: segmentDuration
    });
    
    remainingDistance -= segmentDistance;
    remainingDuration -= segmentDuration;
  }
  
  // Final instruction - arrival
  directions.push({
    instruction: `Complete your journey by arriving at ${endStreetName || 'your destination'}.`,
    distance: remainingDistance,
    duration: remainingDuration
  });
  
  return directions;
}

// Utility function to calculate distance between coordinates in km
function calculateDistance(point1: Point, point2: Point): number {
  // Safety check to prevent errors with undefined points
  if (!point1 || !point2 || typeof point1.lat !== 'number' || typeof point1.lng !== 'number' || 
      typeof point2.lat !== 'number' || typeof point2.lng !== 'number') {
    console.warn('Invalid points provided to calculateDistance', point1, point2);
    return 0; // Return zero distance as fallback
  }
  
  const R = 6371; // Earth's radius in km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Utility function to generate a random route path between two points
function generateRoutePath(startPoint: Point, endPoint: Point, variationFactor: number): Point[] {
  const path: Point[] = [startPoint];
  const directDistance = calculateDistance(startPoint, endPoint);
  
  // Generate intermediate waypoints
  const numPoints = Math.floor(directDistance * 5); // More points for longer routes
  
  for (let i = 1; i <= numPoints; i++) {
    const ratio = i / (numPoints + 1);
    const randomOffset = (Math.random() - 0.5) * variationFactor * 0.01;
    
    const waypoint = {
      lat: startPoint.lat + (endPoint.lat - startPoint.lat) * ratio + randomOffset,
      lng: startPoint.lng + (endPoint.lng - startPoint.lng) * ratio + randomOffset
    };
    
    path.push(waypoint);
  }
  
  path.push(endPoint);
  return path;
}

// Function to calculate estimated time in minutes based on distance and elevation
function calculateEstimatedTime(distance: number, elevation: number): number {
  // Average running pace of 6 min/km
  const baseTime = distance * 6;
  
  // Add time for elevation (1 min per 10m of elevation gain)
  const elevationTime = (elevation / 10);
  
  return Math.round(baseTime + elevationTime);
}

function getReadableLocationName(pointString: string): string {
  if (pointString.startsWith("{")) {
    try {
      const parsed = JSON.parse(pointString);
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return "Your Location";
      }
    } catch {}
  }
  if (pointString.startsWith("Your Location (")) {
    return "Your Location";
  }
  return pointString;
}

// Format to a point we can use from string inputs
function parsePoint(pointString: string): Point {
  // Handle JSON coordinate objects like {"lat":51.6139,"lng":-0.233}
  if (pointString.startsWith("{")) {
    try {
      const parsed = JSON.parse(pointString);
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    } catch {
      // fall through to other parsing methods
    }
  }

  // If we have the exact string in our sample coordinates, use it
  const location = getLocationByName(pointString);
  if (location) {
    return location;
  }
  
  // Handle geolocation format: "Your Location (lat,lng)"
  if (pointString.startsWith("Your Location (") && pointString.endsWith(")")) {
    try {
      // Extract the coordinates from the string
      const coordString = pointString.substring(14, pointString.length - 1);
      const [lat, lng] = coordString.split(',').map(coord => parseFloat(coord.trim()));
      
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`Parsed user location coordinates: (${lat}, ${lng})`);
        return { lat, lng };
      }
    } catch (e) {
      console.error("Error parsing user location string:", e);
      // Continue to other parsing methods
    }
  }
  
  // Check if it's a UK postcode format (e.g., SW1A 1AA, SW1A, or NW73DS)
  // Support both spaced (NW7 3DS) and non-spaced (NW73DS) formats
  const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}|[A-Z]{1,2}[0-9][A-Z0-9]?$/i;
  
  // Clean up postcode by removing spaces
  const cleanedInput = pointString.trim().replace(/\s+/g, '').toUpperCase();
  
  if (postcodeRegex.test(pointString.trim()) || postcodeRegex.test(cleanedInput)) {
    console.log(`Detected postcode format in: ${pointString}`);
    
    // Extract the outcode (first part of the postcode)
    let outcode = '';
    
    // Logic to handle different postcode formats
    if (pointString.includes(' ')) {
      // If there's a space, take the first part (e.g., "NW7" from "NW7 3DS")
      outcode = pointString.trim().split(' ')[0].toUpperCase();
    } else {
      // For formats without space, extract the outcode based on pattern
      // UK outcodes are 2-4 characters: 1-2 letters + 1-2 digits (with occasional letter)
      const outcodeMatch = cleanedInput.match(/^[A-Z]{1,2}[0-9][A-Z0-9]?/);
      if (outcodeMatch) {
        outcode = outcodeMatch[0];
      }
    }
    
    console.log(`Extracted outcode: ${outcode}`);
    
    // First try exact match
    if (outcode in LONDON_POSTCODES) {
      console.log(`Found exact match for postcode area: ${outcode}`);
      return LONDON_POSTCODES[outcode as keyof typeof LONDON_POSTCODES];
    }
    
    // Then try to find the closest matching outcode
    // For example, if input is "NW73DS" and we have "NW7", that should match
    for (const [code, point] of Object.entries(LONDON_POSTCODES)) {
      if (outcode.startsWith(code) || code.startsWith(outcode)) {
        console.log(`Found matching postcode area: ${code}`);
        return point as Point;
      }
    }
    
    console.log(`No matching postcode area found for: ${outcode}`);
  }
  
  // Try to parse from string like "51.5074,-0.1278"
  try {
    const [lat, lng] = pointString.split(',').map(coord => parseFloat(coord.trim()));
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  } catch (e) {
    console.error("Could not parse point string:", pointString);
    throw new Error(`Unable to resolve location: "${pointString}"`);
  }

  // If all else fails, throw -- callers should provide valid coordinates
  throw new Error(`Unable to resolve location: "${pointString}"`);
}

// Find the street name associated with a postcode
function getStreetNameFromPostcode(postcodeStr: string): string | null {
  // Clean the postcode
  const cleanedPostcode = postcodeStr.trim().toUpperCase();
  
  // First check if the exact postcode is in our mapping
  if (cleanedPostcode in POSTCODE_STREETS) {
    return POSTCODE_STREETS[cleanedPostcode as keyof typeof POSTCODE_STREETS];
  }
  
  // Extract the outcode part for partial matching
  const outcodeMatch = cleanedPostcode.match(/^([A-Z]{1,2}[0-9][A-Z0-9]?)(?:\s+|$)/);
  if (outcodeMatch) {
    const outcode = outcodeMatch[1];
    
    // Check if the outcode is in our mapping
    if (outcode in POSTCODE_STREETS) {
      return POSTCODE_STREETS[outcode as keyof typeof POSTCODE_STREETS];
    }
    
    // Try to find partial matches (e.g., if we have NW7 but the input is NW7 3DS)
    for (const code of Object.keys(POSTCODE_STREETS)) {
      if (code.startsWith(outcode) || outcode.startsWith(code)) {
        return POSTCODE_STREETS[code as keyof typeof POSTCODE_STREETS];
      }
    }
  }
  
  // If no match found
  return null;
}

// Main function to generate routes
// Main exported function that generates routes based on user input
export async function generateRoutes(startPointStr: string, endPointStr: string, filters?: Partial<RouteFilter>): Promise<Route[]> {
  try {
    console.log(`Generating routes from ${startPointStr} to ${endPointStr} with mode: ${filters?.routeMode || 'a_to_b'} and type: ${filters?.routeType || 'any'}`);
    
    // Extract street names from postcodes for better directions
    let startStreetName = null;
    let endStreetName = null;
    
    // Check if start point is a postcode
    const isStartPostcode = /^[A-Z]{1,2}[0-9][A-Z0-9]?(?:\s+[0-9][A-Z]{2})?$/i.test(startPointStr.trim());
    if (isStartPostcode) {
      console.log(`Checking if '${startPointStr}' is a postcode, cleaned to '${startPointStr.trim().toUpperCase()}'`);
      startStreetName = getStreetNameFromPostcode(startPointStr);
      if (startStreetName) {
        console.log(`Found street name for start postcode: ${startStreetName}`);
      }
    }
    
    // Check if end point is a postcode
    const isEndPostcode = /^[A-Z]{1,2}[0-9][A-Z0-9]?(?:\s+[0-9][A-Z]{2})?$/i.test(endPointStr.trim());
    if (isEndPostcode) {
      console.log(`Checking if '${endPointStr}' is a postcode, cleaned to '${endPointStr.trim().toUpperCase()}'`);
      endStreetName = getStreetNameFromPostcode(endPointStr);
      if (endStreetName) {
        console.log(`Found street name for end postcode: ${endStreetName}`);
      }
    }
    
    // If start is not a postcode, try to find a matching street name
    if (!startStreetName) {
      console.log(`Trying fuzzy matching for possible street name: ${startPointStr}`);
      for (const [name, _] of Object.entries(LONDON_LOCATIONS)) {
        if (name.toLowerCase().includes(startPointStr.toLowerCase().split(' ')[0])) {
          startStreetName = name.split(',')[0]; // Take first part before comma if any
          console.log(`Found fuzzy street name match: ${startStreetName} for ${startPointStr}`);
          break;
        }
      }
    }
    
    // Same for end point
    if (!endStreetName) {
      console.log(`Trying fuzzy matching for possible street name: ${endPointStr}`);
      for (const [name, _] of Object.entries(LONDON_LOCATIONS)) {
        if (name.toLowerCase().includes(endPointStr.toLowerCase().split(' ')[0])) {
          endStreetName = name.split(',')[0]; // Take first part before comma if any
          console.log(`Found fuzzy street name match: ${endStreetName} for ${endPointStr}`);
          break;
        }
      }
    }
    
    // Parse start and end coordinates
    const startPoint = parsePoint(startPointStr);
    const endPoint = parsePoint(endPointStr);
    
    // Determine the route mode and type from filters
    const routeMode = filters?.routeMode || 'a_to_b';
    const routeType = filters?.routeType || 'any';
    
    // Special case for the "all" route type - generate routes from all three modes
    if (routeType === 'all') {
      console.log("'All' route type detected, generating routes from all three modes");
      
      // Generate routes from each mode
      const aToB_Routes = await createNewRoutes(
        startPointStr, 
        endPointStr, 
        startPoint, 
        endPoint, 
        startStreetName, 
        endStreetName
      );
      console.log(`Generated ${aToB_Routes.length} A to B routes`);
      
      // For loop routes, we'll pass both start and end points
      const loop_Routes = await createLoopRoutes(
        startPointStr,
        startPoint,
        startStreetName,
        filters?.minDistance,
        filters?.maxDistance,
        endPointStr,
        endPoint,
        endStreetName,
        filters?.targetDistance,
        filters?.distanceUnit,
        filters?.targetType
      );
      console.log(`Generated ${loop_Routes.length} loop routes`);
      
      // For duration-based routes
      const duration_Routes = await createDurationBasedRoutes(
        startPointStr,
        endPointStr,
        startPoint,
        endPoint,
        filters?.targetDuration || 30, // Default to 30 minutes if not specified
        startStreetName,
        endStreetName,
        filters?.targetDistance,
        filters?.distanceUnit,
        filters?.targetType
      );
      console.log(`Generated ${duration_Routes.length} duration-based routes`);
      
      // Combine all routes with route mode identifying information
      // Tag each route with its mode for UI display purposes
      aToB_Routes.forEach(route => {
        route.name = `${route.name} (A to B)`;
        route.description = `${route.description || ''} Standard route from ${startPointStr} to ${endPointStr}`;
      });
      
      loop_Routes.forEach(route => {
        const locationName = startStreetName || getReadableLocationName(startPointStr);
        route.name = `${locationName} Loop (${route.distance.toFixed(1)}km)`;
        route.description = `Circular route starting and ending at ${locationName}. This loop takes you around the area and back to your starting point.`;
      });
      
      duration_Routes.forEach(route => {
        route.name = `${route.name} (Timed)`;
        route.description = `${route.description || ''} Time-based route targeting ${filters?.targetDuration || 30} minutes`;
      });
      
      // Create a balanced selection
      // Always aim to produce exactly 8 routes total
      let balancedRoutes: Route[] = [];
      const targetTotalRoutes = 8;
      
      // Calculate how many routes to take from each type
      // If we have all three types, we want 3+3+2=8 routes
      // If we have two types, we want 4+4=8 routes
      // If we have only one type, we want all 8 from that type
      const availableTypes = [
        aToB_Routes.length > 0 ? 'a_to_b' : null,
        loop_Routes.length > 0 ? 'loop' : null,
        duration_Routes.length > 0 ? 'duration' : null
      ].filter(Boolean) as string[];
      
      const numTypes = availableTypes.length;
      const routesPerType = numTypes > 0 ? Math.floor(targetTotalRoutes / numTypes) : 0;
      let remaining = targetTotalRoutes - (routesPerType * numTypes);
      
      // Add routes from each type in an alternating pattern to reach exactly 8 routes total
      if (numTypes > 0) {
        // First, add an equal number from each type
        for (let i = 0; i < routesPerType; i++) {
          if (i < aToB_Routes.length) balancedRoutes.push(aToB_Routes[i]);
          if (i < loop_Routes.length) balancedRoutes.push(loop_Routes[i]);
          if (i < duration_Routes.length) balancedRoutes.push(duration_Routes[i]);
        }
        
        // Then, distribute any remaining slots (1-2 routes) to reach exactly 8
        let typeIndex = 0;
        while (remaining > 0 && typeIndex < numTypes) {
          const type = availableTypes[typeIndex];
          if (type === 'a_to_b' && routesPerType < aToB_Routes.length) {
            balancedRoutes.push(aToB_Routes[routesPerType]);
            remaining--;
          } else if (type === 'loop' && routesPerType < loop_Routes.length) {
            balancedRoutes.push(loop_Routes[routesPerType]);
            remaining--;
          } else if (type === 'duration' && routesPerType < duration_Routes.length) {
            balancedRoutes.push(duration_Routes[routesPerType]);
            remaining--;
          }
          typeIndex++;
        }
      }
      
      console.log(`Selected ${balancedRoutes.length} balanced routes from all modes`);
      
      // Apply additional filters if needed
      if (filters && (filters.minDistance || filters.maxDistance || filters.sceneryRating || filters.trafficLevel)) {
        return filterRoutes(balancedRoutes, filters);
      }
      
      return balancedRoutes;
    }
    
    // Standard flow for specific route modes
    // For loop mode, adjust the end point to match the start
    let adjustedEndPoint = endPoint;
    let adjustedEndPointStr = endPointStr;
    
    if (routeMode === 'loop') {
      console.log("Loop mode detected, setting end point to match start point");
      adjustedEndPoint = startPoint;
      adjustedEndPointStr = startPointStr;
      endStreetName = startStreetName; // Use same street name
    }
    
    // Check if we have stored routes for these points
    let existingRoutes: Route[] = [];
    
    // Only check storage for a_to_b mode - for loop and duration modes, generate new routes
    if (routeMode === 'a_to_b') {
      existingRoutes = await storage.getRoutesByPoints(startPointStr, endPointStr);
    } else if (routeMode === 'loop') {
      existingRoutes = await storage.getRoutesByPoints(startPointStr, startPointStr);
    }
    
    // Only use existing routes if we have at least 8 of them
    if (existingRoutes.length >= 8 && routeMode !== 'duration') {
      // Apply filters if provided
      if (filters) {
        return filterRoutes(existingRoutes, filters);
      }
      return existingRoutes;
    }
    
    // Generate new routes if we don't have enough
    // Clear any existing routes for these points first to avoid duplicates
    if (existingRoutes.length > 0) {
      console.log(`Clearing ${existingRoutes.length} existing routes for ${startPointStr} to ${adjustedEndPointStr}`);
      // Note: In a production app, we would need a proper delete method in the storage interface
    }
    
    // Generate new routes based on the mode
    let generatedRoutes: Route[] = [];
    
    switch (routeMode) {
      case 'all':
        // Generate a mix of all route types
        console.log("'All' route mode detected, generating routes from all three modes");
        
        // Generate routes from each mode
        const aToB_Routes = await createNewRoutes(
          startPointStr, 
          endPointStr, 
          startPoint, 
          endPoint, 
          startStreetName, 
          endStreetName
        );
        console.log(`Generated ${aToB_Routes.length} A to B routes`);
        
        // For loop routes, ALWAYS use only the starting point (ignore destination)
        const loop_Routes = await createLoopRoutes(
          startPointStr,
          startPoint,
          startStreetName,
          filters?.minDistance,
          filters?.maxDistance,
          startPointStr, // Use startPoint as endPoint for proper circular loops
          startPoint, // Use startPoint as endPoint for proper circular loops
          startStreetName, // Use start street name
          filters?.targetDistance,
          filters?.distanceUnit,
          filters?.targetType
        );
        console.log(`Generated ${loop_Routes.length} loop routes`);
        
        // For duration-based routes
        const duration_Routes = await createDurationBasedRoutes(
          startPointStr,
          endPointStr,
          startPoint,
          endPoint,
          filters?.targetDuration || 30, // Default to 30 minutes if not specified
          startStreetName,
          endStreetName,
          filters?.targetDistance,
          filters?.distanceUnit,
          filters?.targetType
        );
        console.log(`Generated ${duration_Routes.length} duration-based routes`);
        
        // Combine all routes with route mode identifying information
        // Tag each route with its mode for UI display purposes
        aToB_Routes.forEach(route => {
          route.name = `${route.name} (A to B)`;
          route.description = `${route.description || ''} Standard route from ${startPointStr} to ${endPointStr}`;
        });
        
        loop_Routes.forEach(route => {
          const locationName = startStreetName || getReadableLocationName(startPointStr);
          route.name = `${locationName} Loop (${route.distance.toFixed(1)}km)`;
          route.description = `Circular route starting and ending at ${locationName}. This loop takes you around the area and back to your starting point.`;
        });
        
        duration_Routes.forEach(route => {
          route.name = `${route.name} (Timed)`;
          route.description = `${route.description || ''} Time-based route targeting ${filters?.targetDuration || 30} minutes`;
        });
        
        // Create a balanced selection with exactly 8 routes
        let balancedRoutes: Route[] = [];
        const targetTotalRoutes = 8;
        
        // Calculate how many routes to take from each type to reach exactly 8 routes
        const availableTypes = [
          aToB_Routes.length > 0 ? 'a_to_b' : null,
          loop_Routes.length > 0 ? 'loop' : null,
          duration_Routes.length > 0 ? 'duration' : null
        ].filter(Boolean) as string[];
        
        const numTypes = availableTypes.length;
        const routesPerType = numTypes > 0 ? Math.floor(targetTotalRoutes / numTypes) : 0;
        let remaining = targetTotalRoutes - (routesPerType * numTypes);
        
        // Add routes from each type in an alternating pattern to reach exactly 8 routes total
        if (numTypes > 0) {
          // First, add an equal number from each type
          for (let i = 0; i < routesPerType; i++) {
            if (i < aToB_Routes.length) balancedRoutes.push(aToB_Routes[i]);
            if (i < loop_Routes.length) balancedRoutes.push(loop_Routes[i]);
            if (i < duration_Routes.length) balancedRoutes.push(duration_Routes[i]);
          }
          
          // Then, distribute any remaining slots to reach exactly 8
          let typeIndex = 0;
          while (remaining > 0 && typeIndex < numTypes) {
            const type = availableTypes[typeIndex];
            if (type === 'a_to_b' && routesPerType < aToB_Routes.length) {
              balancedRoutes.push(aToB_Routes[routesPerType]);
              remaining--;
            } else if (type === 'loop' && routesPerType < loop_Routes.length) {
              balancedRoutes.push(loop_Routes[routesPerType]);
              remaining--;
            } else if (type === 'duration' && routesPerType < duration_Routes.length) {
              balancedRoutes.push(duration_Routes[routesPerType]);
              remaining--;
            }
            typeIndex++;
          }
        }
        
        generatedRoutes = balancedRoutes;
        break;
        
      case 'a_to_b':
        // Standard route from A to B
        generatedRoutes = await createNewRoutes(
          startPointStr, 
          endPointStr, 
          startPoint, 
          endPoint, 
          startStreetName, 
          endStreetName
        );
        break;
        
      case 'loop':
        console.log("'Loop' route mode detected, generating only loop routes from starting point");
        
        // CRITICAL: For loop routes, ALWAYS ignore destination and use only starting point
        generatedRoutes = await createLoopRoutes(
          startPointStr,
          startPoint,
          startStreetName,
          filters?.minDistance,
          filters?.maxDistance,
          startPointStr, // Force use of startPoint as "end" for true circular loops
          startPoint, // Force use of startPoint as "end" for true circular loops  
          startStreetName, // Force use of start street name
          filters?.targetDistance,
          filters?.distanceUnit,
          filters?.targetType
        );
        break;
        
      case 'duration':
        // Duration-based route (target a specific duration)
        generatedRoutes = await createDurationBasedRoutes(
          startPointStr,
          endPointStr,
          startPoint,
          endPoint,
          filters?.targetDuration || 30, // Default to 30 minutes if not specified
          startStreetName,
          endStreetName
        );
        break;
        
      default:
        // Default to A to B if unknown mode
        generatedRoutes = await createNewRoutes(
          startPointStr, 
          endPointStr, 
          startPoint, 
          endPoint, 
          startStreetName, 
          endStreetName
        );
    }
    
    // Apply filters if provided
    if (filters) {
      return filterRoutes(generatedRoutes, filters);
    }
    
    return generatedRoutes;
  } catch (error) {
    console.error("Error generating routes:", error);
    throw new Error("Failed to generate routes");
  }
}

// Function to fetch a route from Mapbox Directions API
async function fetchMapboxRoute(startPoint: Point, endPoint: Point, routePreference: string = 'walking'): Promise<{path: Point[], distance: number, duration: number, directions: DirectionStep[]} | null> {
  try {
    console.log(`Fetching Mapbox route from (${startPoint.lat},${startPoint.lng}) to (${endPoint.lat},${endPoint.lng})`);
    
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.error("Mapbox token is not available");
      return null;
    }
    
    // Validate coordinates before making API request
    const allPoints = [startPoint, endPoint];
    for (let i = 0; i < allPoints.length; i++) {
      const point = allPoints[i];
      if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number' ||
          isNaN(point.lat) || isNaN(point.lng) ||
          Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
        console.error(`Invalid coordinate at index ${i}:`, point);
        return null;
      }
    }
    
    // Build the request URL
    // Coordinates format for Mapbox is longitude,latitude
    const coordString = `${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`;
    
    // Set up parameters
    const params = new URLSearchParams({
      access_token: mapboxToken,
      geometries: 'geojson',
      steps: 'true',
      alternatives: 'true', // Get alternative routes if available
      overview: 'full'
    });
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/${routePreference}/${coordString}?${params.toString()}`;
    console.log(`Making request to: ${url.replace(mapboxToken, 'REDACTED')}`);
    
    // Make the request
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Mapbox Directions API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      console.error("No routes found in Mapbox Directions API response");
      return null;
    }
    
    console.log(`Mapbox returned ${data.routes.length} route(s)`);
    
    // Get the first route (we'll use alternatives for different route types)
    const route = data.routes[0];
    
    // Extract the geometry (the path points)
    const coordPoints = route.geometry.coordinates;
    
    // Convert to our Point format (Mapbox uses [lng, lat], we use {lat, lng})
    const path = coordPoints.map((coord: number[]) => ({ 
      lng: coord[0], 
      lat: coord[1] 
    }));
    
    // Get the distance in km (Mapbox returns meters)
    const distance = route.distance / 1000;
    
    // Get the duration in minutes (Mapbox returns seconds)
    const duration = route.duration / 60;
    
    // Extract turn-by-turn directions from the steps and enhance them
    const directions: DirectionStep[] = [];
    
    if (route.legs?.[0]?.steps) {
      let stepCount = 0;
      route.legs[0].steps.forEach((step: any) => {
        stepCount++;
        
        // Extract basic info
        let baseInstruction = step.maneuver?.instruction || '';
        const distance = step.distance / 1000; // Convert to km
        const duration = step.duration / 60;   // Convert to minutes
        
        // Only process meaningful steps (ignore very short segments)
        if (distance > 0.01) {
          // Generate a more descriptive instruction with landmarks
          let enhancedInstruction = baseInstruction;
          
          // Extract street name from the step if available
          const streetName = step.name || generateLocationDescription({
            lat: step.maneuver.location[1],
            lng: step.maneuver.location[0]
          });
          
          // Improve instructions with more detail and context
          if (stepCount === 1) {
            // First instruction - start of route
            enhancedInstruction = `Begin your journey from ${streetName}. ${baseInstruction}`;
          } else if (!route.legs[0].steps[stepCount]) {
            // Last instruction - approaching destination
            enhancedInstruction = `${baseInstruction} As you approach your destination on ${streetName}, prepare to finish your route.`;
          } else if (distance > 0.5) {
            // Longer segments deserve more detail
            const direction = step.maneuver.modifier?.replace(/^\w/, (c: string) => c.toUpperCase()) || 'Forward';
            
            // Add a landmark reference to make directions more natural
            const landmarks = ["local shops", "row of houses", "traffic lights", "pedestrian crossing", 
                               "bus stop", "small park", "café", "street market", "university buildings",
                               "residential area", "office buildings", "tree-lined section"];
            
            const landmark = landmarks[Math.floor(Math.random() * landmarks.length)];
            enhancedInstruction = `${baseInstruction} Continue along ${streetName} for ${distance.toFixed(1)} km. You'll pass ${landmark} on this stretch.`;
          } else {
            // Regular instruction with added street name
            enhancedInstruction = `${baseInstruction} on ${streetName} for ${distance.toFixed(1)} km.`;
          }
          
          directions.push({
            instruction: enhancedInstruction,
            distance,
            duration
          });
        }
      });
    }
    
    // If we have fewer than 5 meaningful directions, add some intermediate ones
    if (directions.length < 5) {
      // Generate additional directions using our custom function
      const additionalDirections = generateSimpleDirections(path, distance, duration);
      
      // Merge the directions, prioritizing Mapbox's where they exist
      // but ensuring we have enough detailed instructions
      if (additionalDirections.length > directions.length) {
        // Take the difference in directions and add them at appropriate positions
        const difference = additionalDirections.length - directions.length;
        const stride = Math.floor(directions.length / (difference + 1));
        
        for (let i = 0; i < difference; i++) {
          const insertPosition = Math.min((i + 1) * stride, directions.length);
          directions.splice(insertPosition, 0, additionalDirections[i]);
        }
      }
    }
    
    console.log(`Extracted ${directions.length} direction steps from route`);
    
    return {
      path,
      distance,
      duration,
      directions
    };
  } catch (error) {
    console.error("Error fetching from Mapbox Directions API:", error);
    return null;
  }
}

// Generate waypoints along a route to create variations
function generateWaypoints(startPoint: Point, endPoint: Point, numWaypoints: number): Point[] {
  const waypoints: Point[] = [];
  
  // Calculate a reasonable radius for waypoints based on the direct distance
  const directDistance = calculateDistance(startPoint, endPoint);
  const radius = Math.min(directDistance * 0.2, 2); // Max 2km or 20% of direct distance
  
  for (let i = 0; i < numWaypoints; i++) {
    // Generate a random angle
    const angle = Math.random() * 2 * Math.PI;
    
    // Generate a random distance within the radius
    const distance = Math.random() * radius;
    
    // Calculate the position at a certain distance along the path
    const ratio = (i + 1) / (numWaypoints + 1);
    const basePoint = {
      lat: startPoint.lat + (endPoint.lat - startPoint.lat) * ratio,
      lng: startPoint.lng + (endPoint.lng - startPoint.lng) * ratio
    };
    
    // Add a random offset from this point
    const waypoint = {
      lat: basePoint.lat + distance * Math.sin(angle) * 0.01, // Scale for coordinate system
      lng: basePoint.lng + distance * Math.cos(angle) * 0.01
    };
    
    waypoints.push(waypoint);
  }
  
  return waypoints;
}

// Function to generate detailed directions for routes that don't have Mapbox directions
function generateSimpleDirections(routePath: Point[], totalDistance: number, totalDuration: number): DirectionStep[] {
  // Safety checks to prevent errors
  if (!routePath || !Array.isArray(routePath) || routePath.length < 2) {
    console.warn('Invalid route path provided to generateSimpleDirections', routePath);
    return [{
      instruction: "Follow the path to your destination.",
      distance: totalDistance || 1,
      duration: totalDuration || 10
    }];
  }
  
  // Check for invalid inputs and provide defaults
  if (!totalDistance || totalDistance <= 0) totalDistance = 1;
  if (!totalDuration || totalDuration <= 0) totalDuration = 10;
  
  const directions: DirectionStep[] = [];
  // Create more segments for more detailed directions (8-12 steps)
  const segments = Math.min(Math.max(8, Math.floor(totalDistance * 1.5)), 12);
  const segmentSize = Math.max(1, Math.floor(routePath.length / segments));
  
  // Calculate segment distances and durations proportionally
  let cumulativeDistance = 0;
  
  // Generate list of landmarks and street names to use in directions based on real London locations
  const knownLandmarks = [
    // Parks and open spaces
    "Hyde Park", "Regent's Park", "Victoria Park", "Hampstead Heath", "Battersea Park", 
    "Greenwich Park", "Richmond Park", "Holland Park", "Finsbury Park", "Clapham Common",
    
    // Landmarks
    "British Museum", "Natural History Museum", "Tate Modern", "National Gallery", 
    "Tower of London", "Tower Bridge", "London Eye", "Buckingham Palace", "St. Paul's Cathedral",
    "Westminster Abbey", "The Shard", "Trafalgar Square", "Piccadilly Circus", "Oxford Circus",
    
    // Shopping and entertainment
    "Covent Garden Market", "Camden Market", "Borough Market", "Portobello Road Market",
    "Oxford Street", "Regent Street", "Bond Street", "Carnaby Street", "Westfield",
    "Selfridges", "Harrods", "Liberty London", "Fortnum & Mason",
    
    // Transport
    "King's Cross Station", "Waterloo Station", "Victoria Station", "Paddington Station",
    "London Bridge Station", "Euston Station", "Liverpool Street Station", "Canary Wharf",
    
    // Mill Hill specific (for that area)
    "Mill Hill Broadway", "Mill Hill East Station", "Mill Hill School", "Mill Hill Park", 
    "Holders Hill Circus", "Arrandene Open Space", "Mill Hill Country Park", "Copthall Playing Fields"
  ];
  
  try {
    for (let i = 0; i < segments; i++) {
      const startIdx = Math.min(i * segmentSize, routePath.length - 1);
      const endIdx = (i === segments - 1) ? routePath.length - 1 : Math.min((i + 1) * segmentSize, routePath.length - 1);
      
      // Make sure we have valid indices
      if (startIdx === endIdx) continue;
      
      // Validate points before using them
      if (!routePath[startIdx] || !routePath[endIdx] || 
          typeof routePath[startIdx].lat !== 'number' || typeof routePath[startIdx].lng !== 'number' ||
          typeof routePath[endIdx].lat !== 'number' || typeof routePath[endIdx].lng !== 'number') {
        console.warn(`Invalid points at indices ${startIdx} or ${endIdx}`);
        continue;
      }
      
      // Calculate distance for this segment with additional validation
      let segmentDistance = 0;
      for (let j = startIdx + 1; j <= endIdx; j++) {
        if (j < routePath.length && routePath[j-1] && routePath[j]) {
          segmentDistance += calculateDistance(routePath[j-1], routePath[j]);
        }
      }
      
      // Avoid zero or negative distances
      if (segmentDistance <= 0) segmentDistance = 0.1;
      
      cumulativeDistance += segmentDistance;
      
      // Calculate percentage of total distance and duration
      const distanceRatio = segmentDistance / totalDistance;
      const segmentDuration = totalDuration * distanceRatio;
      
      // Get locations for more realistic descriptions
      let startLocation = "the path";
      let endLocation = "your destination";
      let directionWord = "forward";
      
      try {
        startLocation = generateLocationDescription(routePath[startIdx]);
        endLocation = i < segments - 1 ? generateLocationDescription(routePath[endIdx]) : "your destination";
        directionWord = getDirection(routePath[startIdx], routePath[endIdx]);
      } catch (error) {
        console.warn('Error generating location descriptions:', error);
      }
      
      // Use a smarter landmark selection system based on location
      const useLandmark = Math.random() > 0.3; // Increase landmark frequency for better directions
      
      let landmark = null;
      if (useLandmark) {
        try {
          // Import location data directly - it's already imported at the top of the file
          // Use the LONDON_LOCATIONS that's already in scope
          
          // Define a threshold distance to consider landmarks nearby (2km)
          const nearbyThreshold = 2; // kilometers
          
          // Collect all landmarks within threshold distance
          const nearbyLandmarks = [];
          for (const [name, locationPoint] of Object.entries(LONDON_LOCATIONS)) {
            // Skip the "Current Location" entry which is just a placeholder
            if (name === "Current Location") continue;
            
            // Calculate distance to this known location
            const distance = calculateDistance(routePath[startIdx], locationPoint as Point);
            
            // If it's within our threshold, add it to nearby landmarks
            if (distance < nearbyThreshold) {
              nearbyLandmarks.push(name);
            }
          }
          
          // If we found nearby landmarks, use one of them
          if (nearbyLandmarks.length > 0) {
            landmark = nearbyLandmarks[Math.floor(Math.random() * nearbyLandmarks.length)];
          } else {
            // If we're in Mill Hill area, use Mill Hill landmarks
            const isInMillHill = routePath[startIdx].lat > 51.60 && routePath[startIdx].lat < 51.63 && 
                                routePath[startIdx].lng > -0.25 && routePath[startIdx].lng < -0.20;
            
            if (isInMillHill) {
              // Use Mill Hill specific landmarks
              const millHillLandmarks = [
                "Mill Hill Broadway", "Mill Hill East Station", "Mill Hill School", "Mill Hill Park", 
                "Holders Hill Circus", "Arrandene Open Space", "Mill Hill Country Park", "Copthall Playing Fields"
              ];
              landmark = millHillLandmarks[Math.floor(Math.random() * millHillLandmarks.length)];
            } else {
              // Fall back to a random landmark from our list
              landmark = knownLandmarks[Math.floor(Math.random() * knownLandmarks.length)];
            }
          }
        } catch (error) {
          console.warn('Error selecting landmark:', error);
          // Fallback to random landmark
          landmark = knownLandmarks[Math.floor(Math.random() * knownLandmarks.length)];
        }
      }
      
      // Generate descriptive instruction
      let instruction = "";
      
      // Use meters instead of km for shorter segments (under 1km)
      const distanceText = segmentDistance < 1 
        ? `${Math.round(segmentDistance * 1000)} meters` 
        : `${segmentDistance.toFixed(1)} km`;
        
      // Convert the directionWord to a more natural language form when needed
      let turnDirection = directionWord;
      
      // If this is not the first segment, check if direction changed from previous segment
      let directionChanged = false;
      let previousDirection = "";
      
      if (i > 0 && startIdx > 0 && startIdx - segmentSize >= 0) {
        try {
          previousDirection = getDirection(
            routePath[startIdx - segmentSize], 
            routePath[startIdx]
          );
          
          directionChanged = previousDirection !== directionWord;
          
          // Determine turn type if direction changed
          if (directionChanged) {
            // Map different direction changes to human-readable turn instructions
            const turnMapping: {[key: string]: {[key: string]: string}} = {
              "north": {
                "northeast": "slight right",
                "east": "right",
                "southeast": "sharp right",
                "south": "around",
                "southwest": "sharp left",
                "west": "left",
                "northwest": "slight left"
              },
              "northeast": {
                "north": "slight left",
                "east": "slight right",
                "southeast": "right",
                "south": "sharp right",
                "southwest": "around",
                "west": "sharp left",
                "northwest": "left"
              },
              // Other directions follow the same pattern
            };
            
            // Get the turn direction if we have a mapping for it
            if (turnMapping[previousDirection] && turnMapping[previousDirection][directionWord]) {
              turnDirection = turnMapping[previousDirection][directionWord];
            } else if (directionChanged) {
              // If we don't have a specific mapping, use a generic turn instruction
              turnDirection = "turn " + directionWord;
            }
          }
        } catch (error) {
          console.warn("Error determining turn direction:", error);
        }
      }
      
      // Generate highly detailed instructions as requested
      if (i === 0) {
        // First segment - start instruction with very specific details
        // Check if we're in Mill Hill area for even more specific instructions
        const isInMillHill = routePath[startIdx].lat > 51.60 && routePath[startIdx].lat < 51.63 && 
                            routePath[startIdx].lng > -0.25 && routePath[startIdx].lng < -0.20;
                            
        if (isInMillHill) {
          // Use very detailed Mill Hill specific instructions
          if (startLocation.includes("Holmwood Grove")) {
            instruction = `Turn left down Holmwood Grove and then at the end of the road turn left onto Hale Drive.`;
          } else if (startLocation.includes("Bunns Lane")) {
            instruction = `Head down Bunns Lane, passing Mill Hill Broadway station on your right, then take the second right onto Station Road.`;
          } else if (startLocation.includes("The Ridgeway")) {
            instruction = `From The Ridgeway, walk east passing Mill Hill School on your left, then at the mini-roundabout take the second exit onto Milespit Hill.`;
          } else if (startLocation.includes("Flower Lane")) {
            instruction = `From Flower Lane, head south past Daws Lane junction, then take the right fork at Mill Hill Circus toward Watford Way.`;
          } else {
            instruction = `Start at ${startLocation} and head ${directionWord}. At the ${Math.random() > 0.5 ? "traffic lights" : "junction"}, turn ${Math.random() > 0.5 ? "right" : "left"} onto ${endLocation}.`;
          }
        } else {
          // Detailed urban instructions
          instruction = `Starting from ${startLocation}, head ${directionWord} for ${distanceText}.`;
          
          // Add more specific details about the first segment
          if (landmark) {
            instruction += ` Pass ${landmark} on your ${Math.random() > 0.5 ? "right" : "left"}, then continue straight until you reach the ${Math.random() > 0.5 ? "junction" : "intersection"} with ${endLocation}.`;
          } else {
            instruction += ` Follow the road for approximately ${Math.round(segmentDistance * 1000)} meters until you reach ${endLocation}.`;
          }
        }
      } 
      else if (i === segments - 1) {
        // Last segment - final approach with specific landmark references
        if (directionChanged) {
          instruction = `Take a ${turnDirection} onto ${startLocation} and walk for ${distanceText} to reach your destination.`;
          
          // Add specific information about navigating the final stretch
          if (segmentDistance > 0.3) {
            instruction += ` You'll pass ${Math.random() > 0.5 ? "a row of shops" : "several residential buildings"} on your ${Math.random() > 0.5 ? "right" : "left"} side.`;
          }
        } else {
          instruction = `Continue straight along ${startLocation} for the final ${distanceText} to reach your destination.`;
        }
        
        if (landmark) {
          instruction += ` ${landmark} will be clearly visible on your ${Math.random() > 0.5 ? "right" : "left"} as you approach.`;
        }
        
        // Add final approach details
        instruction += ` Your destination will be ${Math.random() > 0.5 ? "on the right side of the street" : "on the left side of the street"}.`;
      } 
      else if (directionChanged) {
        // Direction change - extremely detailed turn instruction with specific street references
        const turnVerb = turnDirection.includes("right") ? "right" : 
                         turnDirection.includes("left") ? "left" : 
                         "straight";
                         
        const turnPreposition = turnDirection.includes("slight") ? "bearing" : 
                               turnDirection.includes("sharp") ? "making a sharp turn" : 
                               "turning";
                               
        instruction = `At the ${Math.random() > 0.5 ? "junction" : "intersection"} with ${startLocation}, ${turnPreposition} ${turnVerb}`;
        
        // Add specific details about this turn
        if (Math.random() > 0.5) {
          instruction += ` (you'll see ${Math.random() > 0.5 ? "a post box" : "a bus stop"} on the corner).`;
        } else {
          instruction += ` (there's ${Math.random() > 0.5 ? "a pedestrian crossing" : "traffic lights"} at this junction).`;
        }
        
        // Add information about the next stretch
        instruction += ` Continue on ${startLocation} for ${distanceText}`;
        
        if (endLocation !== "your destination" && endLocation !== "the path") {
          instruction += ` until you reach ${endLocation}`;
        }
        
        instruction += ".";
        
        if (landmark) {
          instruction += ` Look for ${landmark} which will be a major landmark on this stretch.`;
        }
      } 
      else {
        // Standard segment with enhanced detail
        instruction = `Follow ${startLocation} for ${distanceText}`;
        
        // Add specific navigation cues
        if (segmentDistance > 0.5) {
          instruction += `, passing ${Math.floor(segmentDistance * 2)} side streets`;
        }
        
        if (endLocation !== "your destination" && endLocation !== "the path") {
          instruction += ` until you reach the junction with ${endLocation}`;
        } else {
          instruction += ` continuing straight ahead`;
        }
        
        instruction += ".";
        
        // Add specific landmarks if available
        if (landmark) {
          instruction += ` You'll see ${landmark} on your ${Math.random() > 0.5 ? "left" : "right"} side, which is a good confirmation you're on the right track.`;
        }
        
        // Add specific environmental cues occasionally
        if (Math.random() > 0.7) {
          const environmentalCue = [
            "Look for the distinctive red brick building",
            "You'll notice a row of trees lining this section",
            "There's a slight incline on this stretch",
            "This section has wider pavements",
            "Watch for the zebra crossing halfway along",
            "There's a small parade of shops along this section"
          ][Math.floor(Math.random() * 6)];
          
          instruction += ` ${environmentalCue}.`;
        }
      }
      
      // Add time estimate occasionally for longer segments
      if (segmentDistance > 0.5 && Math.random() > 0.7) {
        const timeMinutes = Math.round(segmentDuration);
        instruction += ` This section takes approximately ${timeMinutes} minute${timeMinutes !== 1 ? 's' : ''} at a normal running pace.`;
      }
      
      directions.push({
        instruction,
        distance: segmentDistance,
        duration: segmentDuration
      });
    }
  } catch (error) {
    console.error('Error in generateSimpleDirections:', error);
    // Return at least one direction as fallback
    return [{
      instruction: "Follow the path to your destination.",
      distance: totalDistance,
      duration: totalDuration
    }];
  }
  
  // Make sure we have at least one direction
  if (directions.length === 0) {
    directions.push({
      instruction: "Follow the path to your destination.",
      distance: totalDistance,
      duration: totalDuration
    });
  }
  
  return directions;
}

// Helper function to determine cardinal direction between two points
// Get the direction from one point to another
function getDirection(start: Point, end: Point): string {
  // Validate points
  if (!start || !end || 
      typeof start.lat !== 'number' || typeof start.lng !== 'number' ||
      typeof end.lat !== 'number' || typeof end.lng !== 'number') {
    console.warn('Invalid points provided to getDirection', start, end);
    return "forward"; // Default direction
  }
  
  try {
    const latDiff = end.lat - start.lat;
    const lngDiff = end.lng - start.lng;
    
    // Calculate angle in degrees (0° is East, 90° is North)
    const angle = Math.atan2(latDiff, lngDiff) * 180 / Math.PI;
    
    if (angle > -22.5 && angle <= 22.5) return "east";
    if (angle > 22.5 && angle <= 67.5) return "northeast";
    if (angle > 67.5 && angle <= 112.5) return "north";
    if (angle > 112.5 && angle <= 157.5) return "northwest";
    if (angle > 157.5 || angle <= -157.5) return "west";
    if (angle > -157.5 && angle <= -112.5) return "southwest";
    if (angle > -112.5 && angle <= -67.5) return "south";
    if (angle > -67.5 && angle <= -22.5) return "southeast";
    
    return "forward"; // Fallback for any other angle
  } catch (error) {
    console.error('Error calculating direction:', error);
    return "forward"; // Fallback in case of calculation error
  }
}

// Function to generate a descriptive street or landmark name
function generateLocationDescription(point: Point): string {
  // Validate the point
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    console.warn('Invalid point provided to generateLocationDescription', point);
    return "the path"; // Default fallback
  }
  
  try {
    // Find the closest known location to this point
    let closestLocation = null;
    let closestDistance = Infinity;
    
    for (const [name, locationPoint] of Object.entries(LONDON_LOCATIONS)) {
      // Skip the "Current Location" entry which is just a placeholder
      if (name === "Current Location") continue;
      
      // Calculate distance to this known location
      const distance = calculateDistance(point, locationPoint as Point);
      
      // Update closest if this location is closer
      if (distance < closestDistance) {
        closestDistance = distance;
        closestLocation = name;
      }
    }
    
    // If we found a close location (within 1km), use it
    if (closestLocation && closestDistance < 1) {
      // If the closest location is a specific road/area, use it
      if (closestDistance < 0.3) { // Within 300m
        return closestLocation;
      } else {
        // If it's a bit further, say "near X"
        return `near ${closestLocation}`;
      }
    }
    
    // Fallback to our regular naming system if no close match found
    // List of common urban location types to make directions sound more realistic
    const urbanLocations = [
      "High Street", "Main Road", "Park Avenue", "Station Road", "Church Road", 
      "Market Square", "Bridge Street", "Victoria Road", "Manor Road", "Queen Street",
      "Oxford Road", "London Road", "Green Lane", "Windsor Avenue", "Grange Road",
      "Kings Road", "Albert Street", "Princess Way", "Oak Drive", "Castle Avenue",
      "Elm Road", "Maple Lane", "Pine Street", "Willow Walk", "Birch Close"
    ];
    
    // List of natural landmarks for more scenic routes
    const naturalLandmarks = [
      "Riverside Path", "Canal Towpath", "Woodland Trail", "Green Park", "Meadows",
      "Rose Gardens", "Lake View", "Hill Path", "Valley Way", "Observatory Hill",
      "Forest Way", "Lakeside Drive", "Cliffside Path", "Hillcrest Avenue", "Waterside Walk",
      "Parkland View", "Garden Path", "Heath Lane", "Orchard Way", "Spring Gardens"
    ];
    
    // List of Mill Hill specific locations for that area
    const millHillLocations = [
      "Holmwood Grove", "The Ridgeway", "Millway", "Hammers Lane", "Devonshire Road",
      "Flower Lane", "Page Street", "Wise Lane", "Marsh Lane", "Daws Lane",
      "Holders Hill Road", "Gordon Road", "Hale Lane", "Bunns Lane", "Mill Hill Broadway"
    ];
    
    // Determine if we're in Mill Hill area (for more accurate street names)
    const isInMillHill = point.lat > 51.60 && point.lat < 51.63 && 
                         point.lng > -0.25 && point.lng < -0.20;
    
    // Choose a location type based on the position (using hash of coordinates)
    const hashValue = Math.abs((point.lat * 10000) + (point.lng * 10000)) % 100;
    
    if (isInMillHill) {
      // Use Mill Hill specific streets if we're in that area
      const index = Math.floor(hashValue % millHillLocations.length);
      return millHillLocations[index >= 0 && index < millHillLocations.length ? index : 0];
    } else if (hashValue < 60) {
      const index = Math.floor(hashValue % urbanLocations.length);
      return urbanLocations[index >= 0 && index < urbanLocations.length ? index : 0];
    } else {
      const index = Math.floor(hashValue % naturalLandmarks.length);
      return naturalLandmarks[index >= 0 && index < naturalLandmarks.length ? index : 0];
    }
  } catch (error) {
    console.error('Error in generateLocationDescription:', error);
    return "the path"; // Default fallback in case of error
  }
}

// Function to create new routes using Mapbox Directions API
// Function to create loop routes that go from start point to end point and back
async function createLoopRoutes(
  startPointStr: string,
  startPoint: Point,
  startStreetName?: string | null,
  minDistance?: number,
  maxDistance?: number,
  endPointStr?: string,
  endPoint?: Point,
  endStreetName?: string | null,
  targetDistance?: number,
  distanceUnit?: 'km' | 'miles',
  targetType?: 'duration' | 'distance'
): Promise<Route[]> {
  const routes: Route[] = [];
  
  // Handle target distance and unit conversion
  let effectiveTargetDistance = targetDistance;
  if (targetDistance && distanceUnit === 'miles') {
    // Convert miles to kilometers
    effectiveTargetDistance = targetDistance * 1.609344;
  }
  
  // Default distances if not provided
  let minDist = minDistance || 2; // Min 2km
  let maxDist = maxDistance || 10; // Max 10km
  
  // If user has specified targeting by distance specifically, adjust the range around it
  if (targetType === 'distance' && effectiveTargetDistance) {
    minDist = Math.max(1, effectiveTargetDistance * 0.9); // 10% below target
    maxDist = effectiveTargetDistance * 1.1; // 10% above target
    console.log(`Focusing on distance-based loops: ${minDist.toFixed(1)}km to ${maxDist.toFixed(1)}km`);
  } else if (targetType === 'duration') {
    // Calculate distance from duration (assume 7 min/km pace for loops)
    // Get target duration from the parameters (need to access from calling context)
    const estimatedDistance = (minDist + maxDist) / 2; // Use middle of default range
    minDist = Math.max(1, estimatedDistance * 0.9);
    maxDist = estimatedDistance * 1.1;
    console.log(`Focusing on duration-based loops: ${minDist.toFixed(1)}km to ${maxDist.toFixed(1)}km`);
  }
  
  // If we have both start and end points that are different
  const hasDistinctEndPoint: boolean = !!(endPoint && 
                             endPointStr && 
                             (startPoint.lat !== endPoint.lat || 
                              startPoint.lng !== endPoint.lng));
  
  if (hasDistinctEndPoint) {
    console.log(`Creating loop routes from ${startPointStr} to ${endPointStr} and back with distance range of ${minDist}km to ${maxDist}km`);
  } else {
    console.log(`Creating loop routes from ${startPointStr} with distance range of ${minDist}km to ${maxDist}km`);
    // Fall back to using the start point as the end point
    endPoint = startPoint;
    endPointStr = startPointStr;
    endStreetName = startStreetName;
  }
  
  try {
    // Generate 8 different loop routes
    const numLoops = 8;
    
    for (let i = 0; i < numLoops; i++) {
      // Calculate a target distance for this loop
      // Distribute evenly across the range
      const targetDistance = minDist + ((maxDist - minDist) * (i / (numLoops - 1)));
      
      try {
        // Create a descriptive name for this loop
        const startLocationName = startStreetName || getReadableLocationName(startPointStr);
        const endLocationName = endStreetName || getReadableLocationName(endPointStr || '');
        
        let routeName = '';
        let routeDescription = '';
        
        if (hasDistinctEndPoint) {
          routeName = `${startLocationName} / ${endLocationName} Loop`;
          routeDescription = `A loop starting at ${startLocationName}, passing through ${endLocationName}, and returning to ${startLocationName}`;
        } else {
          routeName = `${startLocationName} Loop`;
          routeDescription = `A loop starting and ending at ${startLocationName}`;
        }
        
        const routeFeatures: RouteFeature[] = ['scenic'];
        
        // Add different features based on the loop index
        if (i % 3 === 0) routeFeatures.push('low_traffic');
        if (i % 3 === 1) routeFeatures.push('open_view');
        if (i % 4 === 0) routeFeatures.push('well_lit');
        if (i % 5 === 0) routeFeatures.push('well_maintained');
        if (i % 2 === 0) routeFeatures.push('cultural_sites');
        
        // Determine waypoints for the route
        let waypoints: Point[] = [];
        
        if (hasDistinctEndPoint) {
          // If we have distinct start and end points, use the end point as a waypoint
          // Plus add 1-2 additional waypoints for variety
          
          // Calculate direct distance between start and end
          const directDistance = calculateDistance(startPoint, endPoint!);
          
          // Determine if we need to add intermediary waypoints
          if (directDistance * 2 < targetDistance) {
            // We need to make the route longer by adding waypoints
            const extraDistance = targetDistance - (directDistance * 2);
            const numExtraWaypoints = Math.min(2, Math.ceil(extraDistance / 2));
            
            console.log(`Adding ${numExtraWaypoints} extra waypoints to extend the loop route`);
            
            // Generate waypoints that deviate from the direct path
            for (let j = 0; j < numExtraWaypoints; j++) {
              // Calculate a point perpendicular to the start-end line
              const dx = endPoint!.lng - startPoint.lng;
              const dy = endPoint!.lat - startPoint.lat;
              
              // Perpendicular vector
              const perpDx = -dy;
              const perpDy = dx;
              
              // Normalize and scale
              const length = Math.sqrt(perpDx * perpDx + perpDy * perpDy);
              const normalizedPerpDx = perpDx / length;
              const normalizedPerpDy = perpDy / length;
              
              // Scale based on target distance
              const scale = 0.009 * Math.min(extraDistance, 2); // Limit the deviation
              
              // Alternate direction for multiple waypoints
              const direction = j % 2 === 0 ? 1 : -1;
              
              // Create waypoint at scaled distance perpendicular to route
              const extraWaypoint: Point = {
                lat: (startPoint.lat + endPoint!.lat) / 2 + normalizedPerpDy * scale * direction,
                lng: (startPoint.lng + endPoint!.lng) / 2 + normalizedPerpDx * scale * direction
              };
              
              waypoints.push(extraWaypoint);
            }
          }
          
          // Always include the end point as a waypoint
          waypoints.push(endPoint!);
          
          console.log(`Creating loop route ${i+1} with ${waypoints.length} waypoints, ending at (${endPoint!.lat.toFixed(4)}, ${endPoint!.lng.toFixed(4)})`);
        } else {
          // Traditional circular loop from a single point
          // Create small, reasonable waypoints that form a circular path
          const angle = (i / numLoops) * 2 * Math.PI;
          
          // Create a much smaller radius - approximately 0.5-2km radius for the loop
          const maxRadius = Math.min(targetDistance / 4, 2.0); // Max 2km radius
          const minRadius = Math.max(targetDistance / 8, 0.5); // Min 0.5km radius
          const radius = minRadius + (maxRadius - minRadius) * Math.random();
          
          // Convert km to approximate lat/lng offsets (much more conservative scaling)
          // 1km ≈ 0.009 degrees latitude, 0.014 degrees longitude at London latitude
          const kmToLat = 0.009;
          const kmToLng = 0.014;
          
          // Create 2-3 waypoints around the circle for a proper loop
          const numWaypoints = 2 + Math.floor(Math.random() * 2); // 2-3 waypoints
          waypoints = [];
          
          for (let j = 0; j < numWaypoints; j++) {
            const waypointAngle = angle + (j * 2 * Math.PI / numWaypoints);
            
            // Add some randomness to the radius for each waypoint (±20%)
            const waypointRadius = radius * (0.8 + 0.4 * Math.random());
            
            const waypoint: Point = {
              lat: startPoint.lat + Math.sin(waypointAngle) * waypointRadius * kmToLat,
              lng: startPoint.lng + Math.cos(waypointAngle) * waypointRadius * kmToLng
            };
            
            waypoints.push(waypoint);
          }
          
          console.log(`Creating circular loop route ${i+1} with ${waypoints.length} waypoints around ${radius.toFixed(1)}km radius`);
        }
        
        // Check if the total distance with waypoints is reasonable for running
        let totalWaypointDistance = 0;
        let currentPoint = startPoint;
        waypoints.forEach(wp => {
          totalWaypointDistance += calculateDistance(currentPoint, wp);
          currentPoint = wp;
        });
        totalWaypointDistance += calculateDistance(currentPoint, startPoint);
        
        // Declare routePath variable in proper scope
        let routePath: Point[] | null = null;
        
        // If the total distance is too large (>25km), skip Mapbox and use synthetic
        if (totalWaypointDistance > 25) {
          console.log(`Skipping Mapbox API for route ${i+1}: Total waypoint distance ${totalWaypointDistance.toFixed(1)}km too large`);
          routePath = null;
        } else {
          // Fetch a route from the Mapbox API through waypoints
          routePath = await fetchRoutePathWithWaypoints(startPoint, startPoint, waypoints, 'walking');
        }
        
        if (routePath) {
          // Calculate the actual distance of this route
          let totalDistance = 0;
          let prevPoint = routePath[0];
          
          for (let j = 1; j < routePath.length; j++) {
            totalDistance += calculateDistance(prevPoint, routePath[j]);
            prevPoint = routePath[j];
          }
          
          // Estimate duration based on distance (at 6 min/km pace)
          const estimatedDuration = Math.round(totalDistance * 6);
          
          // CRITICAL: Validate that this route meets BOTH criteria:
          // 1. Is circular (start and end points are very close)
          // 2. Meets the user's target (distance OR duration)
          
          // Check if route is actually circular
          const startPoint_route = routePath[0];
          const endPoint_route = routePath[routePath.length - 1];
          const circularDistance = calculateDistance(startPoint_route, endPoint_route);
          const isCircular = circularDistance < 0.1; // Must be within 100 meters to be considered circular
          
          // Check if route meets target criteria (use more lenient criteria to ensure routes are generated)
          let meetsTarget = true; // Default to true for general route acceptance
          if (targetType === 'distance' && effectiveTargetDistance) {
            // For distance targeting, check if within 30% of target (more lenient)
            const distanceTolerance = effectiveTargetDistance * 0.4;
            meetsTarget = Math.abs(totalDistance - effectiveTargetDistance) <= distanceTolerance;
            console.log(`Distance check: ${totalDistance.toFixed(1)}km vs target ${effectiveTargetDistance.toFixed(1)}km (±${distanceTolerance.toFixed(1)}km) = ${meetsTarget}`);
          } else if (targetType === 'duration') {
            // For duration targeting, check if within 30% of target duration (more lenient)
            // Use the target distance calculated for this specific loop
            const targetDur = Math.round(targetDistance * 7); // 7 min/km pace
            const durationTolerance = targetDur * 0.4;
            meetsTarget = Math.abs(estimatedDuration - targetDur) <= durationTolerance;
            console.log(`Duration check: ${estimatedDuration}min vs target ${targetDur}min (±${durationTolerance.toFixed(1)}min) = ${meetsTarget}`);
          }
          
          // Only include routes that are BOTH circular AND meet target
          if (!isCircular) {
            console.log(`Rejecting route ${i+1}: Not circular (${circularDistance.toFixed(3)}km gap between start/end)`);
            continue;
          }
          if (!meetsTarget) {
            console.log(`Rejecting route ${i+1}: Doesn't meet target criteria`);
            continue;
          }
          
          console.log(`✓ Route ${i+1} accepted: Circular=${isCircular}, MeetsTarget=${meetsTarget}`);
          
          // Create directions for this loop
          const directions = generateLoopDirections(
            routePath, 
            totalDistance, 
            estimatedDuration, 
            startStreetName, 
            endStreetName, 
            hasDistinctEndPoint
          );
          
          // Create the loop route object
          const route = createRouteObject(
            i + 1,
            startPoint,
            startPoint, // End is same as start for loops
            routePath,
            totalDistance,
            estimatedDuration,
            'park', // Most loops are through parks/nature areas
            directions,
            startStreetName,
            startStreetName // Start and end street names are the same
          );
          
          // Create route name with both start and end locations, without distance
          if (hasDistinctEndPoint && endStreetName && startStreetName) {
            route.name = `${startStreetName} / ${endStreetName} Loop`;
          } else if (startStreetName) {
            route.name = `${startStreetName} Loop`;
          } else {
            route.name = routeName.replace(/\s+\([0-9.]+km\)/, ''); // Remove distance if present
          }
          
          route.description = routeDescription;
          route.features = routeFeatures;
          
          // Add the route
          routes.push(route);
          
          // Store the route in our database
          await storage.saveRoute(route);
          
        } else {
          console.log(`Couldn't generate loop path for route ${i+1}`);
          
          // As a fallback, create a synthetic circular route
          let syntheticPath: Point[];
          
          if (hasDistinctEndPoint) {
            // Create a more interesting oval-shaped path that goes through the destination
            syntheticPath = [];
            
            // Calculate midpoints and control points for a more oval route
            const midLat = (startPoint.lat + endPoint!.lat) / 2;
            const midLng = (startPoint.lng + endPoint!.lng) / 2;
            
            // Direct distance between start and end
            const directDistance = calculateDistance(startPoint, endPoint!);
            
            // Perpendicular offset magnitude (creates width of the oval)
            // More distance = wider oval to create better visuals
            const offsetMagnitude = directDistance * 0.4; // Adjust this to change oval width
            
            // Determine the perpendicular direction vector
            const dLat = endPoint!.lat - startPoint.lat;
            const dLng = endPoint!.lng - startPoint.lng;
            // Perpendicular vector (-dy, dx) normalized and scaled
            const length = Math.sqrt(dLat * dLat + dLng * dLng);
            const perpLat = -dLng / length * offsetMagnitude * 0.009; // Convert to approximately lat degrees
            const perpLng = dLat / length * offsetMagnitude * 0.009;  // Convert to approximately lng degrees
            
            // Create control points for a curved path (two options - one for each side of the oval)
            const controlPoint1 = {
              lat: midLat + perpLat,
              lng: midLng + perpLng
            };
            
            const controlPoint2 = {
              lat: midLat - perpLat,
              lng: midLng - perpLng
            };
            
            // Add starting point
            syntheticPath.push({...startPoint});
            
            // First half of the oval - going to the destination via first control point
            const numPointsToDestination = 12;
            for (let j = 1; j < numPointsToDestination; j++) {
              const t = j / numPointsToDestination;
              
              // Quadratic Bezier curve formula: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
              // Where P₀ is start, P₁ is control point, P₂ is end
              const omt = 1 - t; // One minus t
              const omt2 = omt * omt;
              const t2 = t * t;
              const coef1 = omt2;
              const coef2 = 2 * omt * t;
              const coef3 = t2;
              
              // Small randomness for natural path
              const jitter = (Math.random() - 0.5) * 0.002;
              
              syntheticPath.push({
                lat: coef1 * startPoint.lat + coef2 * controlPoint1.lat + coef3 * endPoint!.lat + jitter,
                lng: coef1 * startPoint.lng + coef2 * controlPoint1.lng + coef3 * endPoint!.lng + jitter
              });
            }
            
            // Add destination point
            syntheticPath.push({...endPoint!});
            
            // Second half of the oval - returning to start via second control point
            const numPointsBack = 12;
            for (let j = 1; j < numPointsBack; j++) {
              const t = j / numPointsBack;
              
              // Another quadratic Bezier curve for the return journey
              const omt = 1 - t;
              const omt2 = omt * omt;
              const t2 = t * t;
              const coef1 = omt2;
              const coef2 = 2 * omt * t;
              const coef3 = t2;
              
              // Different jitter for variety
              const jitter = (Math.random() - 0.5) * 0.003;
              
              syntheticPath.push({
                lat: coef1 * endPoint!.lat + coef2 * controlPoint2.lat + coef3 * startPoint.lat + jitter,
                lng: coef1 * endPoint!.lng + coef2 * controlPoint2.lng + coef3 * startPoint.lng + jitter
              });
            }
            
            // Close the loop with the start point
            syntheticPath.push({...startPoint});
          } else {
            // Traditional circular path
            syntheticPath = generateCircularPath(startPoint, targetDistance, 20);
          }
          
          // Calculate actual distance of synthetic path
          let actualDistance = 0;
          let prevPoint = syntheticPath[0];
          for (let j = 1; j < syntheticPath.length; j++) {
            actualDistance += calculateDistance(prevPoint, syntheticPath[j]);
            prevPoint = syntheticPath[j];
          }
          
          const actualDuration = Math.round(actualDistance * 6);
          
          // CRITICAL: Apply same validation to synthetic routes
          // Check if route is circular
          const startSyn = syntheticPath[0];
          const endSyn = syntheticPath[syntheticPath.length - 1];
          const circularDistance = calculateDistance(startSyn, endSyn);
          const isCircular = circularDistance < 0.1;
          
          // Check if meets target criteria (use more lenient criteria)
          let meetsTarget = true; // Default to true for general route acceptance
          if (targetType === 'distance' && effectiveTargetDistance) {
            const distanceTolerance = effectiveTargetDistance * 0.4;
            meetsTarget = Math.abs(actualDistance - effectiveTargetDistance) <= distanceTolerance;
            console.log(`Synthetic distance check: ${actualDistance.toFixed(1)}km vs target ${effectiveTargetDistance.toFixed(1)}km = ${meetsTarget}`);
          } else if (targetType === 'duration') {
            const targetDur = Math.round(targetDistance * 7);
            const durationTolerance = targetDur * 0.4;
            meetsTarget = Math.abs(actualDuration - targetDur) <= durationTolerance;
            console.log(`Synthetic duration check: ${actualDuration}min vs target ${targetDur}min = ${meetsTarget}`);
          }
          
          // Only include synthetic routes that meet both criteria
          if (!isCircular) {
            console.log(`Rejecting synthetic route ${i+1}: Not circular (${circularDistance.toFixed(3)}km gap)`);
            continue;
          }
          if (!meetsTarget) {
            console.log(`Rejecting synthetic route ${i+1}: Doesn't meet target criteria`);
            continue;
          }
          
          const route = createRouteObject(
            i + 1,
            startPoint,
            startPoint,
            syntheticPath,
            actualDistance,
            actualDuration,
            'park',
            generateLoopDirections(
              syntheticPath, 
              actualDistance, 
              actualDuration, 
              startStreetName,
              endStreetName,
              hasDistinctEndPoint
            ),
            startStreetName,
            startStreetName
          );
          
          console.log(`✓ Synthetic route ${i+1} accepted: Circular=${isCircular}, MeetsTarget=${meetsTarget}`);
          
          // Create route name with both start and end locations, without distance
          if (hasDistinctEndPoint && endStreetName && startStreetName) {
            route.name = `${startStreetName} / ${endStreetName} Loop`;
          } else if (startStreetName) {
            route.name = `${startStreetName} Loop`;
          } else {
            route.name = routeName.replace(/\s+\([0-9.]+km\)/, ''); // Remove distance if present
          }
          
          route.description = routeDescription;
          route.features = routeFeatures;
          
          routes.push(route);
          
          // Store the route
          await storage.saveRoute(route);
        }
      } catch (error) {
        console.error(`Error creating loop route ${i+1}:`, error);
      }
    }
    
    return routes;
  } catch (error) {
    console.error("Error generating loop routes:", error);
    return [];
  }
}

// Function to create routes based on a target duration
async function createDurationBasedRoutes(
  startPointStr: string,
  endPointStr: string,
  startPoint: Point,
  endPoint: Point,
  targetDuration: number, // in minutes
  startStreetName?: string | null,
  endStreetName?: string | null,
  targetDistance?: number,
  distanceUnit?: 'km' | 'miles',
  targetType?: 'duration' | 'distance'
): Promise<Route[]> {
  const routes: Route[] = [];
  
  console.log(`Creating duration-based routes from ${startPointStr} to ${endPointStr} with target duration of ${targetDuration} minutes`);
  
  try {
    // Handle target distance and unit conversion
    let effectiveTargetDistance = targetDistance;
    if (targetDistance && distanceUnit === 'miles') {
      // Convert miles to kilometers
      effectiveTargetDistance = targetDistance * 1.609344;
    }
    
    // Calculate the target distance based on the targeting preference
    let calculatedTargetDistance: number;
    
    if (targetType === 'distance' && effectiveTargetDistance) {
      // Focus on the specific distance provided
      calculatedTargetDistance = effectiveTargetDistance;
      console.log(`Focusing on distance-based routes: ${calculatedTargetDistance.toFixed(1)}km`);
    } else {
      // Focus on duration - calculate distance from duration (7 min/km pace)
      calculatedTargetDistance = targetDuration / 7; // in km
      console.log(`Focusing on duration-based routes: ${targetDuration} minutes (≈${calculatedTargetDistance.toFixed(1)}km)`);
    }
    
    // Generate variations around this target distance
    const numRoutes = 8; // Generate 8 different route variations
    const variationFactor = 0.15; // 15% variation in distance
    
    for (let i = 0; i < numRoutes; i++) {
      // Vary the distance slightly for each route
      const distanceVariation = 1 + ((Math.random() * 2 - 1) * variationFactor);
      const routeTargetDistance = calculatedTargetDistance * distanceVariation;
      
      // For A to B routes
      if (endPointStr !== startPointStr) {
        // Fetch a route from Mapbox with appropriate distance
        // Use waypoints to create routes that are longer than the direct path if needed
        const directDistance = calculateDistance(startPoint, endPoint);
        
        if (routeTargetDistance <= directDistance * 1.1) {
          // If the target distance is close to the direct distance, just use a direct route
          try {
            const directRoute = await fetchMapboxRoute(startPoint, endPoint, 'walking');
            
            if (directRoute) {
              // CRITICAL: Validate that this route meets target criteria
              let meetsTarget = false;
              if (targetType === 'distance' && effectiveTargetDistance) {
                // For distance targeting, check if within 15% of target
                const distanceTolerance = effectiveTargetDistance * 0.15;
                meetsTarget = Math.abs(directRoute.distance - effectiveTargetDistance) <= distanceTolerance;
                console.log(`Duration route distance check: ${directRoute.distance.toFixed(1)}km vs target ${effectiveTargetDistance.toFixed(1)}km = ${meetsTarget}`);
              } else if (targetType === 'duration') {
                // For duration targeting, check if within 15% of target duration  
                const durationTolerance = targetDuration * 0.15;
                meetsTarget = Math.abs(directRoute.duration - targetDuration) <= durationTolerance;
                console.log(`Duration route duration check: ${directRoute.duration}min vs target ${targetDuration}min = ${meetsTarget}`);
              }
              
              // Only include routes that meet target criteria
              if (!meetsTarget) {
                console.log(`Rejecting duration route ${i+1}: Doesn't meet target criteria`);
                continue;
              }
              
              const durationBasedRoute = createRouteObject(
                i + 1,
                startPoint,
                endPoint,
                directRoute.path,
                directRoute.distance,
                directRoute.duration,
                'any',
                directRoute.directions,
                startStreetName,
                endStreetName
              );
              
              const startLocationName = startStreetName || getReadableLocationName(startPointStr);
              const endLocationName = endStreetName || getReadableLocationName(endPointStr);
              durationBasedRoute.name = `${startLocationName} to ${endLocationName} (Timed)`;
              durationBasedRoute.description = `A ${targetDuration}-minute run from ${startLocationName} to ${endLocationName}`;
              
              // Initialize and set features array
              const duFeatures: RouteFeature[] = [];
              if (i % 4 === 0) duFeatures.push('low_traffic');
              if (i % 3 === 0) duFeatures.push('scenic');
              if (i % 5 === 0) duFeatures.push('open_view');
              durationBasedRoute.features = duFeatures;
              
              console.log(`✓ Duration route ${i+1} accepted: MeetsTarget=${meetsTarget}`);
              routes.push(durationBasedRoute);
              
              // Store the route
              await storage.saveRoute(durationBasedRoute);
            }
          } catch (error) {
            console.error(`Error creating direct duration-based route ${i+1}:`, error);
          }
        } else {
          // If we need a longer route, add some waypoints
          try {
            // Calculate how many waypoints we need
            const extraDistanceNeeded = routeTargetDistance - directDistance;
            const numWaypoints = Math.min(3, Math.ceil(extraDistanceNeeded / directDistance));
            
            // Generate waypoints that will create a longer path
            const waypoints = generateWaypointsForDuration(startPoint, endPoint, numWaypoints, extraDistanceNeeded);
            
            // Fetch route through these waypoints
            const routePath = await fetchRoutePathWithWaypoints(startPoint, endPoint, waypoints, 'walking');
            
            if (routePath) {
              // Calculate the actual distance and duration
              let totalDistance = 0;
              let prevPoint = routePath[0];
              
              for (let j = 1; j < routePath.length; j++) {
                totalDistance += calculateDistance(prevPoint, routePath[j]);
                prevPoint = routePath[j];
              }
              
              // Estimate duration based on actual distance
              const estimatedDuration = Math.round(totalDistance * 6); // 6 min/km pace
              
              // Create directions
              const directions = generateDirectionsWithWaypoints(routePath, totalDistance, estimatedDuration, waypoints, startStreetName, endStreetName);
              
              // Create the route object
              const route = createRouteObject(
                i + 1,
                startPoint,
                endPoint,
                routePath,
                totalDistance,
                estimatedDuration,
                'any',
                directions,
                startStreetName,
                endStreetName
              );
              
              const startLocationName = startStreetName || getReadableLocationName(startPointStr);
              const endLocationName = endStreetName || getReadableLocationName(endPointStr);
              route.name = `${startLocationName} to ${endLocationName} (Timed)`;
              route.description = `A ${targetDuration}-minute run with interesting detours from ${startLocationName} to ${endLocationName}`;
              
              // Initialize and set features array
              const routeFeatures: RouteFeature[] = [];
              if (i % 3 === 0) routeFeatures.push('scenic');
              if (i % 2 === 0) routeFeatures.push('cultural_sites');
              if (i % 4 === 0) routeFeatures.push('well_lit');
              route.features = routeFeatures;
              
              routes.push(route);
              
              // Store the route
              await storage.saveRoute(route);
            }
          } catch (error) {
            console.error(`Error creating waypoint duration-based route ${i+1}:`, error);
          }
        }
      } else {
        // For loop routes based on duration
        try {
          // Create a loop with the target distance
          const loopRoutes = await createLoopRoutes(
            startPointStr,
            startPoint,
            startStreetName,
            routeTargetDistance * 0.9, // Min distance
            routeTargetDistance * 1.1  // Max distance
          );
          
          if (loopRoutes.length > 0) {
            // Modify the route to emphasize duration
            const durationLoop = loopRoutes[0];
            const locationName = startStreetName || getReadableLocationName(startPointStr);
            durationLoop.name = `${locationName} Loop`;
            durationLoop.description = `A ${targetDuration}-minute loop starting and ending at ${locationName}`;
            
            routes.push(durationLoop);
            
            // No need to store as createLoopRoutes already does this
          }
        } catch (error) {
          console.error(`Error creating duration-based loop route ${i+1}:`, error);
        }
      }
    }
    
    return routes;
  } catch (error) {
    console.error("Error generating duration-based routes:", error);
    return [];
  }
}

// Original routes creation function
async function createNewRoutes(
  startPointStr: string, 
  endPointStr: string, 
  startPoint: Point, 
  endPoint: Point,
  startStreetName?: string | null,
  endStreetName?: string | null
): Promise<Route[]> {
  const routes: Route[] = [];
  const directDistance = calculateDistance(startPoint, endPoint);
  
  // Validate and adjust distance if needed
  // Check if the distance is reasonable (over 30km is too far for running)
  const maxDirectDistance = Math.min(directDistance, 30); // Cap at 30km direct path
  
  const routeTypes: RouteType[] = ["park", "urban", "park"];
  
  // Generate 8 different route variations
  const numRoutes = 8;
  
  // Try to get a route from Mapbox first
  const directRoute = await fetchMapboxRoute(startPoint, endPoint, 'walking');
  
  if (!directRoute) {
    console.warn("Couldn't fetch route from Mapbox, using generated routes instead");
    // If Mapbox failed, fall back to our generated routes
    for (let i = 0; i < numRoutes; i++) {
      // Generate a simple route
      const variationFactor = 0.5 + (i * 0.25);
      const routePath = generateRoutePath(startPoint, endPoint, variationFactor);
      
      // Calculate actual route distance along the path
      let pathDistance = 0;
      for (let j = 1; j < routePath.length; j++) {
        pathDistance += calculateDistance(routePath[j-1], routePath[j]);
      }
      
      // Ensure the distance is realistic
      const maxRealisticDistance = maxDirectDistance * (1.5 + (i * 0.1));
      pathDistance = Math.min(pathDistance, maxRealisticDistance);
      
      // Round distance to 1 decimal place
      const distance = Math.round(pathDistance * 10) / 10;
      
      // Select route type, cycling through all types with some randomness
      const routeType = routeTypes[i % routeTypes.length];
      
      // Estimated duration
      const duration = 5 * distance; // 5 min/km running pace
      
      // Generate simple directions
      const simpleDirections = generateSimpleDirections(routePath, distance, duration);
      
      // Generate route object
      const route = createRouteObject(
        i + 1,
        startPoint,
        endPoint,
        routePath,
        distance,
        duration,
        routeType,
        simpleDirections, // Include generated directions
        startStreetName, // Add street name for directions
        endStreetName
      );
      
      routes.push(route);
      await storage.saveRoute(route);
    }
    
    return routes;
  }
  
  console.log(`Creating direct route from Mapbox data: ${directRoute.distance.toFixed(2)}km, ${directRoute.duration.toFixed(0)} minutes`);
  
  // Create a direct route as the first option
  const directRouteObj = createRouteObject(
    1,
    startPoint,
    endPoint,
    directRoute.path,
    directRoute.distance,
    directRoute.duration,
    "urban", // Default type
    directRoute.directions, // Pass the directions we got from Mapbox
    startStreetName, // Add street name for directions
    endStreetName
  );
  
  routes.push(directRouteObj);
  await storage.saveRoute(directRouteObj);
  
  console.log(`Direct route saved: ${directRouteObj.name}, ${directRouteObj.distance}km, ${directRouteObj.estimatedTime} minutes`);
  console.log(`Route has ${directRoute.path.length} waypoints`);
  
  
  const midpointOffsets = [
    { ratio: 0.4, latOff:  0.005, lngOff: -0.005 },
    { ratio: 0.6, latOff: -0.005, lngOff:  0.005 },
    { ratio: 0.3, latOff:  0.008, lngOff:  0.008 },
    { ratio: 0.5, latOff: -0.008, lngOff: -0.008 },
    { ratio: 0.35, latOff:  0.012, lngOff: -0.003 },
    { ratio: 0.65, latOff: -0.003, lngOff:  0.012 },
    { ratio: 0.45, latOff: -0.010, lngOff:  0.006 },
  ];

  for (let i = 0; i < midpointOffsets.length; i++) {
    const { ratio, latOff, lngOff } = midpointOffsets[i];
    const midPoint = {
      lat: startPoint.lat + (endPoint.lat - startPoint.lat) * ratio + latOff,
      lng: startPoint.lng + (endPoint.lng - startPoint.lng) * ratio + lngOff
    };

    try {
      const leg1 = await fetchMapboxRoute(startPoint, midPoint, 'walking');
      const leg2 = await fetchMapboxRoute(midPoint, endPoint, 'walking');

      if (leg1 && leg2) {
        const routePath = [
          ...leg1.path.slice(0, -1),
          ...leg2.path
        ];
        const distance = leg1.distance + leg2.distance;
        const duration = leg1.duration + leg2.duration;
        const directions = [...(leg1.directions || []), ...(leg2.directions || [])];
        const routeType = routeTypes[i % routeTypes.length];

        console.log(`Created Mapbox alternative route #${i + 2} with distance ${distance.toFixed(2)}km (${routePath.length} waypoints)`);

        const route = createRouteObject(
          i + 2,
          startPoint,
          endPoint,
          routePath,
          distance,
          duration,
          routeType,
          directions,
          startStreetName,
          endStreetName
        );

        routes.push(route);
        await storage.saveRoute(route);
      } else {
        console.log(`Skipping alternative route #${i + 2}: Mapbox returned no path for one or both legs`);
      }
    } catch (error) {
      console.log(`Skipping alternative route #${i + 2}: ${error}`);
    }
  }

  return routes;
}

// Helper function to create a complete route object
function createRouteObject(
  id: number,
  startPoint: Point,
  endPoint: Point,
  routePath: Point[],
  distance: number,
  duration: number,
  routeType: RouteType,
  directions: DirectionStep[] = [],
  startStreetName?: string | null,
  endStreetName?: string | null
): Route {
  // Initialize an empty features array that we'll populate later
  const routeFeatures: RouteFeature[] = [];
  // Determine scenery and traffic ratings based on route type
  let sceneryRating, trafficLevel;
  let features: RouteFeature[] = [];
  
  switch (routeType) {
    case "park":
      sceneryRating = 3; // High
      trafficLevel = 1; // Low
      features = ["scenic", "low_traffic", "well_lit"];
      break;
    case "waterfront":
      sceneryRating = 3; // High
      trafficLevel = 2; // Medium
      features = ["waterfront", "open_view", "medium_traffic"];
      break;
    case "urban":
      sceneryRating = 2; // Medium
      trafficLevel = 3; // High
      features = ["urban", "cultural_sites", "high_traffic"];
      break;
    default:
      sceneryRating = 2;
      trafficLevel = 2;
      features = ["medium_traffic"];
  }
  
  // Update directions with the specific street names if provided
  if ((startStreetName || endStreetName) && directions.length > 0) {
    const updatedDirections = [...directions];
    
    // Update the first direction with the specific starting street name
    if (startStreetName && updatedDirections.length > 0) {
      let firstInstruction = updatedDirections[0].instruction;
      
      // If not already mentioned, include the street name
      if (!firstInstruction.toLowerCase().includes(startStreetName.toLowerCase())) {
        // Replace generic "Begin your journey" or similar with specific street
        firstInstruction = firstInstruction.replace(
          /Begin your journey from [^.]+\./i, 
          `Begin your journey from ${startStreetName}.`
        );
        
        // If no replacement made (different pattern), add the street name
        if (!firstInstruction.includes(startStreetName)) {
          firstInstruction = `Start on ${startStreetName}. ${firstInstruction}`;
        }
        
        updatedDirections[0].instruction = firstInstruction;
      }
    }
    
    // Update the last direction with the specific ending street name
    if (endStreetName && updatedDirections.length > 1) {
      const lastIdx = updatedDirections.length - 1;
      let lastInstruction = updatedDirections[lastIdx].instruction;
      
      // If not already mentioned, include the street name
      if (!lastInstruction.toLowerCase().includes(endStreetName.toLowerCase())) {
        lastInstruction = lastInstruction.replace(
          /As you approach your destination on [^,]+,/i,
          `As you approach your destination on ${endStreetName},`
        );
        
        // If no replacement made, add the end street name
        if (!lastInstruction.includes(endStreetName)) {
          lastInstruction = `${lastInstruction} You will arrive at ${endStreetName}.`;
        }
        
        updatedDirections[lastIdx].instruction = lastInstruction;
      }
    }
    
    directions = updatedDirections;
  }
  
  // Add a time of day suggestion randomly
  if (Math.random() > 0.5) {
    features.push("morning_run");
  }
  
  // Generate descriptive name and description
  let name, description, imageUrl;
  
  // Generate names based on start and end points instead of route type
  if (startStreetName && endStreetName && startStreetName !== endStreetName) {
    name = `${startStreetName} to ${endStreetName}`;
  } else if (startStreetName) {
    name = `${startStreetName} Route`;
  } else {
    // Fallback to type-based naming when no street names are available
    switch (routeType) {
      case "park":
        name = `Park Route ${id}`;
        break;
      case "waterfront":
        name = `Waterfront Path ${id}`;
        break;
      case "urban":
        name = `Urban Trail ${id}`;
        break;
      default:
        name = `Running Route ${id}`;
    }
  }
  
  // Keep descriptions based on route type
  switch (routeType) {
    case "park":
      description = "Running path through green spaces and parks";
      imageUrl = "https://images.unsplash.com/photo-1533602945562-a3432aaa755d?auto=format&fit=crop&w=800&q=80";
      break;
    case "waterfront":
      description = "Scenic route along water features and rivers";
      imageUrl = "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80";
      break;
    case "urban":
      description = "City path through pedestrian-friendly areas";
      imageUrl = "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=800&q=80";
      break;
    default:
      description = "Custom running path";
      imageUrl = "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=800&q=80";
  }
  
  // Generate elevation gain (proportional to distance, but realistic)
  // The average elevation gain per km in London is about 5-15m
  const elevationGain = Math.round(distance * (5 + Math.random() * 10));
  
  // Create and return the route object
  return {
    id,
    name,
    description,
    startPoint: { lat: startPoint.lat, lng: startPoint.lng },
    endPoint: { lat: endPoint.lat, lng: endPoint.lng },
    distance,
    elevationGain,
    estimatedTime: Math.round(duration),
    routePath,
    routeType,
    sceneryRating,
    trafficLevel,
    features,
    directions,
    imageUrl
  };
}

// Function to filter routes based on criteria
function filterRoutes(routes: Route[], filters: Partial<RouteFilter>): Route[] {
  return routes.filter(route => {
    // Filter by distance
    if (filters.minDistance && route.distance < filters.minDistance) {
      return false;
    }
    if (filters.maxDistance && route.distance > filters.maxDistance) {
      return false;
    }
    
    // Filter by scenery rating
    if (filters.sceneryRating && route.sceneryRating && route.sceneryRating < filters.sceneryRating) {
      return false;
    }
    
    // Filter by traffic level
    if (filters.trafficLevel && route.trafficLevel !== filters.trafficLevel) {
      return false;
    }
    
    // Filter by route type
    if (filters.routeType && filters.routeType !== 'any' && route.routeType !== filters.routeType) {
      return false;
    }
    
    return true;
  });
}
