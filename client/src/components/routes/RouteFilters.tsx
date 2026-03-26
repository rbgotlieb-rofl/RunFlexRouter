import { useMemo } from "react";
import { Route } from "@shared/schema";
import { X } from "lucide-react";

export interface ActiveFilters {
  features: string[];
  surfaceType?: string;
}

interface RouteFiltersProps {
  routes: Route[];
  filteredCount: number;
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
}

const FEATURE_LABELS: Record<string, string> = {
  scenic: "Scenic",
  low_traffic: "Low Traffic",
  waterfront: "Waterfront",
  well_lit: "Well-lit",
  cultural_sites: "Cultural Sites",
  urban: "Urban",
  loop: "Loop",
  out_and_back: "Out & Back",
  park: "Park",
  high_traffic: "High Traffic",
  medium_traffic: "Medium Traffic",
};

const SURFACE_LABELS: Record<string, string> = {
  road: "Road",
  trail: "Trail",
  mixed: "Mixed",
};

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

export default function RouteFilters({ routes, filteredCount, activeFilters, onFiltersChange }: RouteFiltersProps) {
  const hasActiveFilters = activeFilters.features.length > 0 || !!activeFilters.surfaceType;

  // Build the set of features that actually exist across all loaded routes
  const availableFeatures = useMemo(() => {
    const featureSet = new Set<string>();
    for (const route of routes) {
      if (route.features && Array.isArray(route.features)) {
        for (const f of route.features) {
          featureSet.add(f.toLowerCase());
        }
      }
    }
    // Return only features that have a label defined, sorted by label order
    return Array.from(featureSet)
      .filter(f => FEATURE_LABELS[f])
      .sort((a, b) => {
        const keys = Object.keys(FEATURE_LABELS);
        return keys.indexOf(a) - keys.indexOf(b);
      });
  }, [routes]);

  // Build the set of surface types that actually exist
  const availableSurfaces = useMemo(() => {
    const surfaceSet = new Set<string>();
    for (const route of routes) {
      if (route.surfaceType) {
        surfaceSet.add(route.surfaceType);
      }
    }
    return Array.from(surfaceSet).filter(s => SURFACE_LABELS[s]);
  }, [routes]);

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

  // Don't show the filter section if there's nothing to filter by
  if (availableFeatures.length === 0 && availableSurfaces.length === 0) {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Routes ({routes.length})</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Routes ({hasActiveFilters ? `${filteredCount} of ${routes.length}` : routes.length})
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

        {/* Feature filter chips — only show features that exist in loaded routes */}
        {availableFeatures.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {availableFeatures.map((key) => {
              const active = activeFilters.features.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleFeature(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {FEATURE_LABELS[key] || key}
                </button>
              );
            })}
          </div>
        )}

        {/* Surface type chips — only show if routes have surface data */}
        {availableSurfaces.length > 0 && (
          <div className="flex gap-2">
            <span className="text-xs text-gray-500 self-center mr-1">Surface:</span>
            {availableSurfaces.map((key) => {
              const active = activeFilters.surfaceType === key;
              return (
                <button
                  key={key}
                  onClick={() => toggleSurface(key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {SURFACE_LABELS[key] || key}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
