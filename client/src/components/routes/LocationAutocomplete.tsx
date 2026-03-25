import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Crosshair, Loader2, ArrowLeft, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/api';
import { Point } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useIsMobile } from '@/hooks/use-mobile';

interface LocationSuggestion {
  name: string;
  point: Point;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showLocationOption?: boolean;
  /** User's current lat/lng for proximity-biased results */
  userProximity?: Point | null;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder,
  showLocationOption = true,
  userProximity,
}: LocationAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isLocating, setIsLocating] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);
  const { toast } = useToast();
  const { getCurrentPosition, position: latestPosition } = useGeolocation();
  const isMobile = useIsMobile();

  const isCurrentLocationValue = (val: string) =>
    val.startsWith("Your Location (") || val === "Current Location";

  // Build proximity query string from user location
  const proximityParam = userProximity
    ? `${userProximity.lng},${userProximity.lat}`
    : latestPosition
    ? `${latestPosition.lng},${latestPosition.lat}`
    : undefined;

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['/api/locations', inputValue, proximityParam],
    queryFn: async () => {
      let url = `${API_BASE}/api/locations?q=${encodeURIComponent(inputValue)}`;
      if (proximityParam) {
        url += `&proximity=${encodeURIComponent(proximityParam)}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    enabled: inputValue.length > 0 && !isCurrentLocationValue(inputValue),
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
    if (mobileExpanded) setMobileExpanded(false);
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
      if (mobileExpanded) setMobileExpanded(false);

      const accM = Math.round(pos.accuracy);
      let description: string;
      if (accM <= 50) {
        description = `Using your current location. High accuracy (±${accM}m).`;
      } else if (accM <= 500) {
        description = `Using your current location. Good accuracy (±${accM}m).`;
      } else if (accM <= 5000) {
        description = `Using your approximate location (±${(accM / 1000).toFixed(1)}km). For better accuracy, try on a phone with GPS enabled.`;
      } else {
        description = `Using your approximate location (±${(accM / 1000).toFixed(0)}km). Your browser is using IP-based location. For precise results, use a phone with GPS or enter a postcode.`;
      }

      toast({
        title: "Location detected",
        description,
        duration: accM > 5000 ? 8000 : 5000,
      });

      try {
        const res = await fetch(`${API_BASE}/api/reverse-geocode?lat=${pos.lat}&lng=${pos.lng}`, { credentials: 'include' });
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
        const accText = newAcc < 50 ? `High accuracy (±${newAcc}m)` : `Improved accuracy (±${newAcc < 1000 ? `${newAcc}m` : `${(newAcc / 1000).toFixed(1)}km`})`;
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
    if (mobileExpanded) return; // Don't blur in mobile expanded mode
    setTimeout(() => {
      if (justSelectedRef.current) return;
      if (inputValue === '' && savedLocationValueRef.current) {
        const saved = savedLocationValueRef.current;
        savedLocationValueRef.current = '';
        setInputValue(saved);
        setUsingCurrentLocation(isCurrentLocationValue(saved));
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
      savedLocationValueRef.current = inputValue || value;
      setInputValue('');
      setUsingCurrentLocation(false);
      setLocationLabel(null);
    }
    setIsOpen(true);

    // On mobile, expand to full-screen overlay
    if (isMobile && !mobileExpanded) {
      setMobileExpanded(true);
    }
  };

  const handleMobileClose = () => {
    setMobileExpanded(false);
    setIsOpen(false);
    // Restore saved value if user didn't select anything
    if (inputValue === '' && savedLocationValueRef.current) {
      const saved = savedLocationValueRef.current;
      savedLocationValueRef.current = '';
      setInputValue(saved);
      setUsingCurrentLocation(isCurrentLocationValue(saved));
    }
  };

  const handleClearInput = () => {
    setInputValue('');
    setUsingCurrentLocation(false);
    setLocationLabel(null);
    if (mobileExpanded && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  };

  // Focus the mobile input when expanded
  useEffect(() => {
    if (mobileExpanded && mobileInputRef.current) {
      setTimeout(() => mobileInputRef.current?.focus(), 100);
    }
  }, [mobileExpanded]);

  const displayValue = usingCurrentLocation ? '' : inputValue;
  const showCurrentLocationLabel = usingCurrentLocation || isCurrentLocationValue(inputValue);

  const renderSuggestionsList = (onSelect: typeof handleSelectSuggestion) => (
    <>
      {showLocationOption && (
        <div
          className="p-3 cursor-pointer hover:bg-blue-50 text-sm border-b active:bg-blue-100"
          onMouseDown={(e) => { e.preventDefault(); handleUseMyLocation(); }}
          onTouchEnd={(e) => { e.preventDefault(); handleUseMyLocation(); }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation size={16} className="text-blue-500" />
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
            <div className="p-3 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Searching nearby...
            </div>
          ) : Array.isArray(suggestions) && suggestions.length > 0 ? (
            suggestions.map((suggestion: LocationSuggestion, index: number) => (
              <div
                key={index}
                className="p-3 cursor-pointer hover:bg-gray-100 active:bg-gray-200 text-sm"
                onMouseDown={(e) => { e.preventDefault(); onSelect(suggestion); }}
                onTouchEnd={(e) => { e.preventDefault(); onSelect(suggestion); }}
              >
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="truncate">{suggestion.name}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-sm text-gray-500">
              No locations found. Try a city name, address, or postcode.
            </div>
          )}
        </>
      )}
    </>
  );

  // Mobile full-screen overlay
  if (mobileExpanded && isMobile) {
    return (
      <>
        {/* Keep the original input in place (hidden behind overlay) */}
        <div className="relative" ref={autocompleteRef}>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              placeholder={placeholder}
              value=""
              className="w-full py-2 pl-3 pr-4 border rounded-lg bg-gray-50"
            />
          </div>
        </div>

        {/* Full-screen overlay */}
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 p-3 border-b bg-white safe-area-top">
            <button
              type="button"
              onClick={handleMobileClose}
              className="p-2 -ml-1 rounded-full hover:bg-gray-100 active:bg-gray-200"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 relative">
              <input
                ref={mobileInputRef}
                type="text"
                placeholder={showCurrentLocationLabel ? (locationLabel || 'My current location') : placeholder}
                value={displayValue}
                onChange={handleInputChange}
                className={`w-full py-3 px-4 text-base border rounded-xl focus:border-primary focus:outline-none bg-gray-50 ${
                  showCurrentLocationLabel ? 'placeholder:text-blue-600 placeholder:font-medium' : ''
                }`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {inputValue.length > 0 && !isCurrentLocationValue(inputValue) && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions list */}
          <div className="flex-1 overflow-y-auto">
            {renderSuggestionsList(handleSelectSuggestion)}
          </div>
        </div>
      </>
    );
  }

  // Desktop / non-expanded view
  return (
    <div className="relative" ref={autocompleteRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          placeholder={showCurrentLocationLabel ? (locationLabel || 'My current location') : placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`w-full py-2.5 pl-3 border rounded-lg focus:border-primary focus:outline-none text-base ${
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
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Crosshair size={18} />
            )}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {renderSuggestionsList(handleSelectSuggestion)}
        </div>
      )}
    </div>
  );
}
