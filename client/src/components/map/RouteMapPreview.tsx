import { useEffect, useRef } from 'react';
import { Route, Point } from '@shared/schema';
import mapboxgl from 'mapbox-gl';
import { useQuery } from '@tanstack/react-query';
import { addArrowLayer, addFlagLayers } from '@/lib/route-arrows';

interface RouteMapPreviewProps {
  route: Route;
  height?: number;
  detailMode?: boolean;
  userLocation?: Point | null;
}

interface MapConfig {
  mapboxToken: string;
}

export default function RouteMapPreview({ route, height = 180, detailMode = false, userLocation }: RouteMapPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const pulseAnimRef = useRef<number | null>(null);

  // Get Mapbox token
  const { data: config } = useQuery<MapConfig>({
    queryKey: ['/api/config'],
  });

  useEffect(() => {
    // Clean up previous map instance if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Exit if container ref is not available or no token
    if (!mapContainerRef.current || !config?.mapboxToken) return;

    try {
      // Set Mapbox access token
      mapboxgl.accessToken = config.mapboxToken;

      // Default to route start (no hardcoded city fallback)
      const defaultCenter: [number, number] = [0, 20];
      
      // Try to get start point from route
      let center = defaultCenter;
      if (route.startPoint && 
          typeof route.startPoint === 'object' && 
          'lng' in route.startPoint && 
          'lat' in route.startPoint) {
        center = [route.startPoint.lng, route.startPoint.lat] as [number, number];
      }

      // Create the map instance
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: center,
        zoom: 11,
        interactive: false,
        attributionControl: false
      });
      
      // Save map instance
      mapInstanceRef.current = map;

      // Add route to map when it's loaded
      map.on('load', () => {
        try {
          // Verify route path exists and is valid
          if (!route.routePath || !Array.isArray(route.routePath) || route.routePath.length < 2) {
            return;
          }

          // Filter to only valid points
          const validPoints = route.routePath.filter((point): point is Point => 
            point !== null && 
            typeof point === 'object' && 
            'lng' in point && 
            'lat' in point && 
            typeof point.lng === 'number' && 
            typeof point.lat === 'number'
          );
          
          if (validPoints.length < 2) {
            return; // Need at least 2 points for a valid line
          }
          
          // Create coordinates array for GeoJSON
          const coordinates: [number, number][] = validPoints.map(point => 
            [point.lng, point.lat] as [number, number]
          );
          
          // Add route as GeoJSON source
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coordinates
              }
            }
          });

          // Add a line layer to display the route
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3B82F6',
              'line-width': 4
            }
          });

          const arrowSpacing = detailMode ? 1.5 : 3;
          addArrowLayer(map, 'route-arrows', 'route-arrows-layer', coordinates, arrowSpacing);
          addFlagLayers(map, 'start-flag-src', 'start-flag-layer', coordinates, 'end-flag-src', 'end-flag-layer');

          if (userLocation) {
            map.addSource('user-location', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: [userLocation.lng, userLocation.lat]
                }
              }
            });

            map.addLayer({
              id: 'user-location-pulse',
              type: 'circle',
              source: 'user-location',
              paint: {
                'circle-radius': detailMode ? 14 : 10,
                'circle-color': '#3B82F6',
                'circle-opacity': 0.25,
              }
            });

            map.addLayer({
              id: 'user-location-dot',
              type: 'circle',
              source: 'user-location',
              paint: {
                'circle-radius': detailMode ? 7 : 5,
                'circle-color': '#3B82F6',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }
            });

            const minR = detailMode ? 10 : 7;
            const maxR = detailMode ? 22 : 16;
            const animate = () => {
              const t = (Math.sin(Date.now() / 600) + 1) / 2;
              const radius = minR + t * (maxR - minR);
              const opacity = 0.3 - t * 0.2;
              if (map.getLayer('user-location-pulse')) {
                map.setPaintProperty('user-location-pulse', 'circle-radius', radius);
                map.setPaintProperty('user-location-pulse', 'circle-opacity', opacity);
              }
              pulseAnimRef.current = requestAnimationFrame(animate);
            };
            pulseAnimRef.current = requestAnimationFrame(animate);
          }

          const bounds = new mapboxgl.LngLatBounds(
            coordinates[0],
            coordinates[0]
          );
          
          // Extend bounds to include all coordinates
          for (const coord of coordinates) {
            bounds.extend(coord);
          }
          
          // Fit map to the route bounds
          map.fitBounds(bounds, {
            padding: 30
          });
        } catch (error) {
          console.error('Error adding route to map:', error);
        }
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (pulseAnimRef.current !== null) {
        cancelAnimationFrame(pulseAnimRef.current);
        pulseAnimRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [config, route]);

  return (
    <div 
      ref={mapContainerRef} 
      className="route-preview-map w-full rounded-lg overflow-hidden" 
      style={{ height: `${height}px` }}
    />
  );
}