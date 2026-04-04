/**
 * Garmin Watch Communication Hook
 *
 * Manages the connection to a Garmin watch via Connect IQ BLE protocol.
 * Handles course transfer, real-time navigation sync, and determines
 * whether phone-side navigation should be active or suppressed.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GarminConnectionStatus,
  GarminDeviceInfo,
  GarminNavigationMode,
  GarminWatchState,
  GarminCourseData,
  Point,
} from '@shared/schema';

// Connect IQ BLE communication constants
const GARMIN_CIQ_SERVICE_UUID = '6a4e3200-667b-11e3-949a-0800200c9a66';
const GARMIN_CIQ_CHAR_UUID = '6a4e3201-667b-11e3-949a-0800200c9a66';
const SCAN_TIMEOUT_MS = 15000;
const POSITION_UPDATE_INTERVAL_MS = 2000;

/**
 * Message types for phone↔watch BLE protocol.
 * The watch and phone exchange these JSON payloads over BLE.
 */
type GarminMessageType =
  | 'COURSE_TRANSFER'      // Phone → Watch: send course data
  | 'NAV_UPDATE'           // Phone → Watch: updated navigation state
  | 'POSITION_UPDATE'      // Watch → Phone: watch GPS position
  | 'PROGRESS_UPDATE'      // Watch → Phone: current progress %
  | 'NAV_MODE_ACK'         // Watch → Phone: confirms navigation started
  | 'COURSE_ACK'           // Watch → Phone: confirms course received
  | 'DISCONNECT';          // Either direction: clean disconnect

interface GarminMessage {
  type: GarminMessageType;
  payload: any;
  timestamp: number;
}

/**
 * Check if Web Bluetooth API is available (required for Connect IQ BLE).
 */
