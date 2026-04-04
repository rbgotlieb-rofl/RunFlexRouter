import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import MainLayout from "@/components/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { User, MapPin, Calendar, LogOut, Loader2, Gauge, Footprints } from "lucide-react";
import { Route, RunHistoryEntry } from "@shared/schema";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  const { data: savedRoutes = [], isLoading } = useQuery<Route[]>({
    queryKey: ["saved-routes"],
    queryFn: async () => {
      const res = await authFetch("/api/saved");
      if (!res.ok) throw new Error("Failed to fetch saved routes");
      return res.json();
    },
  });

  const { data: paceData } = useQuery<{ pace: number | null; isPersonalised: boolean }>({
    queryKey: ['/api/runs/pace'],
    queryFn: async () => {
      const res = await authFetch('/api/runs/pace');
      if (!res.ok) return { pace: null, isPersonalised: false };
      return res.json();
    },
  });

  const { data: runHistory = [] } = useQuery<RunHistoryEntry[]>({
    queryKey: ['/api/runs'],
    queryFn: async () => {
      const res = await authFetch('/api/runs');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const totalDistance = savedRoutes.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalRunDistance = runHistory.reduce((sum, r) => sum + (r.distanceKm || 0), 0);

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 max-w-md">
          {/* Profile header */}
          <div className="text-center mb-8 pt-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-xl font-bold">{user?.username?.split("@")[0] || "Runner"}</h1>
            <p className="text-sm text-gray-500">{user?.username}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white border rounded-xl p-4 text-center">
              <Footprints className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : runHistory.length}
              </div>
              <div className="text-xs text-gray-500">Runs Completed</div>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <Calendar className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : `${totalRunDistance.toFixed(1)}km`}
              </div>
              <div className="text-xs text-gray-500">Total Run Distance</div>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <Gauge className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {paceData?.pace ? `${paceData.pace.toFixed(1)}` : '--'}
              </div>
              <div className="text-xs text-gray-500">Avg Pace (min/km)</div>
              {paceData?.isPersonalised && (
                <div className="text-[10px] text-blue-600 font-medium mt-1">Personalising estimates</div>
              )}
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <MapPin className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : savedRoutes.length}
              </div>
              <div className="text-xs text-gray-500">Saved Routes</div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => window.location.href = "/saved"}
            >
              <MapPin className="h-4 w-4 mr-3" />
              View Saved Routes
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
