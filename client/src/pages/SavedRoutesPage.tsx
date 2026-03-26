import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Route } from "@shared/schema";
import { API_BASE } from "@/lib/api";
import MainLayout from "@/components/layouts/MainLayout";
import RouteDetailSheet from "@/components/routes/RouteDetailSheet";
import { Heart, MapPin, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function SavedRoutesPage() {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const { toast } = useToast();

  const { data: savedRoutes = [], isLoading, refetch } = useQuery<Route[]>({
    queryKey: ["saved-routes"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/saved`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch saved routes");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always", // Always refetch when this page mounts
  });

  const handleDeleteRoute = async (routeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/saved/${routeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete route");
      toast({ title: "Route removed", description: "Route has been removed from your saved routes." });
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 max-w-2xl">
          <h1 className="text-2xl font-bold mb-1">Saved Routes</h1>
          <p className="text-gray-500 text-sm mb-6">Your favourite running routes</p>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : savedRoutes.length === 0 ? (
            <div className="text-center py-20">
              <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-gray-600 mb-2">No saved routes yet</h2>
              <p className="text-sm text-gray-400 mb-4">
                When you find a route you love, tap the Save button to add it here.
              </p>
              <Button variant="outline" onClick={() => window.location.href = "/"}>
                Discover Routes
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedRoutes.map((route) => (
                <div
                  key={route.id}
                  onClick={() => setSelectedRoute(route)}
                  className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">
                        {route.name.replace(/\s*\([0-9.]+km\)/i, '')}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{route.description}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteRoute(route.id, e)}
                      className="ml-3 p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove saved route"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{route.distance.toFixed(1)} km</span>
                    </div>
                    {route.elevationGain != null && (
                      <span className="text-gray-600">{route.elevationGain} m elev.</span>
                    )}
                    {route.estimatedTime != null && (
                      <span className="text-gray-600">
                        {route.estimatedTime >= 60
                          ? `${Math.floor(route.estimatedTime / 60)}h ${route.estimatedTime % 60}m`
                          : `${route.estimatedTime}m`}
                      </span>
                    )}
                  </div>

                  {route.features && Array.isArray(route.features) && route.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {route.features.slice(0, 3).map((feature, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {String(feature).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRoute && (
        <RouteDetailSheet
          route={selectedRoute}
          isOpen={!!selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </MainLayout>
  );
}
