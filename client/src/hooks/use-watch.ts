import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Route, Point, DirectionStep } from '@shared/schema';
import WatchConnectivity from '@/plugins/watch-connectivity';

interface WatchState {
  isSupported: boolean;
  isPaired: boolean;
  isWatchAppInstalled: boolean;
  isReachable: boolean;
  isSending: boolean;
  lastSyncResult: 'idle' | 'success' | 'error';
  errorMessage: string | null;
}

export function useWatch() {
  const [state, setState] = useState<WatchState>({
    isSupported: false,
    isPaired: false,
    isWatchAppInstalled: false,
    isReachable: false,
    isSending: false,
    lastSyncResult: 'idle',
    errorMessage: null,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;

    const checkStatus = async () => {
      try {
        const { supported } = await WatchConnectivity.isSupported();
        if (!supported) return;

        const status = await WatchConnectivity.getWatchStatus();
        setState(prev => ({
          ...prev,
          isSupported: true,
          isPaired: status.isPaired,
          isWatchAppInstalled: status.isWatchAppInstalled,
          isReachable: status.isReachable,
        }));
      } catch {
        // Not on iOS or plugin not available
      }
    };

    checkStatus();
    // Re-check periodically since watch connectivity can change
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const sendRouteToWatch = useCallback(async (route: Route) => {
    setState(prev => ({ ...prev, isSending: true, lastSyncResult: 'idle', errorMessage: null }));

    try {
      const routePath = (route.routePath || []) as Array<{ lat: number; lng: number }>;
      const directions = (route.directions || []) as DirectionStep[];

      await WatchConnectivity.sendRoute({
        route: {
          id: route.id,
          name: route.name,
          distance: route.distance,
          estimatedTime: route.estimatedTime ?? undefined,
          routePath: routePath.map(p => ({ lat: p.lat, lng: p.lng })),
          directions: directions.map(d => ({
            instruction: d.instruction,
            distance: d.distance,
            duration: d.duration,
          })),
        },
      });

      setState(prev => ({ ...prev, isSending: false, lastSyncResult: 'success' }));

      // Reset success state after 3 seconds
      setTimeout(() => {
        setState(prev => prev.lastSyncResult === 'success' ? { ...prev, lastSyncResult: 'idle' } : prev);
      }, 3000);
    } catch (err) {
      setState(prev => ({
        ...prev,
        isSending: false,
        lastSyncResult: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to send route',
      }));
    }
  }, []);

  return {
    ...state,
    sendRouteToWatch,
    canSendToWatch: state.isSupported && state.isPaired && state.isWatchAppInstalled,
  };
}
