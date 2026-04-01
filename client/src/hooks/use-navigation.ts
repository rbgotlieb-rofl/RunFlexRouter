import { useState, useEffect, useRef, useCallback } from 'react';
import { Route, DirectionStep, Point } from '@shared/schema';
import { Capacitor } from '@capacitor/core';

interface NavigationState {
  currentStepIndex: number;
  distanceToNextTurn: number | null; // km
  distanceTraveled: number; // km along route
  isOffRoute: boolean;
  offRouteDistance: number; // km from nearest route point
  upcomingAlert: string | null;
  currentInstruction: string;
  nextInstruction: string | null;
  progress: number; // 0-1
}

const RUNNING_PACE_MIN_PER_KM = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Find the nearest point on the route path to a given position.
 * Returns the index of the nearest point and the distance to it.
 */
function findNearestRoutePoint(
  position: { lat: number; lng: number },
  routePath: Point[]
): { index: number; distance: number } {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < routePath.length; i++) {
    const d = haversineKm(position.lat, position.lng, routePath[i].lat, routePath[i].lng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return { index: minIdx, distance: minDist };
}

/**
 * Calculate cumulative distance along the route path up to a given index.
 */
function cumulativeDistance(routePath: Point[], upToIndex: number): number {
  let dist = 0;
  for (let i = 1; i <= Math.min(upToIndex, routePath.length - 1); i++) {
    dist += haversineKm(routePath[i - 1].lat, routePath[i - 1].lng, routePath[i].lat, routePath[i].lng);
  }
  return dist;
}

/**
 * Determine which direction step the user is on, based on cumulative
 * distance traveled along the route.
 */
function findCurrentStep(
  distAlongRoute: number,
  directions: DirectionStep[]
): number {
  let cumDist = 0;
  for (let i = 0; i < directions.length; i++) {
    cumDist += directions[i].distance;
    if (distAlongRoute < cumDist) return i;
  }
  return directions.length - 1;
}

/**
 * Calculate distance remaining until the end of the current step.
 */
function distanceToEndOfStep(
  distAlongRoute: number,
  stepIndex: number,
  directions: DirectionStep[]
): number {
  let cumDist = 0;
  for (let i = 0; i <= stepIndex; i++) {
    cumDist += directions[i].distance;
  }
  return Math.max(0, cumDist - distAlongRoute);
}

/** Speak a navigation instruction using Web Speech API */
function speak(text: string) {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.volume = 1;
      utterance.lang = 'en-GB';
      window.speechSynthesis.speak(utterance);
    }
  } catch {}
}

/** Trigger haptic feedback via Capacitor */
async function haptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
      await Haptics.impact({ style: map[style] });
    }
  } catch {}
}

const OFF_ROUTE_THRESHOLD_KM = 0.1; // 100m
const TURN_ALERT_DISTANCE_KM = 0.1; // Alert at 100m before turn
const TURN_IMMINENT_DISTANCE_KM = 0.03; // 30m = turn now

export function useNavigation(
  route: Route,
  userPosition: { lat: number; lng: number } | null,
  isRunning: boolean
) {
  const [navState, setNavState] = useState<NavigationState>({
    currentStepIndex: 0,
    distanceToNextTurn: null,
    distanceTraveled: 0,
    isOffRoute: false,
    offRouteDistance: 0,
    upcomingAlert: null,
    currentInstruction: '',
    nextInstruction: null,
    progress: 0,
  });

  const lastAlertStepRef = useRef<number>(-1);
  const lastImminentStepRef = useRef<number>(-1);
  const routePath = (route.routePath || []) as Point[];
  const directions = (route.directions || []) as DirectionStep[];
  const totalRouteDistance = route.distance || 0;

  useEffect(() => {
    if (!userPosition || !isRunning || routePath.length < 2 || directions.length === 0) return;

    // Find where the user is relative to the route
    const nearest = findNearestRoutePoint(userPosition, routePath);
    const distAlongRoute = cumulativeDistance(routePath, nearest.index);
    const isOffRoute = nearest.distance > OFF_ROUTE_THRESHOLD_KM;

    // Find current direction step
    const stepIdx = findCurrentStep(distAlongRoute, directions);
    const distToTurn = distanceToEndOfStep(distAlongRoute, stepIdx, directions);
    const currentStep = directions[stepIdx];
    const nextStep = stepIdx + 1 < directions.length ? directions[stepIdx + 1] : null;

    // Generate alerts
    let alert: string | null = null;

    // Off-route alert
    if (isOffRoute) {
      const offMeters = Math.round(nearest.distance * 1000);
      alert = `Off route — ${offMeters}m from path`;
      if (lastAlertStepRef.current !== -2) {
        speak(`You are ${offMeters} meters off route`);
        haptic('heavy');
        lastAlertStepRef.current = -2;
      }
    }
    // Turn approaching alert (100m)
    else if (distToTurn <= TURN_ALERT_DISTANCE_KM && nextStep && lastAlertStepRef.current !== stepIdx) {
      const meters = Math.round(distToTurn * 1000);
      alert = `In ${meters}m: ${nextStep.instruction}`;
      speak(`In ${meters} meters, ${nextStep.instruction}`);
      haptic('medium');
      lastAlertStepRef.current = stepIdx;
    }
    // Turn imminent (30m)
    else if (distToTurn <= TURN_IMMINENT_DISTANCE_KM && nextStep && lastImminentStepRef.current !== stepIdx) {
      alert = nextStep.instruction;
      speak(nextStep.instruction);
      haptic('heavy');
      lastImminentStepRef.current = stepIdx;
    }

    // Reset off-route alert tracking when back on route
    if (!isOffRoute && lastAlertStepRef.current === -2) {
      lastAlertStepRef.current = -1;
      speak('Back on route');
      haptic('light');
    }

    const progress = totalRouteDistance > 0 ? Math.min(1, distAlongRoute / totalRouteDistance) : 0;

    setNavState({
      currentStepIndex: stepIdx,
      distanceToNextTurn: distToTurn,
      distanceTraveled: distAlongRoute,
      isOffRoute,
      offRouteDistance: nearest.distance,
      upcomingAlert: alert,
      currentInstruction: currentStep?.instruction || '',
      nextInstruction: nextStep?.instruction || null,
      progress,
    });
  }, [userPosition, isRunning, routePath, directions, totalRouteDistance]);

  return navState;
}
