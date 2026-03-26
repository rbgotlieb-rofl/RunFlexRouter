import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Crosshair, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { API_BASE } from '@/lib/api';
import { Point } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/use-geolocation';

interface LocationSuggestion {
  name: string;
  point: Point;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showLocationOption?: boolean;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder,
  showLocationOption = true
}: LocationAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isLocating, setIsLocating] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);
  const { toast } = useToast();
  const { getCurrentPosition, position: latestPosition } = useGeolocation();

  const isCurrentLocationValue = (val: string) =>
    val.startsWith("Your Location (") || val === "Current Location";

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['/api/locations', inputValue, latestPosition?.lng, latestPosition?.lat],
    queryFn: async () => {
      const params = new URLSearchParams({ q: inputValue });
      if (latestPosition) {
        params.set('proximity', `${latestPosition.lng},${latestPosition.lat}`);
      }
      const response = await fetch(`${API_BASE}/api/locations?${params}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    enabled: inputValue.length > 2 && !isCurrentLocationValue(inputValue),
    staleTime: 10000,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setUsingCurrentLocation(false);
    setLocationLabel(null);
    setIsOpen(true);
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    justSelectedRef.current = true;
    setInputValue(suggestion.name);
    onChange(suggestion.name);
    setUsingCurrentLocation(false);
    setLocationLabel(null);
    setIsOpen(false);
    setTimeout(() => { justSelectedRef.current = false; }, 300);
  };

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser does not support geolocation. Please enter a postcode instead.",
        variant: "destructive"
      });
      return;
    }

    setIsLocating(true);
    setIsOpen(false);

    try {
      const pos = await getCurrentPosition();
      const locationString = `Your Location (${pos.lat.toFixed(6)},${pos.lng.toFixed(6)})`;
      setInputValue(locationString);
      onChange(locationString);
      setUsingCurrentLocation(true);

      const accM = Math.round(pos.accuracy);
      let description: string;
      if (accM <= 50) {
        description = `Using your current location. High accuracy (\u00b1${accM}m).`;
      } else if (accM <= 500) {
        description = `Using your current location. Good accuracy (\u00b1${accM}m).`;
      } else if (accM <= 5000) {
        description = `Using your approximate location (\u00b1${(accM / 1000).toFixed(1)}km). For better accuracy, try on a phone with GPS enabled.`;
      } else {
        description = `Using your approximate location (\u00b1${(accM / 1000).toFixed(0)}km). Your browser is using IP-based location. For precise results, use a phone with GPS or enter a postcode.`;
      }

      toast({
        title: "Location detected",
        description,
        duration: accM > 5000 ? 8000 : 5000,
      });

      try {
        const res = await fetch(`${API_BASE}/api/reverse-geocode?lat=${pos.lat}&lng=${pos.lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.name) {
            setLocationLabel(data.name);
          }
        }
      } catch {}
    } catch (err: any) {
      const errorMessage = err?.message || (
        err?.code === 1 ? "Location permission was denied. Please allow location access in your browser settings." :
        err?.code === 2 ? "Your location is currently unavailable. Try entering a postcode instead." :
        err?.code === 3 ? "Location request timed out. Try opening this page directly in a new browser tab, or enter a postcode." :
        "Could not get your location. Please try again or enter a postcode."
      );
      toast({
        title: "Location error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLocating(false);
    }
  };

  const prevAccuracyRef = useRef<number | null>(null);
  const savedLocationValueRef = useRef<string>('');

  useEffect(() => {
    if (usingCurrentLocation && latestPosition) {
      const newAcc = Math.round(latestPosition.accuracy);
      const prevAcc = prevAccuracyRef.current;

      if (prevAcc && prevAcc > 500 && newAcc < prevAcc * 0.5) {
        const accText = newAcc < 50 ? `High accuracy (\u00b1${newAcc}m)` : `Improved accuracy (\u00b1${newAcc < 1000 ? `${newAcc}m` : `${(newAcc / 1000).toFixed(1)}km`})`;
        toast({
          title: "Location refined",
          description: `GPS lock improved. ${accText}.`,
        });
      }
      prevAccuracyRef.current = newAcc;
    }
  }, [latestPosition, usingCurrentLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setInputValue(value);
    setUsingCurrentLocation(isCurrentLocationValue(value));
  }, [value]);

  const handleBlur = () => {
    setTimeout(() => {
      if (justSelectedRef.current) return;
      // If user focused a current-location input but didn't type anything,
      // restore the saved location value instead of clearing startPoint
      if (inputValue === '' && savedLocationValueRef.current) {
        const saved = savedLocationValueRef.current;
        savedLocationValueRef.current = '';
        setInputValue(saved);
        setUsingCurrentLocation(isCurrentLocationValue(saved));
        // Don't call onChange \u2014 parent's value hasn't changed
        return;
      }
      savedLocationValueRef.current = '';
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 200);
  };

  const handleFocus = () => {
    if (usingCurrentLocation || isCurrentLocationValue(inputValue)) {
      // Save the current location value so we can restore it if user doesn't type
      savedLocationValueRef.current = inputValue || value;
      setInputValue('');
      // Don't call onChange('') here \u2014 only propagate changes when user actually
      // types or selects something. This prevents the map from going blank on
      // accidental focus (mobile scroll jitter, toast appearance, etc.)
      setUsingCurrentLocation(false);
      setLocationLabel(null);
    }
    setIsOpen(true);
  };

  const displayValue = usingCurrentLocation ? '' : inputValue;
  const showCurrentLocationLabel = usingCurrentLocation || isCurrentLocationValue(inputValue);

  return (
    <div className="relative" ref={autocompleteRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder={showCurrentLocationLabel ? (locationLabel || 'My current location') : placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`w-full py-2 pl-3 text-base border rounded-lg focus:border-primary focus:outline-none ${
            showLocationOption ? 'pr-10' : 'pr-4'
          } ${showCurrentLocationLabel ? 'placeholder:text-blue-600 placeholder:font-medium' : ''}`}
        />
        {showLocationOption && (
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className={`absolute right-0 flex items-center pr-3 transition-colors ${
              isLocating
                ? 'text-gray-400 cursor-wait'
                : usingCurrentLocation
                ? 'text-blue-500 hover:text-blue-700'
                : 'text-gray-400 hover:text-blue-500'
            }`}
            title="Use my current location"
          >
            {isLocating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Crosshair size={16} />
            )}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {showLocationOption && (
            <div
              className="p-2 cursor-pointer hover:bg-blue-50 text-sm border-b"
              onMouseDown={(e) => { e.preventDefault(); handleUseMyLocation(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleUseMyLocation(); }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation size={14} className="text-blue-500" />
                  <span className="text-blue-600 font-medium">Use my current location</span>
                </div>
                {isLocating && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin" />
                    Locating...
                  </span>
                )}
              </div>
            </div>
          )}

          {inputValue.length > 0 && !isCurrentLocationValue(inputValue) && (
            <>
              {isLoading ? (
                <div className="p-2 text-sm text-gray-500">Loading...</div>
              ) : Array.isArray(suggestions) && suggestions.length > 0 ? (
                suggestions.map((suggestion: LocationSuggestion, index: number) => (
                  <div
                    key={index}
                    className="p-2 cursor-pointer hover:bg-gray-100 text-sm"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(suggestion); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleSelectSuggestion(suggestion); }}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />
                      <span>{suggestion.name}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2 text-sm text-gray-500">
                  No locations found. Try a city name, address, or postcode.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
