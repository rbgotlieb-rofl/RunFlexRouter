/**
 * Garmin Connect Integration Hook
 *
 * Manages the connection to a user's Garmin Connect account and
 * pushes courses directly via the Garmin Courses API — the same
 * approach Strava uses for "Send to Device".
 *
 * Flow:
 * 1. User links their Garmin account once (OAuth in Profile page)
 * 2. Tap "Send to Garmin Watch" → course is pushed server→Garmin API
 * 3. Garmin Connect syncs the course to the paired watch automatically
 * 4. User starts a Course activity on the watch for navigation
 */

import { useState, useEffect, useCallback } from 'react';
import { GarminNavigationMode } from '@shared/schema';
import { authFetch } from '@/lib/api';

export interface GarminState {
  /** Whether the user has linked their Garmin account */
  isLinked: boolean;
  /** Whether we're currently checking the link status */
  isCheckingStatus: boolean;
  /** Whether a course is currently being pushed */
  isPushing: boolean;
  /** Whether a course was successfully sent in this session */
  courseSent: boolean;
  /** Navigation mode: watch = suppress phone alerts */
  navigationMode: GarminNavigationMode;
  /** Error message if something failed */
  error: string | null;
}

export function useGarmin() {
  const [garminState, setGarminState] = useState<GarminState>({
    isLinked: false,
    isCheckingStatus: true,
    isPushing: false,
    courseSent: false,
    navigationMode: 'phone',
    error: null,
  });

  // Check Garmin link status on mount
  useEffect(() => {
    checkGarminStatus();
  }, []);

  const checkGarminStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/garmin/status');
      if (res.ok) {
        const data = await res.json();
        setGarminState((s) => ({ ...s, isLinked: data.linked, isCheckingStatus: false }));
      } else {
        setGarminState((s) => ({ ...s, isCheckingStatus: false }));
      }
    } catch {
      setGarminState((s) => ({ ...s, isCheckingStatus: false }));
    }
  }, []);

  /**
   * Start the Garmin OAuth flow.
   * Gets the authorization URL from the server and redirects the user.
   */
  const linkGarminAccount = useCallback(async () => {
    try {
      const res = await authFetch('/api/garmin/auth');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to start Garmin link');
      }
      const { url } = await res.json();
      // Redirect to Garmin OAuth page
      window.location.href = url;
    } catch (err: any) {
      setGarminState((s) => ({ ...s, error: err.message }));
    }
  }, []);

  /**
   * Unlink the user's Garmin account.
   */
  const unlinkGarminAccount = useCallback(async () => {
    try {
      const res = await authFetch('/api/garmin/link', { method: 'DELETE' });
      if (res.ok) {
        setGarminState((s) => ({
          ...s,
          isLinked: false,
          courseSent: false,
        }));
      }
    } catch {}
  }, []);

  /**
   * Push a course directly to the user's Garmin Connect account.
   * Garmin Connect syncs it to their paired watch automatically.
   */
  const sendToGarmin = useCallback(async (route: {
    name: string;
    description?: string;
    distance: number;
    routePath: any;
    directions: any;
  }): Promise<boolean> => {
    setGarminState((s) => ({ ...s, isPushing: true, error: null }));

    try {
      const res = await authFetch('/api/garmin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: route.name,
          description: route.description,
          distance: route.distance,
          routePath: route.routePath,
          directions: route.directions,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to send course to Garmin');
      }

      setGarminState((s) => ({
        ...s,
        isPushing: false,
        courseSent: true,
      }));
      return true;
    } catch (err: any) {
      setGarminState((s) => ({
        ...s,
        isPushing: false,
        error: err.message,
      }));
      return false;
    }
  }, []);

  /**
   * Set the navigation mode.
   * 'watch'  = phone alerts suppressed (user navigating on Garmin)
   * 'phone'  = normal phone navigation
   * 'both'   = alerts on both
   */
  const setNavigationMode = useCallback((mode: GarminNavigationMode) => {
    setGarminState((s) => ({ ...s, navigationMode: mode }));
  }, []);

  /** Whether phone navigation alerts should be suppressed. */
  const shouldSuppressPhoneNav =
    garminState.navigationMode === 'watch' && garminState.courseSent;

  return {
    garminState,
    linkGarminAccount,
    unlinkGarminAccount,
    sendToGarmin,
    setNavigationMode,
    shouldSuppressPhoneNav,
    checkGarminStatus,
  };
}
