/**
 * COROS Training Hub Integration Hook
 *
 * Manages the connection to a user's COROS account and
 * pushes courses via the COROS Open Platform API.
 *
 * Flow (mirrors the Garmin integration):
 * 1. User links their COROS account once (OAuth in Profile page)
 * 2. Tap "Send to COROS Watch" → course is pushed server→COROS API
 * 3. COROS Training Hub syncs the course to the paired watch automatically
 * 4. User starts a Course/Navigation activity on the watch for turn-by-turn nav
 */

import { useState, useEffect, useCallback } from 'react';
import { CorosNavigationMode } from '@shared/schema';
import { authFetch } from '@/lib/api';

export interface CorosState {
  /** Whether the user has linked their COROS account */
  isLinked: boolean;
  /** Whether we're currently checking the link status */
  isCheckingStatus: boolean;
  /** Whether a course is currently being pushed */
  isPushing: boolean;
  /** Whether a course was successfully sent in this session */
  courseSent: boolean;
  /** Navigation mode: watch = suppress phone alerts */
  navigationMode: CorosNavigationMode;
  /** Error message if something failed */
  error: string | null;
}

export function useCoros() {
  const [corosState, setCorosState] = useState<CorosState>({
    isLinked: false,
    isCheckingStatus: true,
    isPushing: false,
    courseSent: false,
    navigationMode: 'phone',
    error: null,
  });

  // Check COROS link status on mount
  useEffect(() => {
    checkCorosStatus();
  }, []);

  const checkCorosStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/coros/status');
      if (res.ok) {
        const data = await res.json();
        setCorosState((s) => ({ ...s, isLinked: data.linked, isCheckingStatus: false }));
      } else {
        setCorosState((s) => ({ ...s, isCheckingStatus: false }));
      }
    } catch {
      setCorosState((s) => ({ ...s, isCheckingStatus: false }));
    }
  }, []);

  /**
   * Start the COROS OAuth flow.
   * Gets the authorization URL from the server and redirects the user.
   */
  const linkCorosAccount = useCallback(async () => {
    try {
      const res = await authFetch('/api/coros/auth');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to start COROS link');
      }
      const { url } = await res.json();
      // Redirect to COROS OAuth page
      window.location.href = url;
    } catch (err: any) {
      setCorosState((s) => ({ ...s, error: err.message }));
    }
  }, []);

  /**
   * Unlink the user's COROS account.
   */
  const unlinkCorosAccount = useCallback(async () => {
    try {
      const res = await authFetch('/api/coros/link', { method: 'DELETE' });
      if (res.ok) {
        setCorosState((s) => ({
          ...s,
          isLinked: false,
          courseSent: false,
        }));
      }
    } catch {}
  }, []);

  /**
   * Push a course directly to the user's COROS Training Hub account.
   * COROS syncs it to their paired watch automatically.
   */
  const sendToCoros = useCallback(async (route: {
    name: string;
    description?: string;
    distance: number;
    routePath: any;
    directions: any;
  }): Promise<boolean> => {
    setCorosState((s) => ({ ...s, isPushing: true, error: null }));

    try {
      const res = await authFetch('/api/coros/push', {
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
        throw new Error(data.message || 'Failed to send course to COROS');
      }

      setCorosState((s) => ({
        ...s,
        isPushing: false,
        courseSent: true,
      }));
      return true;
    } catch (err: any) {
      setCorosState((s) => ({
        ...s,
        isPushing: false,
        error: err.message,
      }));
      return false;
    }
  }, []);

  /**
   * Set the navigation mode.
   * 'watch'  = phone alerts suppressed (user navigating on COROS watch)
   * 'phone'  = normal phone navigation
   * 'both'   = alerts on both
   */
  const setNavigationMode = useCallback((mode: CorosNavigationMode) => {
    setCorosState((s) => ({ ...s, navigationMode: mode }));
  }, []);

  /** Whether phone navigation alerts should be suppressed. */
  const shouldSuppressPhoneNav =
    corosState.navigationMode === 'watch' && corosState.courseSent;

  return {
    corosState,
    linkCorosAccount,
    unlinkCorosAccount,
    sendToCoros,
    setNavigationMode,
    shouldSuppressPhoneNav,
    checkCorosStatus,
  };
}
