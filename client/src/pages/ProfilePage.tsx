import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import MainLayout from "@/components/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { User, MapPin, Calendar, LogOut, Loader2, Watch, CheckCircle, ExternalLink } from "lucide-react";
import { Route } from "@shared/schema";
import { useGarmin } from "@/hooks/use-garmin";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { garminState, linkGarminAccount, unlinkGarminAccount, checkGarminStatus } = useGarmin();
  const { toast } = useToast();

  // Handle Garmin OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const garminParam = params.get('garmin');

    if (garminParam === 'linked') {
      toast({ title: "Garmin Connected", description: "Your Garmin account is now linked. You can send courses directly to your watch." });
      checkGarminStatus();
      // Clean up URL
      window.history.replaceState({}, '', '/profile');
    } else if (garminParam === 'error') {
      const reason = params.get('reason') || 'Unknown error';
      toast({ title: "Garmin Link Failed", description: reason, variant: "destructive" });
      window.history.replaceState({}, '', '/profile');
    }
  }, []);

  const { data: savedRoutes = [], isLoading } = useQuery<Route[]>({
    queryKey: ["saved-routes"],
    queryFn: async () => {
      const res = await authFetch("/api/saved");
      if (!res.ok) throw new Error("Failed to fetch saved routes");
      return res.json();
    },
  });

  const totalDistance = savedRoutes.reduce((sum, r) => sum + (r.distance || 0), 0);

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

          {/* Connected Devices */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Connected Devices</h2>
            <div className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${garminState.isLinked ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Watch className={`h-5 w-5 ${garminState.isLinked ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Garmin Connect</p>
                    {garminState.isCheckingStatus ? (
                      <p className="text-xs text-gray-400">Checking...</p>
                    ) : garminState.isLinked ? (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Connected
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Not connected</p>
                    )}
                  </div>
                </div>

                {garminState.isLinked ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={unlinkGarminAccount}
                  >
                    Unlink
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={linkGarminAccount}
                    disabled={garminState.isCheckingStatus}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Link
                  </Button>
                )}
              </div>

              {garminState.isLinked && (
                <p className="text-xs text-gray-500 mt-3 pl-12">
                  Courses you send will appear on your Garmin watch automatically.
                </p>
              )}

              {!garminState.isLinked && !garminState.isCheckingStatus && (
                <p className="text-xs text-gray-500 mt-3 pl-12">
                  Link your Garmin account to send routes directly to your watch — just like Strava.
                </p>
              )}
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
