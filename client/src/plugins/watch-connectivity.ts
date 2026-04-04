import { registerPlugin } from '@capacitor/core';

export interface WatchConnectivityPlugin {
  /** Check if Watch Connectivity is available on this device. */
  isSupported(): Promise<{ supported: boolean }>;

  /** Get the current Apple Watch connection status. */
  getWatchStatus(): Promise<{
    isPaired: boolean;
    isWatchAppInstalled: boolean;
    isReachable: boolean;
  }>;

  /** Send a route to the paired Apple Watch. */
  sendRoute(options: { route: WatchRoutePayload }): Promise<{ success: boolean }>;
}

export interface WatchRoutePayload {
  id: number;
  name: string;
  distance: number;
  estimatedTime?: number;
  routePath: Array<{ lat: number; lng: number }>;
  directions: Array<{
    instruction: string;
    distance: number;
    duration: number;
  }>;
}

const WatchConnectivity = registerPlugin<WatchConnectivityPlugin>('WatchConnectivity');

export default WatchConnectivity;
