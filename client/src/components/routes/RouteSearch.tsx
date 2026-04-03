import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeftRight, Navigation, RotateCcw, Clock, Layers } from "lucide-react";
import LocationAutocomplete from "./LocationAutocomplete";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RouteMode } from "@shared/schema";

interface RouteSearchProps {
  startPoint: string;
  endPoint: string;
  routeMode: RouteMode;
  targetDuration?: number;
  targetDistance?: number;
  distanceUnit?: 'km' | 'miles';
  targetType?: 'duration' | 'distance';
  onStartPointChange: (value: string) => void;
  onEndPointChange: (value: string) => void;
  onRouteModeChange: (value: RouteMode) => void;
  onTargetDurationChange: (value: number) => void;
  onTargetDistanceChange: (value: number) => void;
  onDistanceUnitChange: (value: 'km' | 'miles') => void;
  onTargetTypeChange: (value: 'duration' | 'distance') => void;
  onSearch: () => void;
}

export default function RouteSearch({
  startPoint,
  endPoint,
  routeMode = 'a_to_b',
  targetDuration = 30,
  targetDistance = 5,
  distanceUnit = 'km',
  targetType = 'duration',
  onStartPointChange,
  onEndPointChange,
  onRouteModeChange,
  onTargetDurationChange,
  onTargetDistanceChange,
  onDistanceUnitChange,
  onTargetTypeChange,
  onSearch
}: RouteSearchProps) {
  
  // Function to swap start and end points
  const handleSwapPoints = () => {
    const temp = startPoint;
    onStartPointChange(endPoint);
    onEndPointChange(temp);
  };

  const [durationInput, setDurationInput] = useState(String(targetDuration));
  const [distanceInput, setDistanceInput] = useState(String(targetDistance));

  useEffect(() => { setDurationInput(String(targetDuration)); }, [targetDuration]);
  useEffect(() => { setDistanceInput(String(targetDistance)); }, [targetDistance]);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationInput(e.target.value);
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onTargetDurationChange(value);
    }
  };

  const handleDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDistanceInput(e.target.value);
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      onTargetDistanceChange(value);
    }
  };

  return (
    <div className="bg-white shadow-sm z-10">
      <div className="container mx-auto p-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex-1">
            {/* Location inputs */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 md:max-w-sm">
                <LocationAutocomplete
                  value={startPoint}
                  onChange={onStartPointChange}
                  placeholder="Starting location"
                  showLocationOption={true} // Allow "Use my current location" for starting point
                />
              </div>
              
              {/* Only show destination for A to B routes */}
              {routeMode === 'a_to_b' || routeMode === 'all' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="text-gray-400">
                      <ArrowRight size={16} />
                    </div>
                    <button 
                      onClick={handleSwapPoints}
                      className="text-primary hover:text-primary-dark transition-colors duration-200"
                      aria-label="Swap start and end points"
                      title="Swap locations"
                    >
                      <ArrowLeftRight size={16} />
                    </button>
                  </div>
                  
                  <div className="flex-1 md:max-w-sm">
                    <LocationAutocomplete
                      value={endPoint}
                      onChange={onEndPointChange}
                      placeholder="Post code or landmark"
                      showLocationOption={false} // Don't show "Use my current location" for destination
                    />
                  </div>
                </>
              ) : (
                /* For Loop and Duration routes, show that they return to start */
                <div className="flex items-center text-sm text-gray-500 ml-2">
                  <RotateCcw size={16} className="mr-1" />
                  Returns to starting point
                </div>
              )}
            </div>
            
            {/* Route mode selector */}
            <div className="flex flex-wrap gap-3 items-center mt-2">
              <div className="mr-2">
                <Label htmlFor="route-mode" className="mr-2 text-sm font-medium">Route Type:</Label>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant={routeMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onRouteModeChange('all')}
                  className="flex items-center gap-1"
                >
                  <Layers className="h-4 w-4" />
                  <span>All</span>
                </Button>
                
                <Button 
                  variant={routeMode === 'a_to_b' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onRouteModeChange('a_to_b')}
                  className="flex items-center gap-1"
                >
                  <Navigation className="h-4 w-4" />
                  <span>A to B</span>
                </Button>
                
                <Button 
                  variant={routeMode === 'loop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onRouteModeChange('loop')}
                  className="flex items-center gap-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Loop</span>
                </Button>
                
                <Button 
                  variant={routeMode === 'duration' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onRouteModeChange('duration')}
                  className="flex items-center gap-1"
                >
                  <Clock className="h-4 w-4" />
                  <span>Duration</span>
                </Button>
              </div>
              
              {/* Additional options for Loop and Duration routes */}
              {(routeMode === 'loop' || routeMode === 'duration') && (
                <div className="flex flex-col gap-3 ml-4">
                  {/* Target Type Selection */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium whitespace-nowrap">Target by:</Label>
                    <RadioGroup 
                      value={targetType} 
                      onValueChange={onTargetTypeChange}
                      className="flex flex-row gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="duration" id="target-duration" />
                        <Label htmlFor="target-duration" className="text-sm">Duration</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="distance" id="target-distance" />
                        <Label htmlFor="target-distance" className="text-sm">Distance</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  {/* Target Duration - Preset buttons */}
                  {targetType === 'duration' && (
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium">Duration:</Label>
                      <div className="flex flex-wrap gap-2">
                        {[15, 30, 45, 60, 90, 120].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              setDurationInput(String(mins));
                              onTargetDurationChange(mins);
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              Number(durationInput) === mins
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {mins < 60 ? `${mins}min` : `${mins / 60}h${mins % 60 ? ` ${mins % 60}m` : ''}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Target Distance - Preset buttons */}
                  {targetType === 'distance' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Distance:</Label>
                        <Select value={distanceUnit} onValueChange={onDistanceUnitChange}>
                          <SelectTrigger className="w-16 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="km">km</SelectItem>
                            <SelectItem value="miles">mi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(distanceUnit === 'km' ? [3, 5, 10, 15, 21, 42] : [2, 3, 5, 8, 13, 26]).map((dist) => (
                          <button
                            key={dist}
                            type="button"
                            onClick={() => {
                              setDistanceInput(String(dist));
                              onTargetDistanceChange(dist);
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              Number(distanceInput) === dist
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {dist}{distanceUnit === 'km' ? 'km' : 'mi'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Button 
              onClick={onSearch}
              className="bg-primary hover:bg-primary/90 text-white w-full md:w-auto"
            >
              Generate Routes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
