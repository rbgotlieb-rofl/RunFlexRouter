import { Route, Point } from "@shared/schema";
import { getFeatureIcon, getRouteTypeLabel, getRouteTypeColor } from "@/lib/route-utils";
import RouteMapPreview from "@/components/map/RouteMapPreview";

interface RouteCardProps {
  route: Route;
  routeNumber: number;
  onClick: () => void;
  userLocation?: Point | null;
}

export default function RouteCard({ route, routeNumber, onClick, userLocation }: RouteCardProps) {
  const routeTypeColor = getRouteTypeColor(route.routeType || 'any');
  const routeTypeLabel = getRouteTypeLabel(route.routeType || 'any');
  
  return (
    <div 
      onClick={onClick}
      className="route-card bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer transform hover:-translate-y-1 duration-200"
    >
      <div className="flex-1">
        <div className="flex items-start mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
              {routeNumber}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg">{route.name.replace(/\s*\([0-9.]+km\)/i, '')}</h3>
              <p className="text-sm text-gray-500 truncate">{route.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-block px-2 py-1 ${routeTypeColor} text-xs rounded-full`}>
              {routeTypeLabel}
            </span>
            <button className="text-neutral-700 hover:text-primary">
              <i className="far fa-heart"></i>
            </button>
          </div>
        </div>

        <div className="mb-3">
          <RouteMapPreview route={route} height={140} userLocation={userLocation} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-gray-500">Distance</p>
            <p className="font-medium">{route.distance.toFixed(1)} km</p>
          </div>
          <div>
            <p className="text-gray-500">Elevation</p>
            <p className="font-medium">{route.elevationGain} m</p>
          </div>
          <div>
            <p className="text-gray-500">Est. Time</p>
            <p className="font-medium">
              {route.estimatedTime && route.estimatedTime >= 60 
                ? `${Math.floor(route.estimatedTime / 60)}h ${route.estimatedTime % 60}m`
                : `${route.estimatedTime || 0}m`}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center text-xs text-gray-500 gap-3">
            {Array.isArray(route.features) && route.features.slice(0, 3).map((feature: string, index: number) => (
              <span key={index} className="flex items-center">
                {getFeatureIcon(feature as any)}
                <span className="ml-1">{feature.replace('_', ' ')}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
