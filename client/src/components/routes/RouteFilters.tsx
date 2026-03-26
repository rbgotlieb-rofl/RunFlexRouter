import { RouteFilter } from "@shared/schema";
import { SlidersHorizontal } from "lucide-react";

interface RouteFiltersProps {
  totalRoutes: number;
  filters: Partial<RouteFilter>;
  onFilterChange: (filters: Partial<RouteFilter>) => void;
}

const ATTRIBUTE_CHIPS = [
  { key: "scenic", label: "Scenic", filterKey: "sceneryRating", filterValue: 4 },
  { key: "low_traffic", label: "Low Traffic", filterKey: "trafficLevel", filterValue: 1 },
  { key: "waterfront", label: "Waterfront", feature: true },
  { key: "well_lit", label: "Well-lit", feature: true },
  { key: "cultural_sites", label: "Cultural Sites", feature: true },
  { key: "urban", label: "Urban", feature: true },
] as const;

const SURFACE_CHIPS = [
  { key: "road", label: "Road" },
  { key: "trail", label: "Trail" },
  { key: "mixed", label: "Mixed" },
] as const;

export default function RouteFilters({ totalRoutes, filters, onFilterChange }: RouteFiltersProps) {
  const activeFeatures: string[] = (filters as any).requiredFeatures || [];
  const activeSurface = (filters as any).surfaceType as string | undefined;

  const toggleFeatureChip = (chip: typeof ATTRIBUTE_CHIPS[number]) => {
    if (chip.feature) {
      const updated = activeFeatures.includes(chip.key)
        ? activeFeatures.filter(f => f !== chip.key)
        : [...activeFeatures, chip.key];
      onFilterChange({ requiredFeatures: updated.length > 0 ? updated : undefined } as any);
    } else {
      // Toggle sceneryRating / trafficLevel
      const currentVal = (filters as any)[chip.filterKey];
      onFilterChange({
        [chip.filterKey]: currentVal === chip.filterValue ? undefined : chip.filterValue,
      });
    }
  };

  const toggleSurface = (surface: string) => {
    onFilterChange({
      surfaceType: activeSurface === surface ? undefined : surface,
    } as any);
  };

  const isChipActive = (chip: typeof ATTRIBUTE_CHIPS[number]) => {
    if (chip.feature) return activeFeatures.includes(chip.key);
    return (filters as any)[chip.filterKey] === chip.filterValue;
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Routes ({totalRoutes})</h2>
        </div>

        {/* Attribute filter chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          {ATTRIBUTE_CHIPS.map((chip) => {
            const active = isChipActive(chip);
            return (
              <button
                key={chip.key}
                onClick={() => toggleFeatureChip(chip)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Surface type chips */}
        <div className="flex gap-2">
          <span className="text-xs text-gray-500 self-center mr-1">Surface:</span>
          {SURFACE_CHIPS.map((chip) => {
            const active = activeSurface === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => toggleSurface(chip.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
