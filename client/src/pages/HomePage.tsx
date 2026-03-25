import { useState, useEffect, useMemo, useRef } from "react";
import MainLayout from "@/components/layouts/MainLayout";
import RouteSearch from "@/components/routes/RouteSearch";
import RouteCard from "@/components/routes/RouteCard";
import RoutePreferences from "@/components/routes/RoutePreferences";
import RouteDetailSheet from "@/components/routes/RouteDetailSheet";
import MapView from "@/components/map/MapView";
import LiveRunTracker from "@/components/run/LiveRunTracker";
import { useRoutes } from "@/hooks/use-routes";
import { Route, RouteFilter, RouteMode, Point } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, MapPin } from "lucide-react";

export default function HomePage() {
  // Route search state
  const [startPoint, setStartPoint] = useState<string>("Current Location");
  const [endPoint, setEndPoint] = useState<string>("");
  const [routeMode, setRouteMode] = useState<RouteMode>("all"); // Set default to "all"
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [targetDistance, setTargetDistance] = useState<number>(5);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'miles'>('km');
  const [targetType, setTargetType] = useState<'duration' | 'distance'>('duration');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [filters, setFilters] = useState<Partial<RouteFilter>>({
    routeMode: "all",
    routeType: "all",
    targetType: "duration",
    targetDistance: 5,
    targetDuration: 30,
  });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const userLocation = useMemo((): Point | null => {
    const match = startPoint.match(/Your Location \(([-\d.]+),([-\d.]+)\)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    return null;
  }, [startPoint]);

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Query routes based on start/end points and filters, but don't auto-fetch
  const { 
    data: routes, 
    isLoading, 
    isError,
    error,
    refetch 
  } = useRoutes(startPoint, endPoint, filters);

  const [searchTrigger, setSearchTrigger] = useState(0);

  useEffect(() => {
    if (searchTrigger > 0) {
      refetch();
    }
  }, [searchTrigger, filters]);

  const handleSearch = () => {
    const updatedFilters: Partial<RouteFilter> = {
      ...filters,
      routeMode,
      targetType,
      targetDistance,
      targetDuration,
      distanceUnit,
    };

    setFilters(updatedFilters);
    setSearchTrigger(prev => prev + 1);
    // On mobile, switch to list view so the user sees the results
    if (windowWidth < 768) {
      setViewMode("list");
    }
  };

  const handleRouteSelect = (route: Route) => {
    setSelectedRoute(route);
    setShowSheet(true);
  };

  const handleFilterChange = (newFilters: Partial<RouteFilter>) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters
    }));
  };

  const handleCloseSheet = () => {
    setShowSheet(false);
  };

  const handleStartRun = () => {
    setShowSheet(false);
    setShowTracker(true);
  };

  const handleCloseTracker = () => {
    setShowTracker(false);
  };

  const toggleViewMode = (mode: "list" | "map") => {
    setViewMode(mode);
  };

  // Auto-switch to map view on mobile the FIRST time userLocation is set
  const hasAutoSwitchedToMap = useRef(false);
  // Once the map has been shown, keep it rendered even if location clears temporarily
  const hasShownMap = useRef(false);
  useEffect(() => {
    if (userLocation && windowWidth < 768 && !hasAutoSwitchedToMap.current) {
      hasAutoSwitchedToMap.current = true;
      setViewMode("map");
    }
  }, [userLocation]);

  if (userLocation || (routes && routes.length > 0)) {
    hasShownMap.current = true;
  }

  return (<>
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Route Search Bar */}
        <RouteSearch
          startPoint={startPoint}
          endPoint={endPoint}
          routeMode={routeMode as RouteMode}
          targetDuration={targetDuration}
          targetDistance={targetDistance}
          distanceUnit={distanceUnit}
          targetType={targetType}
          userProximity={userLocation}
          onStartPointChange={setStartPoint}
          onEndPointChange={setEndPoint}
          onRouteModeChange={(mode) => {
            setRouteMode(mode);
            // Also update filters when mode changes
            handleFilterChange({ 
              routeMode: mode,
              targetDuration: mode === 'duration' || mode === 'loop' ? (targetType === 'duration' ? targetDuration : undefined) : undefined,
              targetDistance: mode === 'duration' || mode === 'loop' ? (targetType === 'distance' ? targetDistance : undefined) : undefined,
              distanceUnit: mode === 'duration' || mode === 'loop' ? distanceUnit : undefined
            });
            
            // For loop mode with same start/end, we set end to start
            if (mode === 'loop' && endPoint !== startPoint) {
              setEndPoint(startPoint);
            }
          }}
          onTargetDurationChange={(duration) => {
            setTargetDuration(duration);
            if ((routeMode === 'duration' || routeMode === 'loop') && targetType === 'duration') {
              handleFilterChange({ targetDuration: duration });
            }
          }}
          onTargetDistanceChange={(distance) => {
            setTargetDistance(distance);
            if ((routeMode === 'duration' || routeMode === 'loop') && targetType === 'distance') {
              handleFilterChange({ targetDistance: distance });
            }
          }}
          onDistanceUnitChange={(unit) => {
            setDistanceUnit(unit);
            if ((routeMode === 'duration' || routeMode === 'loop') && targetType === 'distance') {
              handleFilterChange({ distanceUnit: unit });
            }
          }}
          onTargetTypeChange={(type) => {
            setTargetType(type);
            if (routeMode === 'duration' || routeMode === 'loop') {
              // Clear the filters and set the appropriate one
              handleFilterChange({ 
                targetDuration: type === 'duration' ? targetDuration : undefined,
                targetDistance: type === 'distance' ? targetDistance : undefined,
                distanceUnit: type === 'distance' ? distanceUnit : undefined
              });
            }
          }}
          onSearch={handleSearch}
        />

        {/* Mobile View Toggle */}
        <div className="bg-white border-t border-b border-gray-200 py-2 md:hidden">
          <div className="container mx-auto flex">
            <div className="w-1/2 text-center">
              <button 
                onClick={() => toggleViewMode("list")}
                className={`py-1 px-4 font-medium ${viewMode === "list" ? "text-primary border-b-2 border-primary" : "text-neutral-700"}`}
              >
                <i className="fas fa-list mr-1"></i> List
              </button>
            </div>
            <div className="w-1/2 text-center">
              <button 
                onClick={() => toggleViewMode("map")}
                className={`py-1 px-4 font-medium ${viewMode === "map" ? "text-primary border-b-2 border-primary" : "text-neutral-700"}`}
              >
                <i className="fas fa-map mr-1"></i> Map
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Routes List */}
          <div 
            id="routes-list" 
            className={`
              flex-1 md:w-1/3 md:border-r border-gray-200 overflow-y-auto
              ${viewMode === "list" ? "block" : "hidden md:block"}
            `}
          >
            {/* Routes */}
            <div className="p-4 space-y-4">
              {isLoading ? (
                // Loading skeletons
                Array(3).fill(0).map((_, index) => (
                  <div key={`skeleton-${index}`} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between mb-2">
                      <Skeleton className="h-6 w-36" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="h-32 w-full mb-3" />
                    <div className="grid grid-cols-3 gap-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                ))
              ) : isError ? (
                // Error state - show specific error messages from backend
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error?.message?.includes('starting point is required') 
                      ? 'Please enter a starting point to generate routes'
                      : error?.message?.includes('Destination is required')
                      ? 'Please enter a destination for A to B routes' 
                      : 'There was an error loading routes. Please try again.'}
                  </AlertDescription>
                </Alert>
              ) : routes?.length === 0 ? (
                // Empty state
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <h3 className="text-lg font-medium text-gray-900">No Routes Found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Try changing your search criteria or filters
                  </p>
                </div>
              ) : (
                // Routes list
                routes?.map((route, index) => (
                  <RouteCard 
                    key={route.id} 
                    route={route} 
                    routeNumber={index + 1}
                    onClick={() => handleRouteSelect(route)}
                    userLocation={userLocation}
                  />
                ))
              )}
            </div>
          </div>

          {/* Map View */}
          <div 
            id="map-view" 
            className={`
              flex-1 md:w-2/3 relative
              ${viewMode === "map" || (viewMode === "list" && windowWidth >= 768) ? "block" : "hidden"}
            `}
          >
            {/* Map will be embedded in the component */}
            <div className="h-[calc(100vh-4rem)] w-full">
              {(routes && routes.length > 0) || userLocation || hasShownMap.current ? (
                <div className="relative w-full h-full">
                  <MapView 
                    routes={routes || []}
                    selectedRoute={selectedRoute}
                    onRouteSelect={handleRouteSelect}
                    userLocation={userLocation}
                  />
                  {userLocation && (!routes || routes.length === 0) && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                      <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-700 border border-gray-200">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        Location found — tap Search to find routes
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <h3 className="text-lg font-medium text-gray-900">No Routes Loaded</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Search for routes to see them on the map
                    </p>
                  </div>
                </div>
              )}

              {/* Route preferences panel */}
              <RoutePreferences 
                filters={filters} 
                onFilterChange={handleFilterChange} 
                onUpdateRoutes={handleSearch} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Route Detail Sheet */}
      {selectedRoute && (
        <RouteDetailSheet 
          route={selectedRoute} 
          isOpen={showSheet} 
          onClose={handleCloseSheet}
          onStartRun={handleStartRun}
          userLocation={userLocation}
        />
      )}
    </MainLayout>

    {showTracker && selectedRoute && (
      <LiveRunTracker route={selectedRoute} onClose={handleCloseTracker} />
    )}
  </>);
}
