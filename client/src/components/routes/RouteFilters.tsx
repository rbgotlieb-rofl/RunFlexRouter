import { useState } from "react";
import { Route } from "@shared/schema";
import { X } from "lucide-react";

interface ActiveFilters {
  features: string[];
  surfaceType?: string;
}

interface RouteFiltersProps {
  totalRoutes: number;
  filteredCount: number;
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
}

const FEATURE_CHIPS = [
  { key: "scenic", label: "Scenic" },
  { key: "low_traffic", label: "Low Traffic" },
  { key: "waterfront", label: "Waterfront" },
  { key: "well_lit", label: "Well-lit" },
  { key: "cultural_sites", label: "Cultural Sites" },
  { key: "urban", label: "Urban" },
];

const SURFACE_CHIPS = [
  { key: "road", label: "Road" },
  { key: "trail", label: "Trail" },
  { key: "mixed", label: "Mixed" },
];

export function applyClientFilters(routes: Route[], filters: ActiveFilters): Route[] {
  return routes.filter((route) => {
    // Feature filter: route must have ALL selected features
    if (filters.features.length > 0) {
      const routeFeatures = (route.features || []).map(f => f.toLowerCase());
      const hasAll = filters.features.every(f => routeFeatures.includes(f.toLowerCase()));
      if (!hasAll) return false;
    }

    // Surface type filter
    if (filters.surfaceType && route.surfaceType && route.surfaceType !== filters.surfaceType) {
      return false;
    }

    return true;
  });
}

export const EMPTY_FILTERS: ActiveFilters = { features: [], surfaceType: undefined };

export default function RouteFilters({ totalRoutes, filteredCount, activeFilters, onFiltersChange }: RouteFiltersProps) {
  const hasActiveFilters = activeFilters.features.length > 0 || !!activeFilters.surfaceType;

  const toggleFeature = (key: string) => {
    const updated = activeFilters.features.includes(key)
      ? activeFilters.features.filter(f => f !== key)
      : [...activeFilters.features, key];
    onFiltersChange({ ...activeFilters, features: updated });
  };

  const toggleSurface = (key: string) => {
    onFiltersChange({
      ...activeFilters,
      surfaceType: activeFilters.surfaceType === key ? undefined : key,
    });
  };

  const clearAll = () => {
    onFiltersChange(EMPTY_FILTERS);
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Routes ({hasActiveFilters ? `${filteredCount} of ${totalRoutes}` : totalRoutes})
          </h2>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>

        {/* Feature filter chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          {FEATURE_CHIPS.map((chip) => {
            const active = activeFilters.features.includes(chip.key);
            return (
              <button
                key={chip.key}
                onClick={() => toggleFeature(chip.key)}
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
            const active = activeFilters.surfaceType === chip.key;
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
