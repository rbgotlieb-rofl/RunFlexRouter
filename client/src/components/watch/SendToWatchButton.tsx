import { Route } from '@shared/schema';
import { useWatch } from '@/hooks/use-watch';
import { Watch, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SendToWatchButtonProps {
  route: Route;
  variant?: 'default' | 'compact';
}

export default function SendToWatchButton({ route, variant = 'default' }: SendToWatchButtonProps) {
  const { canSendToWatch, isSending, lastSyncResult, errorMessage, sendRouteToWatch, isReachable } = useWatch();

  // Don't render if Watch isn't available
  if (!canSendToWatch) return null;

  const handleSend = () => {
    sendRouteToWatch(route);
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={handleSend}
        disabled={isSending}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
        title={isReachable ? 'Send to Apple Watch' : 'Send to Apple Watch (will sync when connected)'}
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : lastSyncResult === 'success' ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <Watch className="h-4 w-4" />
        )}
        <span>
          {isSending ? 'Sending...' : lastSyncResult === 'success' ? 'Sent!' : 'Send to Watch'}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSend}
        disabled={isSending}
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
      >
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending to Watch...
          </>
        ) : lastSyncResult === 'success' ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-600" />
            Sent to Watch!
          </>
        ) : (
          <>
            <Watch className="h-4 w-4" />
            Send to Watch
          </>
        )}
      </Button>

      {lastSyncResult === 'error' && errorMessage && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!isReachable && lastSyncResult === 'idle' && (
        <p className="text-xs text-gray-400 text-center">
          Watch not reachable — route will sync when connected
        </p>
      )}
    </div>
  );
}
