import { Point } from "@shared/schema";

// Type for location suggestion results
export interface LocationSuggestion {
  name: string;
  point: Point;
}

/**
 * Search for locations globally using Mapbox Geocoding API.
 * No longer hardcoded to London -- works anywhere in the world.
 */
export async function searchLocations(query: string, proximity?: string, country?: string): Promise<LocationSuggestion[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    console.error("Mapbox token not available for location search");
    return [];
  }

  try {
    const params = new URLSearchParams({
      access_token: mapboxToken,
      types: 'postcode,place,locality,neighborhood,address,poi',
      limit: '8',
    });

    // Restrict to a specific country if provided
    if (country) {
      params.set('country', country);
    }

    // If the user has a location, bias results towards it
    if (proximity) {
      params.set('proximity', proximity);
      const [lngStr, latStr] = proximity.split(',');
      const lng = parseFloat(lngStr);
      const lat = parseFloat(latStr);
      if (!isNaN(lng) && !isNaN(lat)) {
        // ~1 degree \u2248 111 km; use \u00b11 degree for a roughly 200 km box
        const delta = 1;
        params.set('bbox', `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`);
      }
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Mapbox geocoding error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map((feature: any) => ({
      name: feature.place_name || feature.text,
      point: {
        lat: feature.center[1],
        lng: feature.center[0],
      },
    }));
  } catch (error) {
    console.error("Error searching locations:", error);
    return [];
  }
}

/**
 * Geocode a location string (address, place name, postcode) to coordinates.
 * Works globally via Mapbox Geocoding API.
 */
export async function geocodeLocation(query: string, proximity?: string): Promise<Point | null> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    console.error("Mapbox token not available for geocoding");
    return null;
  }

  try {
    const params = new URLSearchParams({
      access_token: mapboxToken,
      types: 'postcode,place,locality,neighborhood,address,poi',
      limit: '1',
    });

    if (proximity) {
      params.set('proximity', proximity);
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
    console.log(`Geocoding "${query}" via Mapbox...`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Mapbox geocoding error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const point: Point = {
        lat: feature.center[1],
        lng: feature.center[0],
      };
      console.log(`Geocoded "${query}" -> lat=${point.lat}, lng=${point.lng} (${feature.place_name})`);
      return point;
    }

    console.log(`No geocoding results for "${query}"`);
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Keep the old function name as an alias for backwards compatibility in routes.ts
export const getLondonLocations = searchLocations;

// Legacy exports -- previously hardcoded London-only data.
// Now empty; route resolution uses Mapbox geocoding globally.
export const LONDON_LOCATIONS: Record<string, { lat: number; lng: number }> = {};
export const LONDON_POSTCODES: Record<string, { lat: number; lng: number }> = {};
export const POSTCODE_STREETS: Record<string, string> = {};

/**
 * Legacy function -- previously did fuzzy matching against hardcoded London locations.
 * Returns undefined since the hardcoded location data has been removed.
 * Callers should use geocodeLocation() instead for async resolution.
 */
export function getLocationByName(_name: string): Point | undefined {
  return undefined;
}
