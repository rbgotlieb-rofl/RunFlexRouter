import { useState } from "react";
import { X, Plus, SlidersHorizontal } from "lucide-react";
import { RouteFilter } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface RouteFiltersProps {
  totalRoutes: number;
  filters: Partial<RouteFilter>;
  onFilterChange: (filters: Partial<RouteFilter>) => void;
}

export default function RouteFilters({ totalRoutes, filters, onFilterChange }: RouteFiltersProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  // Route type filter removed as per requirement

  const addFilter = (filter: string) => {
    if (!activeFilters.includes(filter)) {
      const newFilters = [...activeFilters, filter];
      setActiveFilters(newFilters);
      
      // Update the actual filters
      if (filter === "scenic") {
        onFilterChange({ sceneryRating: 3 });
      } else if (filter === "low-traffic") {
        onFilterChange({ trafficLevel: 1 });
      }
    }
  };

  const removeFilter = (filter: string) => {
    const newFilters = activeFilters.filter(f => f !== filter);
    setActiveFilters(newFilters);
    
    // Update the actual filters
    if (filter === "scenic") {
      onFilterChange({ sceneryRating: undefined });
    } else if (filter === "low-traffic") {
      onFilterChange({ trafficLevel: undefined });
    }
  };
  
  // Route type filter change handler removed as per requirement

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Routes ({totalRoutes})</h2>
          <button 
            className="text-sm text-primary flex items-center"
            onClick={() => {}} // This would open a modal with all filter options
          >
            <SlidersHorizontal size={16} className="mr-1" /> Filters
          </button>
        </div>
        
        {/* Scenery filter removed as per requirement */}
        
        {/* Distance filter removed as per requirement */}

        {/* Active filters */}
        <div className="flex space-x-2 overflow-x-auto hide-scrollbar py-1 no-scrollbar">
          {activeFilters.includes("scenic") && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full">
              <span>Scenic</span>
              <button onClick={() => removeFilter("scenic")} className="text-gray-500">
                <X size={12} />
              </button>
            </Badge>
          )}
          
          {activeFilters.includes("low-traffic") && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full">
              <span>Low Traffic</span>
              <button onClick={() => removeFilter("low-traffic")} className="text-gray-500">
                <X size={12} />
              </button>
            </Badge>
          )}
          
          <button 
            onClick={() => {
              if (!activeFilters.includes("scenic")) {
                addFilter("scenic");
              } else if (!activeFilters.includes("low-traffic")) {
                addFilter("low-traffic");
              }
            }}
            className="flex items-center px-3 py-1 bg-green-50 text-primary rounded-full text-xs"
          >
            <Plus size={12} className="mr-1" />
            <span>Add Filter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
