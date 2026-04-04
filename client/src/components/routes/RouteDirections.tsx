import { DirectionStep } from "@shared/schema";
import { Landmark, Navigation } from "lucide-react";

interface RouteDirectionsProps {
  directions: DirectionStep[];
}

export default function RouteDirections({ directions }: RouteDirectionsProps) {
  if (!directions || directions.length === 0) {
    return (
      <div className="py-3 text-center text-gray-500">
        <p>No turn-by-turn directions available for this route.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {directions.map((step, index) => (
        <div key={index} className="flex p-3 bg-neutral-50 rounded-lg">
          <div className="mr-3 mt-1 text-primary">
            <Navigation className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm">{step.instruction}</p>
            {step.culturalSite && (
              <div className="flex items-center mt-1 text-xs text-purple-700 bg-purple-50 rounded px-2 py-1 w-fit">
                <Landmark className="h-3 w-3 mr-1 flex-shrink-0" />
                <span>Near {step.culturalSite}</span>
              </div>
            )}
            <div className="flex text-xs text-gray-500 mt-1">
              <span className="mr-3">{step.distance.toFixed(1)} km</span>
              <span>{Math.round(step.duration)} min</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}