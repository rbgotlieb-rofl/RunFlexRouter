import { useState } from "react";
import { Route, Point } from "@shared/schema";
import { getFeatureIcon, getRouteTypeLabel, getRouteTypeColor } from "@/lib/route-utils";
import RouteMapPreview from "@/components/map/RouteMapPreview";
import { Heart, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface RouteCardProps {
  route: Route;
  routeNumber: number;
  onClick: () => void;
  userLocation?: Point | null;
}

export default function RouteCard({ route, routeNumber, onClick, userLocation }: RouteCardProps) {
  const routeTypeColor = getRouteTypeColor(route.routeType || 'any');
  const routeTypeLabel = getRouteTypeLabel(route.routeType || 'any');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger card onClick
    if (isSaving || isSaved) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/routes/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(route),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save route");
      }
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
      toast({ title: "Route saved!", description: "You can find it in your Saved tab." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className="route-card bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer transform hover:-translate-y-1 duration-200"
    >
      <div className="flex-1">
        <div className="flex items-start mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
              {routeNumber}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg">{route.name.replace(/\s*\([0-9.]+km\)/i, '')}</h3>
              <p className="text-sm text-gray-500 truncate">{route.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-block px-2 py-1 ${routeTypeColor} text-xs rounded-full`}>
              {routeTypeLabel}
            </span>
            <button
              onClick={handleSave}
              disabled={isSaving || isSaved}
              className={`p-1 transition-colors ${
                isSaved ? 'text-red-500' : 'text-neutral-400 hover:text-red-500'
              }`}
              title={isSaved ? "Saved" : "Save route"}
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Heart className={`h-5 w-5 ${isSaved ? 'fill-red-500' : ''}`} />
              )}
            </button>
          </div>
        </div>

        <div className="mb-3">
          <RouteMapPreview route={route} height={140} userLocation={userLocation} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-gray-500">Distance</p>
            <p className="font-medium">{route.distance.toFixed(1)} km</p>
          </div>
          <div>
            <p className="text-gray-500">Elevation</p>
            <p className="font-medium">{route.elevationGain} m</p>
          </div>
          <div>
            <p className="text-gray-500">Est. Time</p>
            <p className="font-medium">
              {route.estimatedTime && route.estimatedTime >= 60
                ? `${Math.floor(route.estimatedTime / 60)}h ${route.estimatedTime % 60}m`
                : `${route.estimatedTime || 0}m`}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center text-xs text-gray-500 gap-3">
            {Array.isArray(route.features) && route.features.slice(0, 3).map((feature: string, index: number) => (
              <span key={index} className="flex items-center">
                {getFeatureIcon(feature as any)}
                <span className="ml-1">{feature.replace('_', ' ')}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