function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function useGarmin() {
  const [watchState, setWatchState] = useState<GarminWatchState>({
    connectionStatus: 'disconnected',
    device: null,
    navigationMode: 'phone',
    isCourseLoaded: false,
    watchProgress: 0,
    watchPosition: null,
  });

  const bleDeviceRef = useRef<BluetoothDevice | null>(null);
  const bleCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const positionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const courseDataRef = useRef<GarminCourseData | null>(null);

  /**
   * Scan for and connect to a Garmin Connect IQ device via BLE.
   */
  const connectToWatch = useCallback(async (): Promise<boolean> => {
    if (!isBluetoothAvailable()) {
      console.warn('Web Bluetooth not available');
      setWatchState((s) => ({ ...s, connectionStatus: 'error' }));
      return false;
    }

    setWatchState((s) => ({ ...s, connectionStatus: 'connecting' }));

    try {
      // Request a BLE device with the Connect IQ service
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [GARMIN_CIQ_SERVICE_UUID] },
          { namePrefix: 'Garmin' },
          { namePrefix: 'Forerunner' },
          { namePrefix: 'fenix' },
          { namePrefix: 'Venu' },
          { namePrefix: 'Enduro' },
        ],
        optionalServices: [GARMIN_CIQ_SERVICE_UUID],
      });

      if (!device) {
        setWatchState((s) => ({ ...s, connectionStatus: 'disconnected' }));
        return false;
      }

      bleDeviceRef.current = device;

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', handleDisconnect);

      // Connect to GATT server
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(GARMIN_CIQ_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(GARMIN_CIQ_CHAR_UUID);
      bleCharRef.current = characteristic;

      // Start notifications for watch→phone messages
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleWatchMessage);

      // Build device info from the BLE device name
      const deviceInfo: GarminDeviceInfo = {
        deviceId: device.id || 'unknown',
        deviceName: device.name || 'Garmin Watch',
        modelName: extractModelName(device.name || ''),
        firmwareVersion: 'N/A',
        batteryLevel: -1,
      };

      setWatchState((s) => ({
        ...s,
        connectionStatus: 'connected',
        device: deviceInfo,
      }));

      return true;
    } catch (err: any) {
      // User cancelled the picker or connection failed
      console.error('Garmin BLE connection error:', err);
      setWatchState((s) => ({
        ...s,
        connectionStatus: err.name === 'NotFoundError' ? 'disconnected' : 'error',
      }));
      return false;
    }
  }, []);

  /**
   * Disconnect from the Garmin watch.
   */
  const disconnectWatch = useCallback(() => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }

    if (bleCharRef.current) {
      try { bleCharRef.current.removeEventListener('characteristicvaluechanged', handleWatchMessage); } catch {}
      bleCharRef.current = null;
    }

    if (bleDeviceRef.current?.gatt?.connected) {
      try { bleDeviceRef.current.gatt.disconnect(); } catch {}
    }
    bleDeviceRef.current = null;
    courseDataRef.current = null;

    setWatchState({
      connectionStatus: 'disconnected',
      device: null,
      navigationMode: 'phone',
      isCourseLoaded: false,
      watchProgress: 0,
      watchPosition: null,
    });
  }, []);

  /**
   * Send a course to the connected Garmin watch.
   */
  const sendCourseToWatch = useCallback(async (courseData: GarminCourseData): Promise<boolean> => {
    if (!bleCharRef.current || watchState.connectionStatus !== 'connected') {
      return false;
    }

    setWatchState((s) => ({ ...s, connectionStatus: 'syncing' }));
    courseDataRef.current = courseData;

    try {
      const message: GarminMessage = {
        type: 'COURSE_TRANSFER',
        payload: courseData,
        timestamp: Date.now(),
      };

      // Chunk the data for BLE transfer (max 512 bytes per write)
      const jsonStr = JSON.stringify(message);
      const chunks = chunkString(jsonStr, 480);

      for (let i = 0; i < chunks.length; i++) {
        const header = new Uint8Array([i, chunks.length]); // chunk index, total chunks
        const body = new TextEncoder().encode(chunks[i]);
        const packet = new Uint8Array(header.length + body.length);
        packet.set(header);
        packet.set(body, header.length);

        await bleCharRef.current.writeValue(packet);
      }

      setWatchState((s) => ({
        ...s,
        connectionStatus: 'connected',
        isCourseLoaded: true,
      }));

      return true;
    } catch (err) {
      console.error('Error sending course to watch:', err);
      setWatchState((s) => ({ ...s, connectionStatus: 'error' }));
      return false;
    }
  }, [watchState.connectionStatus]);

  /**
   * Switch navigation mode. When set to 'watch', phone-side voice/haptic
   * alerts are suppressed to avoid duplicate instructions.
   */
  const setNavigationMode = useCallback((mode: GarminNavigationMode) => {
    setWatchState((s) => ({ ...s, navigationMode: mode }));

    // Notify the watch of the mode change
    if (bleCharRef.current && watchState.connectionStatus === 'connected') {
      const message: GarminMessage = {
        type: 'NAV_UPDATE',
        payload: { navigationMode: mode },
        timestamp: Date.now(),
      };
      const encoded = new TextEncoder().encode(JSON.stringify(message));
      bleCharRef.current.writeValue(encoded).catch(() => {});
    }
  }, [watchState.connectionStatus]);

  /**
   * Send a navigation state update to the watch (position, progress, next turn).
   */
  const sendNavUpdate = useCallback(
    async (navData: {
      progress: number;
      currentInstruction: string;
      distanceToNextTurn: number | null;
      nextInstruction: string | null;
      isOffRoute: boolean;
    }) => {
      if (
        !bleCharRef.current ||
        watchState.connectionStatus !== 'connected' ||
        watchState.navigationMode === 'phone'
      ) {
        return;
      }

      try {
        const message: GarminMessage = {
          type: 'NAV_UPDATE',
          payload: navData,
          timestamp: Date.now(),
        };
        const encoded = new TextEncoder().encode(JSON.stringify(message));
        await bleCharRef.current.writeValue(encoded);
      } catch {}
    },
    [watchState.connectionStatus, watchState.navigationMode]
  );

  /** Handle incoming BLE messages from the watch. */
  const handleWatchMessage = useCallback((event: Event) => {
    try {
      const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
      const value = target.value;
      if (!value) return;

      const decoder = new TextDecoder();
      const json = decoder.decode(value.buffer);
      const message: GarminMessage = JSON.parse(json);

      switch (message.type) {
        case 'POSITION_UPDATE':
          setWatchState((s) => ({
            ...s,
            watchPosition: message.payload.position as Point,
          }));
          break;
        case 'PROGRESS_UPDATE':
          setWatchState((s) => ({
            ...s,
            watchProgress: message.payload.progress as number,
          }));
          break;
        case 'COURSE_ACK':
          setWatchState((s) => ({ ...s, isCourseLoaded: true }));
          break;
        case 'NAV_MODE_ACK':
          // Watch confirmed it's handling navigation
          setWatchState((s) => ({ ...s, navigationMode: 'watch' }));
          break;
        case 'DISCONNECT':
          disconnectWatch();
          break;
      }
    } catch (err) {
      console.error('Error parsing watch message:', err);
    }
  }, [disconnectWatch]);

  /** Handle BLE disconnection event. */
  const handleDisconnect = useCallback(() => {
    setWatchState((s) => ({
      ...s,
      connectionStatus: 'disconnected',
      device: null,
      navigationMode: 'phone',
      isCourseLoaded: false,
    }));
    bleCharRef.current = null;
  }, []);

  /** Whether phone navigation alerts should be suppressed. */
  const shouldSuppressPhoneNav = watchState.navigationMode === 'watch' && watchState.isCourseLoaded;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWatch();
    };
  }, [disconnectWatch]);

  return {
    watchState,
    connectToWatch,
    disconnectWatch,
    sendCourseToWatch,
    setNavigationMode,
    sendNavUpdate,
    shouldSuppressPhoneNav,
    isBluetoothAvailable: isBluetoothAvailable(),
  };
}

/** Extract a friendly model name from a BLE device name. */
function extractModelName(name: string): string {
  const models = [
    'Forerunner 965', 'Forerunner 955', 'Forerunner 265', 'Forerunner 255',
    'Forerunner 165', 'Forerunner 55', 'fenix 8', 'fenix 7', 'fenix 6',
    'Enduro 3', 'Enduro 2', 'Venu 3', 'Venu 2',
  ];
  for (const model of models) {
    if (name.toLowerCase().includes(model.toLowerCase())) return model;
  }
  return name;
}

/** Split a string into chunks of the given size. */
function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}
