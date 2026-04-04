import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, API_BASE } from "@/lib/api";
import MainLayout from "@/components/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { User, MapPin, Calendar, LogOut, Loader2, Link2, Unlink } from "lucide-react";
import { Route } from "@shared/schema";

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

  const totalDistance = savedRoutes.reduce((sum, r) => sum + (r.distance || 0), 0);

  const queryClient = useQueryClient();

  const { data: stravaStatus } = useQuery<{
    configured: boolean;
    connected: boolean;
    athleteName: string | null;
  }>({
    queryKey: ["strava-status"],
    queryFn: async () => {
      const res = await authFetch("/api/strava/status");
      if (!res.ok) throw new Error("Failed to fetch Strava status");
      return res.json();
    },
  });

  const connectStrava = async () => {
    const res = await authFetch("/api/strava/auth");
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  };

  const disconnectStrava = useMutation({
    mutationFn: async () => {
      await authFetch("/api/strava/disconnect", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strava-status"] });
    },
  });

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
              <MapPin className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : savedRoutes.length}
              </div>
              <div className="text-xs text-gray-500">Saved Routes</div>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <Calendar className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : `${totalDistance.toFixed(0)}km`}
              </div>
              <div className="text-xs text-gray-500">Total Distance</div>
            </div>
          </div>

          {/* Connected Services */}
          {stravaStatus?.configured && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Connected Services</h2>
              <div className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FC4C02]/10 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#FC4C02">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Strava</p>
                      {stravaStatus.connected ? (
                        <p className="text-xs text-green-600">Connected{stravaStatus.athleteName ? ` as ${stravaStatus.athleteName}` : ""}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Sync runs to Strava</p>
                      )}
                    </div>
                  </div>
                  {stravaStatus.connected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => disconnectStrava.mutate()}
                      disabled={disconnectStrava.isPending}
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-[#FC4C02] hover:bg-[#e04400] text-white"
                      onClick={connectStrava}
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

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
