import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Route, Point } from '@shared/schema';
import { addMapControls } from '@/lib/map-utils';
import { addArrowLayer, addFlagLayers } from '@/lib/route-arrows';
import { API_BASE } from '@/lib/api';

interface MapViewProps {
  routes: Route[];
  selectedRoute: Route | null;
  onRouteSelect: (route: Route) => void;
  userLocation?: Point | null;
}

export default function MapView({ routes, selectedRoute, onRouteSelect, userLocation }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pulseAnimRef = useRef<number | null>(null);

  // Always-current refs so closures (ResizeObserver, etc.) see latest prop values
  const userLocationRef = useRef(userLocation);
  const routesRef = useRef(routes);
  const selectedRouteRef = useRef(selectedRoute);
  const tokenReadyRef = useRef(false);

  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { routesRef.current = routes; }, [routes]);
  useEffect(() => { selectedRouteRef.current = selectedRoute; }, [selectedRoute]);

  // Create the Mapbox map, reading initial center from refs so it always
  // uses the latest prop values at the moment the container is visible.
  const createMapRef = useRef<() => void>(() => {});
  createMapRef.current = () => {
    if (map.current || !mapContainer.current) return;

    const ul = userLocationRef.current;
    const rts = routesRef.current;
    const sel = selectedRouteRef.current;

    // Default to user location or first route; no hardcoded city default
    let center: [number, number] = [0, 20]; // neutral world view
    let zoom = 2;

    if (sel?.startPoint) {
      const sp = sel.startPoint as Point;
      center = [sp.lng, sp.lat];
    } else if (rts?.length && (rts[0].startPoint as Point)?.lat) {
      const sp = rts[0].startPoint as Point;
      center = [sp.lng, sp.lat];
    } else if (ul) {
      center = [ul.lng, ul.lat];
      zoom = 15;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
      });

      map.current.on('load', () => {
        setMapLoaded(true);
        setLoading(false);
        if (map.current) addMapControls(map.current);
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setLoading(false);
      });
    } catch (err) {
      console.error('Error creating map:', err);
      setError('Error initializing map');
      setLoading(false);
    }
  };

  // Fetch token. Once ready, create the map if container is already visible,
  // otherwise the ResizeObserver will create it when the container appears.
  useEffect(() => {
    let cancelled = false;

    const configUrl = `${API_BASE}/api/config`;
    fetch(configUrl)
      .then(r => {
        if (!r.ok) throw new Error(`Config request failed: ${r.status}`);
        return r.json();
      })
      .then(config => {
        if (cancelled) return;
        if (config?.mapboxToken) {
          mapboxgl.accessToken = config.mapboxToken;
          tokenReadyRef.current = true;
          // Create immediately if container already has dimensions
          if (mapContainer.current) {
            const { width, height } = mapContainer.current.getBoundingClientRect();
            if (width > 0 && height > 0) createMapRef.current();
          }
        } else {
          setError('No Mapbox token available. Check MAPBOX_ACCESS_TOKEN on server.');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`Failed to fetch map config from ${configUrl}:`, err);
          const hint = API_BASE ? '' : ' Is VITE_API_URL set for this build?';
          setError(`Failed to load map configuration.${hint}`);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ResizeObserver: create map the first time the container has real dimensions
  // (handles the case where the map panel is hidden on mobile until the user switches to map view).
  // Also handles resize/recenter when the panel is shown again after being hidden.
  useEffect(() => {
    if (!mapContainer.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;

      if (!map.current) {
        // Container just became visible — create map if token is ready
        if (tokenReadyRef.current) createMapRef.current();
      } else {
        // Map already exists — resize canvas and re-center on user location
        map.current.resize();
        if (!routesRef.current?.length && userLocationRef.current) {
          map.current.jumpTo({
            center: [userLocationRef.current.lng, userLocationRef.current.lat],
            zoom: 15,
          });
        }
      }
    });

    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pulseAnimRef.current !== null) {
        cancelAnimationFrame(pulseAnimRef.current);
        pulseAnimRef.current = null;
      }
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update routes and user location marker whenever props or map-loaded state changes
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const updateRoutes = () => {
      try {
        if (!map.current!.isStyleLoaded()) {
          setTimeout(updateRoutes, 100);
          return;
        }

        clearRoutesFromMap();

        routes.forEach((route) => {
          addRouteToMap(route, route.id === selectedRoute?.id);
        });

        addUserLocationMarker();

        if (selectedRoute) {
          fitMapToRoute(selectedRoute);
        } else if (routes.length > 0) {
          fitMapToAllRoutes(routes);
        } else if (userLocation) {
          map.current!.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 15,
            duration: 800,
          });
        }
      } catch (err) {
        console.error('Error updating routes on map:', err);
      }
    };

    updateRoutes();
  }, [routes, selectedRoute, mapLoaded, userLocation]);

  const clearRoutesFromMap = () => {
    if (!map.current) return;

    const routeIds = routes.map(r => `route-${r.id}`);
    routeIds.forEach(id => {
      for (const lid of [`${id}-endflag-layer`, `${id}-flag-layer`, `${id}-arrows-layer`, id]) {
        if (map.current?.getLayer(lid)) map.current.removeLayer(lid);
      }
      for (const sid of [`${id}-endflag`, `${id}-flag`, `${id}-arrows`, id]) {
        if (map.current?.getSource(sid)) map.current.removeSource(sid);
      }
    });

    for (const lid of ['user-location-pulse', 'user-location-glow', 'user-location-dot']) {
      if (map.current?.getLayer(lid)) map.current.removeLayer(lid);
    }
    if (map.current?.getSource('user-location')) map.current.removeSource('user-location');
  };

  const addUserLocationMarker = () => {
    if (!map.current || !userLocation) return;

    if (pulseAnimRef.current !== null) {
      cancelAnimationFrame(pulseAnimRef.current);
      pulseAnimRef.current = null;
    }

    const m = map.current;

    m.addSource('user-location', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [userLocation.lng, userLocation.lat] },
      },
    });

    m.addLayer({ id: 'user-location-pulse', type: 'circle', source: 'user-location',
      paint: { 'circle-radius': 14, 'circle-color': '#3B82F6', 'circle-opacity': 0.25 } });
    m.addLayer({ id: 'user-location-glow', type: 'circle', source: 'user-location',
      paint: { 'circle-radius': 10, 'circle-color': '#3B82F6', 'circle-opacity': 0.2 } });
    m.addLayer({ id: 'user-location-dot', type: 'circle', source: 'user-location',
      paint: { 'circle-radius': 7, 'circle-color': '#3B82F6', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } });

    const animate = () => {
      const t = (Math.sin(Date.now() / 600) + 1) / 2;
      if (m.getLayer('user-location-pulse')) {
        m.setPaintProperty('user-location-pulse', 'circle-radius', 12 + t * 14);
        m.setPaintProperty('user-location-pulse', 'circle-opacity', 0.3 - t * 0.22);
      }
      pulseAnimRef.current = requestAnimationFrame(animate);
    };
    pulseAnimRef.current = requestAnimationFrame(animate);
  };

  const addRouteToMap = (route: Route, isActive: boolean) => {
    if (!map.current) return;
    try {
      const sourceId = `route-${route.id}`;
      if (!route.routePath || !Array.isArray(route.routePath) || route.routePath.length < 2) return;

      const routePath = route.routePath as Point[];
      const geojson = {
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: routePath.map((p: Point) => [p.lng, p.lat]) },
      };

      if (map.current.getSource(sourceId)) {
        if (map.current.getLayer(sourceId)) map.current.removeLayer(sourceId);
        map.current.removeSource(sourceId);
      }

      map.current.addSource(sourceId, { type: 'geojson', data: geojson as any });
      map.current.addLayer({
        id: sourceId, type: 'line', source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': isActive ? '#3b82f6' : '#64748b',
          'line-width': isActive ? 5 : 3,
          'line-opacity': isActive ? 0.8 : 0.6,
        },
      });

      const coords = routePath.map((p: Point) => [p.lng, p.lat] as [number, number]);
      addArrowLayer(map.current, `${sourceId}-arrows`, `${sourceId}-arrows-layer`, coords, 3);
      addFlagLayers(map.current, `${sourceId}-flag`, `${sourceId}-flag-layer`, coords, `${sourceId}-endflag`, `${sourceId}-endflag-layer`);

      map.current.on('click', sourceId, () => onRouteSelect(route));
      map.current.on('mouseenter', sourceId, () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', sourceId, () => { if (map.current) map.current.getCanvas().style.cursor = ''; });

      if (route.startPoint) addMarker(route.startPoint as Point, 'start');
      if (route.endPoint) addMarker(route.endPoint as Point, 'end');
    } catch (err) {
      console.error('Error adding route to map:', err, route);
    }
  };

  const addMarker = (point: Point, type: 'start' | 'end') => {
    if (!map.current) return;
    const el = document.createElement('div');
    el.style.cssText = `width:25px;height:25px;border-radius:50%;background:${type === 'start' ? '#22c55e' : '#ef4444'};border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)`;
    new mapboxgl.Marker(el).setLngLat([point.lng, point.lat]).addTo(map.current!);
  };

  const fitMapToRoute = (route: Route) => {
    if (!map.current || !route.routePath || !Array.isArray(route.routePath) || route.routePath.length < 2) return;
    try {
      const bounds = new mapboxgl.LngLatBounds();
      (route.routePath as Point[]).forEach((p: Point) => {
        if (p && typeof p.lng === 'number') bounds.extend([p.lng, p.lat]);
      });
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 70, maxZoom: 14 });
    } catch (err) { console.error('Error fitting map to route:', err); }
  };

  const fitMapToAllRoutes = (allRoutes: Route[]) => {
    if (!map.current || !allRoutes.length) return;
    try {
      const bounds = new mapboxgl.LngLatBounds();
      let hasPoints = false;
      allRoutes.forEach(route => {
        if (route.routePath && Array.isArray(route.routePath)) {
          (route.routePath as Point[]).forEach((p: Point) => {
            if (p && typeof p.lng === 'number') { bounds.extend([p.lng, p.lat]); hasPoints = true; }
          });
        }
      });
      if (hasPoints && !bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 80, maxZoom: 13 });
    } catch (err) { console.error('Error fitting map to all routes:', err); }
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-4">
          <p className="text-red-500 mb-2">Unable to load map</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/70">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-2" />
            <p className="text-sm text-gray-700">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
