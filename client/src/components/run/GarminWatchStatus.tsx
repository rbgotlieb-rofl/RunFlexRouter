/**
 * GarminWatchStatus — displays the Garmin watch connection state and
 * navigation mode toggle during a live run.
 *
 * Shows: connection indicator, device name, battery, navigation mode selector,
 * and route progress as reported by the watch.
 */

import { Watch, Bluetooth, BluetoothOff, Battery, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GarminWatchState, GarminNavigationMode } from '@shared/schema';

interface GarminWatchStatusProps {
  watchState: GarminWatchState;
  onConnect: () => void;
  onDisconnect: () => void;
  onSetNavMode: (mode: GarminNavigationMode) => void;
  isRunning: boolean;
}

const statusLabels: Record<string, string> = {
  disconnected: 'Not Connected',
  connecting: 'Connecting...',
  connected: 'Connected',
  syncing: 'Syncing Course...',
  error: 'Connection Error',
};

const statusColors: Record<string, string> = {
  disconnected: 'text-gray-400',
  connecting: 'text-yellow-500',
  connected: 'text-green-500',
  syncing: 'text-blue-500',
  error: 'text-red-500',
};

export default function GarminWatchStatus({
  watchState,
  onConnect,
  onDisconnect,
  onSetNavMode,
  isRunning,
}: GarminWatchStatusProps) {
  const { connectionStatus, device, navigationMode, isCourseLoaded, watchProgress } = watchState;
  const isConnected = connectionStatus === 'connected' || connectionStatus === 'syncing';

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Watch className={`h-5 w-5 ${statusColors[connectionStatus]}`} />
          <div>
            <p className="text-sm font-medium">
              {device?.deviceName || 'Garmin Watch'}
            </p>
            <p className={`text-xs ${statusColors[connectionStatus]}`}>
              {statusLabels[connectionStatus]}
            </p>
          </div>
        </div>

        {/* Connection toggle */}
        {!isConnected ? (
          <Button
            onClick={onConnect}
            variant="outline"
            size="sm"
            disabled={connectionStatus === 'connecting'}
            className="gap-1.5"
          >
            {connectionStatus === 'connecting' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bluetooth className="h-3.5 w-3.5" />
            )}
            {connectionStatus === 'connecting' ? 'Scanning...' : 'Connect'}
          </Button>
        ) : (
          <Button
            onClick={onDisconnect}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-gray-500"
          >
            <BluetoothOff className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        )}
      </div>

      {/* Device info when connected */}
      {isConnected && device && (
        <>
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
            <span>{device.modelName}</span>
            {device.batteryLevel >= 0 && (
              <span className="flex items-center gap-1">
                <Battery className="h-3 w-3" />
                {device.batteryLevel}%
              </span>
            )}
            {isCourseLoaded && (
              <span className="text-green-600 font-medium">Course Loaded</span>
            )}
          </div>

          {/* Navigation mode selector */}
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-1.5">Navigation alerts on:</p>
            <div className="flex gap-1.5">
              {(['watch', 'phone', 'both'] as GarminNavigationMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onSetNavMode(mode)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                    navigationMode === mode
                      ? 'bg-primary text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {mode === 'watch' ? 'Watch Only' : mode === 'phone' ? 'Phone Only' : 'Both'}
                </button>
              ))}
            </div>
            {navigationMode === 'watch' && (
              <p className="text-xs text-green-600 mt-1">
                Phone alerts suppressed — directions shown on your Garmin
              </p>
            )}
          </div>

          {/* Watch progress during run */}
          {isRunning && isCourseLoaded && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Watch Progress</span>
                <span className="font-medium tabular-nums">{Math.round(watchProgress * 100)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-1000"
                  style={{ width: `${watchProgress * 100}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Error state */}
      {connectionStatus === 'error' && (
        <div className="flex items-start gap-2 mt-2 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>Could not connect to your Garmin watch. Make sure Bluetooth is enabled and your watch is nearby.</p>
        </div>
      )}
    </div>
  );
}
