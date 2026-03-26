import { useQuery } from "@tanstack/react-query";
import { RouteFilter, Route } from "@shared/schema";

export function useRoutes(
  startPoint: string,
  endPoint: string,
  filters?: Partial<RouteFilter>
) {
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("startPostcode", startPoint);

    const routeMode = filters?.routeMode || "all";
    const needsEndPoint = routeMode === "a_to_b" || routeMode === "all";
    if (endPoint && needsEndPoint) {
      params.append("endPostcode", endPoint);
    }

    if (filters?.minDistance) {
      params.append("minDistance", filters.minDistance.toString());
    }
    if (filters?.maxDistance) {
      params.append("maxDistance", filters.maxDistance.toString());
    }
    if (filters?.sceneryRating) {
      params.append("sceneryRating", filters.sceneryRating.toString());
    }
    if (filters?.trafficLevel) {
      params.append("trafficLevel", filters.trafficLevel.toString());
    }
    if (filters?.routeType) {
      params.append("routeType", filters.routeType);
    }
    if (filters?.surfaceType) {
      params.append("surfaceType", filters.surfaceType);
    }
    if (filters?.requiredFeatures && filters.requiredFeatures.length > 0) {
      params.append("requiredFeatures", filters.requiredFeatures.join(","));
    }
    if (filters?.routeMode) {
      params.append("routeMode", filters.routeMode);
    }
    if (filters?.targetType) {
      params.append("targetType", filters.targetType);
    }
    if (filters?.targetType === 'duration' && filters?.targetDuration) {
      params.append("targetDuration", filters.targetDuration.toString());
    }
    if (filters?.targetType === 'distance' && filters?.targetDistance) {
      params.append("targetDistance", filters.targetDistance.toString());
      if (filters?.distanceUnit) {
        params.append("distanceUnit", filters.distanceUnit);
      }
    }

    return params.toString();
  };

  return useQuery<Route[]>({
    queryKey: [
      `/api/routes?${buildQueryParams()}`,
    ],
    enabled: false,
  });
}
