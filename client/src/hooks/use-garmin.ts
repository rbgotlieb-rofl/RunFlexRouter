/**
 * Garmin Watch Integration Hook
 *
 * Sends courses to a Garmin watch via Garmin Connect by:
 * 1. Generating a GPX course file (server-side)
 * 2. Saving it to device storage (Capacitor Filesystem)
 * 3. Opening the native share sheet so the user can send it to Garmin Connect
 *
 * Garmin Connect then syncs the course to the paired watch, which uses its
 * built-in course navigation to show the map, turn cues, and progress.
 *
 * Also manages the "navigate on watch" toggle that suppresses phone-side
 * voice/haptic alerts when the runner is using their Garmin for directions.
 */

import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { GarminNavigationMode } from '@shared/schema';
import { authFetch } from '@/lib/api';

export interface GarminState {
  /** Whether a course has been sent to Garmin Connect in this session */
  courseSentToGarmin: boolean;
  /** Whether the GPX is currently being generated/shared */
  isSending: boolean;
  /** Navigation mode: watch = suppress phone alerts */
  navigationMode: GarminNavigationMode;
  /** Error message if sharing failed */
  error: string | null;
}

export function useGarmin() {
  const [garminState, setGarminState] = useState<GarminState>({
    courseSentToGarmin: false,
    isSending: false,
    navigationMode: 'phone',
    error: null,
  });

  /**
   * Generate a GPX course file and share it to Garmin Connect.
   *
   * On native (Capacitor): saves the file and opens the share sheet,
   * where the user picks Garmin Connect to import the course.
   *
   * On web: downloads the GPX file, which the user can then drag into
   * Garmin Connect web or import via the mobile app.
   */
  const sendToGarmin = useCallback(async (route: {
    id?: number;
    name: string;
    distance: number;
    routePath: any;
    directions: any;
  }): Promise<boolean> => {
    setGarminState((s) => ({ ...s, isSending: true, error: null }));

    try {
      // 1. Fetch GPX from server
      const gpxResponse = await authFetch('/api/garmin/course/gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: route.name,
          distance: route.distance,
          routePath: route.routePath,
          directions: route.directions,
        }),
      });

      if (!gpxResponse.ok) {
        throw new Error('Failed to generate GPX course');
      }

      const gpxContent = await gpxResponse.text();
      const cleanName = route.name.replace(/\s*\([0-9.]+km\)/i, '').replace(/[^a-zA-Z0-9_ -]/g, '');
      const fileName = `${cleanName}.gpx`;

      if (Capacitor.isNativePlatform()) {
        // Native: save to cache dir and share via native share sheet
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        // Write GPX file to cache directory
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: gpxContent,
          directory: Directory.Cache,
        });

        // Share the file — opens the native share sheet
        // User picks "Garmin Connect" to import as a course
        await Share.share({
          title: `${cleanName} — RunFlex Course`,
          text: `Import this course into Garmin Connect to navigate on your watch`,
          url: writeResult.uri,
          dialogTitle: 'Send course to Garmin Connect',
        });
      } else {
        // Web fallback: download the GPX file
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setGarminState((s) => ({
        ...s,
        isSending: false,
        courseSentToGarmin: true,
      }));
      return true;
    } catch (err: any) {
      // Share cancelled by user is not an error
      if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        setGarminState((s) => ({ ...s, isSending: false }));
        return false;
      }

      console.error('Garmin share error:', err);
      setGarminState((s) => ({
        ...s,
        isSending: false,
        error: err.message || 'Failed to send course to Garmin',
      }));
      return false;
    }
  }, []);

  /**
   * Set the navigation mode.
   * 'watch'  = phone alerts suppressed (user is navigating on Garmin)
   * 'phone'  = normal phone navigation
   * 'both'   = alerts on both devices
   */
  const setNavigationMode = useCallback((mode: GarminNavigationMode) => {
    setGarminState((s) => ({ ...s, navigationMode: mode }));
  }, []);

  /** Whether phone navigation alerts should be suppressed. */
  const shouldSuppressPhoneNav =
    garminState.navigationMode === 'watch' && garminState.courseSentToGarmin;

  return {
    garminState,
    sendToGarmin,
    setNavigationMode,
    shouldSuppressPhoneNav,
  };
}
