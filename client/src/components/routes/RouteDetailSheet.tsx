import { useState, useEffect } from "react";
import { Route, RouteFeature, Point } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Watch, ArrowLeft, Loader2, Download, Bluetooth } from "lucide-react";
import { getFeatureIcon, getRouteTypeColor } from "@/lib/route-utils";
import RouteDirections from "./RouteDirections";
import RouteMapPreview from "../map/RouteMapPreview";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { useGarmin } from "@/hooks/use-garmin";
interface RouteDetailSheetProps {
  route: Route;
  isOpen: boolean;
  onClose: () => void;
  onStartRun?: () => void;
  userLocation?: Point | null;
}

export default function RouteDetailSheet({ route, isOpen, onClose, onStartRun, userLocation }: RouteDetailSheetProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [sendingToWatch, setSendingToWatch] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState<'spotify' | 'apple' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSaveRoute = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (isSaved && savedId) {
        // Unsave
        const res = await authFetch(`/api/saved/${savedId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove route");
        setIsSaved(false);
        setSavedId(null);
        queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
        toast({ title: "Route removed", description: "Removed from your Saved tab." });
      } else {
        // Save
        const res = await authFetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(route),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Failed to save route");
        }
        const saved = await res.json();
        setIsSaved(true);
        setSavedId(saved.id);
        queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
        toast({ title: "Route saved!", description: "You can find it in your Saved tab." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Function to toggle music playlist provider
  const togglePlaylist = (provider: 'spotify' | 'apple') => {
    if (activePlaylist === provider) {
      setActivePlaylist(null);
    } else {
      setActivePlaylist(provider);
      
      // Show a toast message when a playlist is selected
      toast({
        title: `${provider === 'spotify' ? 'Spotify' : 'Apple Music'} Playlist`,
        description: `Opening the perfect playlist for your ${route.name.replace(/\s*\([0-9.]+km\)/i, '')} route`,
        duration: 3000,
      });
    }
  };

  // Garmin watch connection
  const {
    watchState,
    connectToWatch,
    disconnectWatch,
    sendCourseToWatch,
    isBluetoothAvailable: hasBluetooth,
  } = useGarmin();

  // Send course to watch via BLE after building it on the server
  const sendToGarminWatch = async () => {
    try {
      setSendingToWatch(true);

      // If not connected, connect first
      if (watchState.connectionStatus !== 'connected') {
        const connected = await connectToWatch();
        if (!connected) {
          toast({
            title: "Watch Not Found",
            description: "Could not find a Garmin watch. Make sure Bluetooth is on and your watch is nearby.",
            variant: "destructive",
          });
          return;
        }
      }

      // Build course data via server (handles path simplification + turn point extraction)
      const res = await authFetch("/api/garmin/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: route.name,
          distance: route.distance,
          routePath: route.routePath,
          directions: route.directions,
        }),
      });

      if (!res.ok) throw new Error("Failed to build course data");

      const courseData = await res.json();
      courseData.routeId = route.id;

      // Send to watch via BLE
      const sent = await sendCourseToWatch(courseData);
      if (!sent) throw new Error("BLE transfer failed");

      const cleanName = route.name.replace(/\s*\([0-9.]+km\)/i, '');
      toast({
        title: "Course Sent to Watch",
        description: `${cleanName} is loaded on your ${watchState.device?.deviceName || 'Garmin'}. Navigation will start when you begin your run.`,
        duration: 5000,
      });
    } catch (error: any) {
      console.error("Error sending route to Garmin watch:", error);
      toast({
        title: "Failed to Send Route",
        description: error.message || "There was a problem sending the route to your Garmin device.",
        variant: "destructive",
      });
    } finally {
      setSendingToWatch(false);
    }
  };

  // Download GPX file for manual Garmin import
  const downloadGpx = () => {
    const routePath = Array.isArray(route.routePath) ? route.routePath : [];
    const directions = Array.isArray(route.directions) ? route.directions : [];

    // If route is saved, use server endpoint; otherwise build client-side link
    if (route.id) {
      window.open(`/api/routes/${route.id}/garmin/gpx`, '_blank');
    } else {
      toast({ title: "Save Route First", description: "Save this route to download the GPX file." });
    }
  };
  
  if (!isMounted) {
    return null;
  }
  
  const featureLabels = {
    scenic: "Scenic",
    low_traffic: "Low Traffic",
    well_lit: "Well Lit",
    waterfront: "Waterfront",
    open_view: "Open View",
    medium_traffic: "Medium Traffic",
    urban: "Urban",
    cultural_sites: "Cultural Sites",
    high_traffic: "High Traffic",
    morning_run: "Morning Run"
  };
  
  const routeTypeColor = getRouteTypeColor(route.routeType || 'any', true);
  
  return (
    <>
      {/* Full-screen route detail overlay */}
      {isOpen && (
      <div className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-white">
        {/* Fixed header — always visible above Dynamic Island */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary" style={{ paddingTop: '59px' }}>
          <div className="px-4 py-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-white font-medium text-sm"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Routes
            </button>
          </div>
        </div>

        {/* Scrollable content below fixed header (59px + ~44px header = 103px) */}
        <div className="absolute top-0 left-0 right-0 bottom-0 overflow-y-auto overflow-x-hidden" style={{ paddingTop: '103px' }}>
          {/* Map */}
          <div className="w-full h-[240px]">
            <RouteMapPreview route={route} height={240} detailMode={true} userLocation={userLocation} />
          </div>

          <div className="px-4 pt-4 pb-8">
            {/* Route details */}
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{route.name.replace(/\s*\([0-9.]+km\)/i, '')}</h2>
              <p className="text-gray-500">{route.description}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-neutral-100 rounded-lg">
                <p className="text-xs text-gray-500">Distance</p>
                <p className="font-semibold">{route.distance.toFixed(1)} km</p>
              </div>
              <div className="text-center p-3 bg-neutral-100 rounded-lg">
                <p className="text-xs text-gray-500">Elevation</p>
                <p className="font-semibold">{route.elevationGain} m</p>
              </div>
              <div className="text-center p-3 bg-neutral-100 rounded-lg">
                <p className="text-xs text-gray-500">Est. Time</p>
                <p className="font-semibold">
                  {route.estimatedTime && route.estimatedTime >= 60
                    ? `${Math.floor(route.estimatedTime / 60)}h ${route.estimatedTime % 60}m`
                    : `${route.estimatedTime || 0}m`}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mb-6 space-y-2">
              <Button onClick={onStartRun} className="w-full bg-primary hover:bg-primary/90 py-6 text-lg">
                Start Run
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={sendToGarminWatch}
                  disabled={sendingToWatch}
                  variant="outline"
                  className="flex-1 flex items-center justify-center gap-2 py-4"
                >
                  {sendingToWatch ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bluetooth className="h-4 w-4" />
                  )}
                  {sendingToWatch
                    ? "Sending..."
                    : watchState.isCourseLoaded
                    ? "Sent to Watch"
                    : "Send to Garmin"}
                </Button>
                <Button
                  onClick={downloadGpx}
                  variant="outline"
                  className="flex items-center justify-center gap-2 py-4 px-4"
                  title="Download GPX for Garmin"
                >
                  <Download className="h-4 w-4" />
                  GPX
                </Button>
              </div>

              {watchState.connectionStatus === 'connected' && watchState.device && (
                <div className="flex items-center gap-2 text-xs text-green-600 px-1">
                  <Watch className="h-3.5 w-3.5" />
                  <span>Connected to {watchState.device.deviceName}</span>
                  {watchState.isCourseLoaded && <span className="font-medium">— Course loaded</span>}
                </div>
              )}
            </div>

            {/* Route features */}
            <div className="mb-5">
              <h3 className="font-medium mb-2">Route Features</h3>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(route.features) ? route.features : []).map((feature: RouteFeature, index: number) => (
                  <span key={index} className={`inline-block px-3 py-1 ${getRouteTypeColor(feature as any, true)} text-xs rounded-full mb-1`}>
                    {getFeatureIcon(feature)} {featureLabels[feature as keyof typeof featureLabels]}
                  </span>
                ))}
              </div>
            </div>

            {/* Directions */}
            <div className="mb-5">
              <h3 className="font-medium mb-2">Directions</h3>
              <RouteDirections directions={Array.isArray(route.directions) ? route.directions : []} />
            </div>

            {/* Save / Share */}
            <div className="flex gap-3 mb-4">
              <Button variant="outline" className="flex-1" onClick={handleSaveRoute} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Heart className={`h-4 w-4 mr-2 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />}
                {isSaved ? "Saved" : "Save"}
              </Button>
              <Button variant="outline" className="flex-1">
                <Share2 className="h-4 w-4 mr-2" /> Share
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}

    </>
  );
}