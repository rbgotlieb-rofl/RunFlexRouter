import { useState, useCallback, useRef, useEffect } from 'react';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
  heading: number | null;
}

interface UseGeolocationReturn {
  position: GeoPosition | null;
  error: string | null;
  isTracking: boolean;
  isAcquiring: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  getCurrentPosition: () => Promise<GeoPosition>;
  latestPosition: GeoPosition | null;
}

const isNative = Capacitor.isNativePlatform();

function toGeoPosition(pos: GeolocationPosition): GeoPosition {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
    speed: pos.coords.speed,
    heading: pos.coords.heading,
  };
}

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser settings.';
    case err.POSITION_UNAVAILABLE:
      return 'Unable to determine your location. Please check your GPS signal.';
    case err.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'An unknown error occurred while getting your location.';
  }
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const watchIdRef = useRef<string | number | null>(null);
  const refineWatchRef = useRef<number | null>(null);
  const refineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPositionRef = useRef<GeoPosition | null>(null);

  const cleanupRefine = useCallback(() => {
    if (refineWatchRef.current !== null) {
      navigator.geolocation.clearWatch(refineWatchRef.current);
      refineWatchRef.current = null;
    }
    if (refineTimerRef.current !== null) {
      clearTimeout(refineTimerRef.current);
      refineTimerRef.current = null;
    }
  }, []);

  const startBackgroundRefinement = useCallback((currentAccuracy: number) => {
    cleanupRefine();
    if (currentAccuracy <= 50 || isNative) return; // Native GPS is already high-accuracy

    refineWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const gp = toGeoPosition(pos);
        const current = latestPositionRef.current;
        if (!current || gp.accuracy < current.accuracy) {
          latestPositionRef.current = gp;
          setPosition(gp);
        }
        if (gp.accuracy <= 50) {
          cleanupRefine();
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    refineTimerRef.current = setTimeout(() => {
      cleanupRefine();
    }, 20000);
  }, [cleanupRefine]);

  const getCurrentPosition = useCallback(async (): Promise<GeoPosition> => {
    setIsAcquiring(true);
    setError(null);
    cleanupRefine();

    try {
      if (isNative) {
        // Use Capacitor Geolocation for native iOS/Android
        const perm = await CapGeolocation.requestPermissions();
        if (perm.location === 'denied') {
          const msg = 'Location permission denied. Please enable it in Settings.';
          setError(msg);
          setIsAcquiring(false);
          throw new Error(msg);
        }

        const pos = await CapGeolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });

        const gp: GeoPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        };

        latestPositionRef.current = gp;
        setPosition(gp);
        setIsAcquiring(false);
        setError(null);
        return gp;
      }

      // Web browser fallback
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          const msg = 'Geolocation is not supported by your browser.';
          setError(msg);
          setIsAcquiring(false);
          reject(new Error(msg));
          return;
        }

        let resolved = false;

        const finish = (gp: GeoPosition) => {
          if (resolved) return;
          resolved = true;
          latestPositionRef.current = gp;
          setPosition(gp);
          setIsAcquiring(false);
          setError(null);
          resolve(gp);
          startBackgroundRefinement(gp.accuracy);
        };

        const fail = (msg: string, err?: any) => {
          if (resolved) return;
          resolved = true;
          setError(msg);
          setIsAcquiring(false);
          reject(err || new Error(msg));
        };

        navigator.geolocation.getCurrentPosition(
          (pos) => finish(toGeoPosition(pos)),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              fail(geoErrorMessage(err), err);
              return;
            }
            // Retry with lower accuracy
            navigator.geolocation.getCurrentPosition(
              (pos) => finish(toGeoPosition(pos)),
              (err2) => {
                if (err2.code === err2.PERMISSION_DENIED) {
                  fail(geoErrorMessage(err2), err2);
                  return;
                }
                fail(
                  'Could not determine your location. Try opening this page in a new browser tab or on your phone.',
                  err2
                );
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
            );
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      });
    } catch (err: any) {
      setIsAcquiring(false);
      if (!error) setError(err.message || 'Failed to get location');
      throw err;
    }
  }, [cleanupRefine, startBackgroundRefinement, error]);

  const startTracking = useCallback(() => {
    setIsTracking(true);
    setIsAcquiring(true);
    setError(null);

    if (isNative) {
      // Capacitor watch
      CapGeolocation.watchPosition(
        { enableHighAccuracy: true },
        (pos, err) => {
          if (err) {
            setError(err.message || 'Tracking error');
            return;
          }
          if (pos) {
            const gp: GeoPosition = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
            };
            latestPositionRef.current = gp;
            setPosition(gp);
            setIsAcquiring(false);
            setError(null);
          }
        }
      ).then((id) => {
        watchIdRef.current = id;
      });
      return;
    }

    // Browser fallback
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const gp = toGeoPosition(pos);
        latestPositionRef.current = gp;
        setPosition(gp);
        setIsAcquiring(false);
        setError(null);
      },
      (err) => {
        setError(geoErrorMessage(err));
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (isNative && typeof watchIdRef.current === 'string') {
      CapGeolocation.clearWatch({ id: watchIdRef.current });
    } else if (typeof watchIdRef.current === 'number') {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setIsTracking(false);
    setIsAcquiring(false);
  }, []);

  useEffect(() => {
    return () => {
      if (isNative && typeof watchIdRef.current === 'string') {
        CapGeolocation.clearWatch({ id: watchIdRef.current });
      } else if (typeof watchIdRef.current === 'number') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (refineWatchRef.current !== null) {
        navigator.geolocation.clearWatch(refineWatchRef.current);
      }
      if (refineTimerRef.current !== null) {
        clearTimeout(refineTimerRef.current);
      }
    };
  }, []);

  return {
    position,
    error,
    isTracking,
    isAcquiring,
    startTracking,
    stopTracking,
    getCurrentPosition,
    latestPosition: position,
  };
}
