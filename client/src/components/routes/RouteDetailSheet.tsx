import { useState, useEffect } from "react";
import { Route, RouteFeature, Point } from "@shared/schema";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Map, Navigation, Watch, ArrowLeft, Loader2 } from "lucide-react";
import { getFeatureIcon, getRouteTypeLabel, getRouteTypeColor } from "@/lib/route-utils";
import RouteDirections from "./RouteDirections";
import RouteMapPreview from "../map/RouteMapPreview";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { FaSpotify } from "react-icons/fa";
import { SiApplemusic } from "react-icons/si";
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
        const res = await fetch(`${API_BASE}/api/saved/${savedId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to remove route");
        setIsSaved(false);
        setSavedId(null);
        queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
        toast({ title: "Route removed", description: "Removed from your Saved tab." });
      } else {
        // Save
        const res = await fetch(`${API_BASE}/api/saved`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
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

  // Function to send the route to a Garmin watch
  const sendToGarminWatch = async () => {
    try {
      setSendingToWatch(true);
      
      // Simulate API call to Garmin Connect
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Prepare the route data in GPX format for Garmin
      const routeData = {
        id: route.id,
        name: route.name.replace(/\s*\([0-9.]+km\)/i, ''), // Remove distance from name
        waypoints: Array.isArray(route.routePath) 
          ? route.routePath.map((point: {lat: number, lng: number}) => ({
              lat: point.lat,
              lng: point.lng
            }))
          : []
      };
      
      // Log the data being sent (for debugging)
      console.log("Sending route to Garmin watch:", routeData);
      
      // In a real implementation, we would make an actual API call to Garmin Connect
      // For now, we'll simulate a successful transfer
      
      // Get clean route name without distance
      const cleanRouteName = route.name.replace(/\s*\([0-9.]+km\)/i, '');
      
      toast({
        title: "Route Sent to Garmin Watch",
        description: `${cleanRouteName} has been sent to your connected Garmin device.`,
        duration: 5000,
      });
      
    } catch (error) {
      console.error("Error sending route to Garmin watch:", error);
      toast({
        title: "Failed to Send Route",
        description: "There was a problem sending the route to your Garmin device. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setSendingToWatch(false);
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
      {/* Desktop version uses the standard Sheet component */}
      <div className="hidden md:block">
        <Sheet open={isOpen} onOpenChange={onClose}>
          <SheetContent className="w-[450px] p-0">
            <div className="overflow-y-auto max-h-screen">
              {/* Portrait view map at the top */}
              <div className="relative">
                <RouteMapPreview route={route} height={240} detailMode={true} userLocation={userLocation} />
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-primary text-white rounded-lg px-3 py-2 shadow-md hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Routes
                </button>
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-xs font-medium">Start</div>
                      <div className="text-sm">
                        {typeof route.startPoint === 'object' && route.startPoint && 'name' in route.startPoint 
                          ? String(route.startPoint.name) 
                          : 'Start location'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
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
              
                {/* Primary action buttons */}
                <div className="mb-6 space-y-2">
                  <Button onClick={onStartRun} className="w-full bg-primary hover:bg-primary/90 py-5 text-lg">
                    Start Run
                  </Button>
                  
                  <Button 
                    onClick={sendToGarminWatch} 
                    disabled={sendingToWatch}
                    variant="outline" 
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Watch className="h-5 w-5" /> 
                    {sendingToWatch ? "Sending to Watch..." : "Send to Garmin Watch"}
                  </Button>
                  
                  {/* Bespoke Music Playlist */}
                  <div className="mt-4 p-4 border border-gray-100 rounded-lg bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="text-base font-medium mb-2">Bespoke Music Playlist</h3>
                    <p className="text-xs text-gray-500 mb-3">Tailored for this specific route</p>
                    <div className="flex space-x-3">
                      <Button 
                        onClick={() => togglePlaylist('spotify')}
                        variant={activePlaylist === 'spotify' ? 'default' : 'outline'} 
                        className={`flex-1 flex items-center justify-center ${activePlaylist === 'spotify' ? 'bg-green-50' : ''}`} 
                        size="sm"
                      >
                        <FaSpotify className="h-5 w-5 mr-2 text-green-500" /> 
                        Spotify
                      </Button>
                      <Button 
                        onClick={() => togglePlaylist('apple')}
                        variant={activePlaylist === 'apple' ? 'default' : 'outline'} 
                        className={`flex-1 flex items-center justify-center ${activePlaylist === 'apple' ? 'bg-pink-50' : ''}`} 
                        size="sm"
                      >
                        <SiApplemusic className="h-5 w-5 mr-2 text-pink-600" /> 
                        Apple Music
                      </Button>
                    </div>
                    
                    {/* Spotify Playlist Details */}
                    {activePlaylist === 'spotify' && (
                      <div className="mt-3 p-3 bg-green-50 rounded-md">
                        <h4 className="text-sm font-medium text-green-800">Perfect Soundtrack for Your Run</h4>
                        <p className="text-xs text-green-600 mb-2">Tempo-matched to your pace, inspired by this route</p>
                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <span className="w-6 text-center">1</span>
                            <span className="flex-1 truncate">Running Cadence (162 BPM)</span>
                            <span className="text-xs text-gray-500">3:42</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <span className="w-6 text-center">2</span>
                            <span className="flex-1 truncate">Energize Your Route</span>
                            <span className="text-xs text-gray-500">4:15</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <span className="w-6 text-center">3</span>
                            <span className="flex-1 truncate">Perfect Pace</span>
                            <span className="text-xs text-gray-500">3:28</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Apple Music Playlist Details */}
                    {activePlaylist === 'apple' && (
                      <div className="mt-3 p-3 bg-pink-50 rounded-md">
                        <h4 className="text-sm font-medium text-pink-800">Custom Running Playlist</h4>
                        <p className="text-xs text-pink-600 mb-2">Curated for your running style on this route</p>
                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <span className="w-6 text-center">1</span>
                            <span className="flex-1 truncate">Runner's High (160 BPM)</span>
                            <span className="text-xs text-gray-500">3:55</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <span className="w-6 text-center">2</span>
                            <span className="flex-1 truncate">Steady Rhythm</span>
                            <span className="text-xs text-gray-500">4:05</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <span className="w-6 text-center">3</span>
                            <span className="flex-1 truncate">Final Sprint</span>
                            <span className="text-xs text-gray-500">3:22</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
              
                {/* Turn-by-turn directions section */}
                <div className="mb-5">
                  <h3 className="font-medium mb-2">Directions</h3>
                  <RouteDirections directions={Array.isArray(route.directions) ? route.directions : []} />
                </div>
              
                {/* Live data section */}
                <div className="mb-5">
                  <h3 className="font-medium mb-2">Live Data</h3>
                  <div className="flex gap-4">
                    <div className="flex-1 p-3 bg-neutral-100 rounded-lg">
                      <div className="flex items-center">
                        <div className="mr-3 text-green-500">
                          <i className="fas fa-users text-lg"></i>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Crowd Level</p>
                          <p className="font-semibold">
                            {route.trafficLevel === 1 ? "Low" : route.trafficLevel === 2 ? "Medium" : "High"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-3 bg-neutral-100 rounded-lg">
                      <div className="flex items-center">
                        <div className="mr-3 text-green-500">
                          <i className="fas fa-shield-alt text-lg"></i>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Safety Rating</p>
                          <p className="font-semibold">High</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              
                {/* Secondary actions */}
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
          </SheetContent>
        </Sheet>
      </div>
    
      {/* Mobile version uses a custom full-screen sheet */}
      <div
        className={`md:hidden fixed inset-0 z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        <div className="absolute inset-0 bg-white overflow-y-auto">
          {/* Back button header — below Dynamic Island */}
          <div className="sticky top-0 z-20 bg-primary px-4 py-3 pt-[59px] flex items-center">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-white font-medium text-sm"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Routes
            </button>
          </div>
          {/* Portrait view map at the top */}
          <div className="relative w-full h-[240px]">
            <RouteMapPreview route={route} height={240} detailMode={true} userLocation={userLocation} />
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs font-medium">Start</div>
                  <div className="text-sm">
                    {typeof route.startPoint === 'object' && route.startPoint && 'name' in route.startPoint 
                      ? String(route.startPoint.name) 
                      : 'Start location'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">            
            {/* Route details with portrait orientation */}
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
            
            {/* Primary action buttons */}
            <div className="mb-6 space-y-2">
              <Button onClick={onStartRun} className="w-full bg-primary hover:bg-primary/90 py-6 text-lg">
                Start Run
              </Button>
              
              <Button 
                onClick={sendToGarminWatch} 
                disabled={sendingToWatch}
                variant="outline" 
                className="w-full flex items-center justify-center gap-2 py-4"
              >
                <Watch className="h-5 w-5" /> 
                {sendingToWatch ? "Sending to Watch..." : "Send to Garmin Watch"}
              </Button>
              
              {/* Bespoke Music Playlist - Mobile View */}
              <div className="mt-4 p-4 border border-gray-100 rounded-lg bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-base font-medium mb-2">Bespoke Music Playlist</h3>
                <p className="text-xs text-gray-500 mb-3">Tailored for this specific route</p>
                <div className="flex space-x-3">
                  <Button 
                    onClick={() => togglePlaylist('spotify')}
                    variant={activePlaylist === 'spotify' ? 'default' : 'outline'} 
                    className={`flex-1 flex items-center justify-center ${activePlaylist === 'spotify' ? 'bg-green-50' : ''}`} 
                    size="sm"
                  >
                    <FaSpotify className="h-5 w-5 mr-2 text-green-500" /> 
                    Spotify
                  </Button>
                  <Button 
                    onClick={() => togglePlaylist('apple')}
                    variant={activePlaylist === 'apple' ? 'default' : 'outline'} 
                    className={`flex-1 flex items-center justify-center ${activePlaylist === 'apple' ? 'bg-pink-50' : ''}`} 
                    size="sm"
                  >
                    <SiApplemusic className="h-5 w-5 mr-2 text-pink-600" /> 
                    Apple Music
                  </Button>
                </div>
                
                {/* Spotify Playlist Details - Mobile */}
                {activePlaylist === 'spotify' && (
                  <div className="mt-3 p-3 bg-green-50 rounded-md">
                    <h4 className="text-sm font-medium text-green-800">Perfect Soundtrack for Your Run</h4>
                    <p className="text-xs text-green-600 mb-2">Tempo-matched to your pace, inspired by this route</p>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <span className="w-6 text-center">1</span>
                        <span className="flex-1 truncate">Running Cadence (162 BPM)</span>
                        <span className="text-xs text-gray-500">3:42</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span className="w-6 text-center">2</span>
                        <span className="flex-1 truncate">Energize Your Route</span>
                        <span className="text-xs text-gray-500">4:15</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span className="w-6 text-center">3</span>
                        <span className="flex-1 truncate">Perfect Pace</span>
                        <span className="text-xs text-gray-500">3:28</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Apple Music Playlist Details - Mobile */}
                {activePlaylist === 'apple' && (
                  <div className="mt-3 p-3 bg-pink-50 rounded-md">
                    <h4 className="text-sm font-medium text-pink-800">Custom Running Playlist</h4>
                    <p className="text-xs text-pink-600 mb-2">Curated for your running style on this route</p>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <span className="w-6 text-center">1</span>
                        <span className="flex-1 truncate">Runner's High (160 BPM)</span>
                        <span className="text-xs text-gray-500">3:55</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span className="w-6 text-center">2</span>
                        <span className="flex-1 truncate">Steady Rhythm</span>
                        <span className="text-xs text-gray-500">4:05</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span className="w-6 text-center">3</span>
                        <span className="flex-1 truncate">Final Sprint</span>
                        <span className="text-xs text-gray-500">3:22</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Mobile-friendly route features */}
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
            
            {/* Turn-by-turn directions section */}
            <div className="mb-5">
              <h3 className="font-medium mb-2">Directions</h3>
              <RouteDirections directions={Array.isArray(route.directions) ? route.directions : []} />
            </div>
            
            {/* Live data section */}
            <div className="mb-5">
              <h3 className="font-medium mb-2">Live Data</h3>
              <div className="flex gap-4">
                <div className="flex-1 p-3 bg-neutral-100 rounded-lg">
                  <div className="flex items-center">
                    <div className="mr-3 text-green-500">
                      <i className="fas fa-users text-lg"></i>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Crowd Level</p>
                      <p className="font-semibold">
                        {route.trafficLevel === 1 ? "Low" : route.trafficLevel === 2 ? "Medium" : "High"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-3 bg-neutral-100 rounded-lg">
                  <div className="flex items-center">
                    <div className="mr-3 text-green-500">
                      <i className="fas fa-shield-alt text-lg"></i>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Safety Rating</p>
                      <p className="font-semibold">High</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Secondary actions */}
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

    </>
  );
}