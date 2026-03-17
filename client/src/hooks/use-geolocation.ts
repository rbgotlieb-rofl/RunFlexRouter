import { useState, useCallback, useRef, useEffect } from 'react';

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
  const watchIdRef = useRef<number | null>(null);
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

    if (currentAccuracy <= 50) return;

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

  const getCurrentPosition = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Geolocation is not supported by your browser.';
        setError(msg);
        reject(new Error(msg));
        return;
      }

      setIsAcquiring(true);
      setError(null);
      cleanupRefine();

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
  }, [cleanupRefine, startBackgroundRefinement]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    if (watchIdRef.current !== null) return;

    setIsTracking(true);
    setIsAcquiring(true);
    setError(null);

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
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setIsAcquiring(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
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
