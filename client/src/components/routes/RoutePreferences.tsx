import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SlidersHorizontal, X } from "lucide-react";
import { RouteFilter, RouteType } from "@shared/schema";

interface RoutePreferencesProps {
  filters: Partial<RouteFilter>;
  onFilterChange: (filters: Partial<RouteFilter>) => void;
  onUpdateRoutes: () => void;
}

export default function RoutePreferences({ 
  filters, 
  onFilterChange,
  onUpdateRoutes
}: RoutePreferencesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [distance, setDistance] = useState<number>(7.5);
  const [scenery, setScenery] = useState<number>(3);
  const [traffic, setTraffic] = useState<number>(1);
  const [routeType, setRouteType] = useState<RouteType>("all");
  
  useEffect(() => {
    if (filters.maxDistance) setDistance(filters.maxDistance);
    if (filters.sceneryRating) setScenery(filters.sceneryRating);
    if (filters.trafficLevel) setTraffic(filters.trafficLevel);
    if (filters.routeType) setRouteType(filters.routeType as RouteType);
  }, [filters]);
  
  const handleDistanceChange = (value: number[]) => {
    setDistance(value[0]);
    onFilterChange({ maxDistance: value[0] });
  };
  
  const handleSceneryChange = (value: number[]) => {
    setScenery(value[0]);
    onFilterChange({ sceneryRating: value[0] });
  };
  
  const handleTrafficChange = (value: number[]) => {
    setTraffic(value[0]);
    onFilterChange({ trafficLevel: value[0] });
  };
  
  const handleRouteTypeChange = (value: string) => {
    setRouteType(value as RouteType);
    onFilterChange({ routeType: value });
  };

  const handleUpdate = () => {
    onUpdateRoutes();
    setIsOpen(false);
  };
  
  const getSceneryLabel = (value: number) => {
    switch (value) {
      case 1: return "Low";
      case 2: return "Medium";
      case 3: return "High";
      default: return "Medium";
    }
  };
  
  const getTrafficLabel = (value: number) => {
    switch (value) {
      case 1: return "Low";
      case 2: return "Medium";
      case 3: return "High";
      default: return "Medium";
    }
  };
  
  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute top-4 right-4 z-10 bg-white shadow-md rounded-full p-2.5 border border-gray-200 hover:bg-gray-50 active:scale-95 transition-transform"
          aria-label="Open route preferences"
        >
          <SlidersHorizontal className="h-5 w-5 text-gray-700" />
        </button>
      )}

      {/* Preferences panel */}
      {isOpen && (
        <div className="absolute top-4 right-4 z-10 w-80 bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Route Preferences</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close preferences"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Distance</label>
                <span className="text-sm text-primary">{distance} km</span>
              </div>
              <Slider 
                value={[distance]} 
                min={1} 
                max={20} 
                step={0.5} 
                onValueChange={handleDistanceChange} 
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 km</span>
                <span>20 km</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Scenery</label>
                <span className="text-sm text-primary">{getSceneryLabel(scenery)}</span>
              </div>
              <Slider 
                value={[scenery]} 
                min={1} 
                max={3}
                step={1}
                onValueChange={handleSceneryChange} 
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Traffic Level</label>
                <span className="text-sm text-primary">{getTrafficLabel(traffic)}</span>
              </div>
              <Slider 
                value={[traffic]} 
                min={1} 
                max={3}
                step={1}
                onValueChange={handleTrafficChange} 
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Route Type</label>
                <span className="text-xs text-primary">
                  {routeType === 'all' && 'Mix of A to B, Loop & Duration routes'}
                </span>
              </div>
              <div className="w-full">
                <ToggleGroup type="single" value={routeType} onValueChange={handleRouteTypeChange}>
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <ToggleGroupItem value="all" className="text-xs w-full font-semibold">
                      All
                    </ToggleGroupItem>
                    <ToggleGroupItem value="any" className="text-xs w-full">
                      Any
                    </ToggleGroupItem>
                    <ToggleGroupItem value="urban" className="text-xs w-full">
                      Urban
                    </ToggleGroupItem>
                    <ToggleGroupItem value="park" className="text-xs w-full">
                      Parks
                    </ToggleGroupItem>
                    <ToggleGroupItem value="waterfront" className="text-xs w-full">
                      Waterfront
                    </ToggleGroupItem>
                  </div>
                </ToggleGroup>
              </div>
            </div>
            
            <Button 
              onClick={handleUpdate}
              className="w-full bg-primary hover:bg-primary/90"
            >
              Update Routes
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
