import { DirectionStep } from "@shared/schema";
import { Navigation } from "lucide-react";

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