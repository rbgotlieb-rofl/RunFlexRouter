import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Route, Point } from '@shared/schema';
import { useGeolocation, GeoPosition } from '@/hooks/use-geolocation';
import { useQuery } from '@tanstack/react-query';
import { addArrowLayer, addFlagLayers } from '@/lib/route-arrows';
import {
  Play, Pause, Square, X, Navigation, Clock, Footprints, Gauge, ChevronUp, ChevronDown,
  Locate, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LiveRunTrackerProps {
  route: Route;
  onClose: () => void;
}

interface RunStats {
  distanceKm: number;
  elapsedSeconds: number;
  paceMinPerKm: number | null;
  positions: GeoPosition[];
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPace(minPerKm: number | null): string {
  if (minPerKm === null || !isFinite(minPerKm) || minPerKm <= 0) return '--:--';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function LiveRunTracker({ route, onClose }: LiveRunTrackerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [runState, setRunState] = useState<'ready' | 'running' | 'paused' | 'finished'>('ready');
  const [stats, setStats] = useState<RunStats>({ distanceKm: 0, elapsedSeconds: 0, paceMinPerKm: null, positions: [] });
  const [showStats, setShowStats] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<GeoPosition | null>(null);
  const totalDistRef = useRef<number>(0);
  const positionsRef = useRef<GeoPosition[]>([]);

  const { position, error: geoError, isTracking, isAcquiring, startTracking, stopTracking } = useGeolocation();

  const { data: config } = useQuery<{ mapboxToken: string }>({
    queryKey: ['/api/config'],
  });

  useEffect(() => {
    if (!mapContainerRef.current || !config?.mapboxToken) return;

    mapboxgl.accessToken = config.mapboxToken;

    const routePath = route.routePath as Point[];
    const startCoord: [number, number] = routePath.length > 0
      ? [routePath[0].lng, routePath[0].lat]
      : [-0.1278, 51.5074];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: startCoord,
      zoom: 14,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      if (!routePath || routePath.length < 2) { setMapReady(true); return; }

      const coordinates: [number, number][] = routePath.map(p => [p.lng, p.lat]);

      map.addSource('planned-route', {
        type: 'geojson',
        data: {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates }
        }
      });

      map.addLayer({
        id: 'planned-route-bg',
        type: 'line',
        source: 'planned-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#93c5fd', 'line-width': 6, 'line-opacity': 0.5 }
      });

      map.addLayer({
        id: 'planned-route',
        type: 'line',
        source: 'planned-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [2, 2] }
      });

      addArrowLayer(map, 'route-arrows-src', 'route-arrows-lyr', coordinates, 1.5);
      addFlagLayers(map, 'start-flag-src', 'start-flag-lyr', coordinates, 'end-flag-src', 'end-flag-lyr');

      map.addSource('tracked-path', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
      });

      map.addLayer({
        id: 'tracked-path',
        type: 'line',
        source: 'tracked-path',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#22c55e', 'line-width': 5, 'line-opacity': 0.9 }
      });

      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60 });

      setMapReady(true);
    });

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, [config, route]);

  const createUserMarker = useCallback((lng: number, lat: number) => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([lng, lat]);
      return;
    }

    const el = document.createElement('div');
    el.className = 'user-position-marker';
    el.innerHTML = `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.15);animation:pulse-ring 2s ease-out infinite;"></div>
        <div style="width:24px;height:24px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `@keyframes pulse-ring{0%{transform:scale(1);opacity:0.6;}100%{transform:scale(2.5);opacity:0;}}`;
    if (!document.querySelector('style[data-pulse]')) {
      style.setAttribute('data-pulse', '');
      document.head.appendChild(style);
    }

    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!position || !mapRef.current || !mapReady) return;

    createUserMarker(position.lng, position.lat);

    if (runState === 'running') {
      mapRef.current.easeTo({ center: [position.lng, position.lat], duration: 500 });
    }
  }, [position, mapReady, runState, createUserMarker]);

  useEffect(() => {
    if (runState !== 'running' || !position) return;

    const prev = lastPositionRef.current;
    if (prev) {
      const d = haversineKm(prev.lat, prev.lng, position.lat, position.lng);
      if (d > 0.003 && d < 0.5 && position.accuracy < 50) {
        totalDistRef.current += d;
      }
    }
    lastPositionRef.current = position;

    if (position.accuracy < 100) {
      positionsRef.current.push(position);

      const src = mapRef.current?.getSource('tracked-path') as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: positionsRef.current.map(p => [p.lng, p.lat]) }
        });
      }
    }
  }, [position, runState]);

  useEffect(() => {
    if (runState === 'running') {
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const dist = totalDistRef.current;
        const pace = dist > 0.05 ? (elapsed / 60) / dist : null;
        setStats({
          distanceKm: dist,
          elapsedSeconds: elapsed,
          paceMinPerKm: pace,
          positions: positionsRef.current,
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [runState]);

  const handleStart = () => {
    startTracking();
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    totalDistRef.current = 0;
    positionsRef.current = [];
    lastPositionRef.current = null;
    setStats({ distanceKm: 0, elapsedSeconds: 0, paceMinPerKm: null, positions: [] });
    setRunState('running');
  };

  const handlePause = () => {
    pausedTimeRef.current = Date.now();
    setRunState('paused');
  };

  const handleResume = () => {
    const pausedDuration = Date.now() - pausedTimeRef.current;
    startTimeRef.current += pausedDuration;
    setRunState('running');
  };

  const handleStop = () => {
    stopTracking();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const dist = totalDistRef.current;
    const pace = dist > 0.05 ? (elapsed / 60) / dist : null;
    setStats({ distanceKm: dist, elapsedSeconds: elapsed, paceMinPerKm: pace, positions: positionsRef.current });
    setRunState('finished');
  };

  const handleClose = () => {
    stopTracking();
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  const centerOnUser = () => {
    if (position && mapRef.current) {
      mapRef.current.flyTo({ center: [position.lng, position.lat], zoom: 16, duration: 800 });
    }
  };

  const routeDistanceKm = route.distance || 0;
  const progressPercent = routeDistanceKm > 0 ? Math.min(100, (stats.distanceKm / routeDistanceKm) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="w-full h-full" />

        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <button
            onClick={handleClose}
            className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-colors"
          >
            <X className="h-5 w-5 text-gray-700" />
          </button>

          <div className="pointer-events-auto flex gap-2">
            <button
              onClick={centerOnUser}
              className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-colors"
              title="Center on my location"
            >
              <Locate className="h-5 w-5 text-blue-600" />
            </button>
          </div>
        </div>

        {geoError && (
          <div className="absolute top-16 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{geoError}</p>
          </div>
        )}

        {isAcquiring && runState !== 'finished' && (
          <div className="absolute top-16 left-4 right-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm text-blue-700">Acquiring GPS signal...</p>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        {routeDistanceKm > 0 && runState !== 'ready' && (
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-full bg-green-500 transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full flex items-center justify-center py-1 text-gray-400 hover:text-gray-600 md:hidden"
        >
          {showStats ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        {showStats && (
          <div className="px-4 pt-2 pb-1">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Distance</p>
                <p className="text-2xl font-bold tabular-nums">{stats.distanceKm.toFixed(2)}</p>
                <p className="text-xs text-gray-400">km</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Time</p>
                <p className="text-2xl font-bold tabular-nums">{formatTime(stats.elapsedSeconds)}</p>
                <p className="text-xs text-gray-400">elapsed</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Pace</p>
                <p className="text-2xl font-bold tabular-nums">{formatPace(stats.paceMinPerKm)}</p>
                <p className="text-xs text-gray-400">min/km</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 py-3 flex gap-3 justify-center">
          {runState === 'ready' && (
            <Button
              onClick={handleStart}
              className="flex-1 max-w-xs py-6 text-lg bg-green-600 hover:bg-green-700"
            >
              <Play className="h-5 w-5 mr-2" /> Start Run
            </Button>
          )}

          {runState === 'running' && (
            <>
              <Button
                onClick={handlePause}
                variant="outline"
                className="py-6 px-6"
              >
                <Pause className="h-5 w-5" />
              </Button>
              <Button
                onClick={handleStop}
                className="flex-1 max-w-xs py-6 text-lg bg-red-600 hover:bg-red-700"
              >
                <Square className="h-5 w-5 mr-2" /> Finish Run
              </Button>
            </>
          )}

          {runState === 'paused' && (
            <>
              <Button
                onClick={handleResume}
                className="flex-1 max-w-xs py-6 text-lg bg-green-600 hover:bg-green-700"
              >
                <Play className="h-5 w-5 mr-2" /> Resume
              </Button>
              <Button
                onClick={handleStop}
                variant="outline"
                className="py-6 px-6"
              >
                <Square className="h-5 w-5" />
              </Button>
            </>
          )}

          {runState === 'finished' && (
            <div className="w-full">
              <div className="text-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Run Complete!</h3>
                <p className="text-sm text-gray-500">{route.name.replace(/\s*\(.*\)/, '')}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <Footprints className="h-4 w-4 mx-auto text-green-600 mb-1" />
                  <p className="text-lg font-bold">{stats.distanceKm.toFixed(2)} km</p>
                  <p className="text-xs text-gray-500">Distance</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <Clock className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                  <p className="text-lg font-bold">{formatTime(stats.elapsedSeconds)}</p>
                  <p className="text-xs text-gray-500">Time</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <Gauge className="h-4 w-4 mx-auto text-purple-600 mb-1" />
                  <p className="text-lg font-bold">{formatPace(stats.paceMinPerKm)}</p>
                  <p className="text-xs text-gray-500">Avg Pace</p>
                </div>
              </div>
              <Button onClick={handleClose} className="w-full py-5 text-lg">
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
