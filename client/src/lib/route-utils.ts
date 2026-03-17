import { RouteType, RouteFeature } from "@shared/schema";
import React from 'react';

export function getRouteTypeLabel(routeType: string): string {
  switch (routeType) {
    case "park":
      return "Park";
    case "waterfront":
      return "Waterfront";
    case "urban":
      return "Urban";
    default:
      return "Custom";
  }
}

export function getRouteTypeColor(routeType: string, isBg: boolean = false): string {
  const prefix = isBg ? "bg" : "text";
  
  switch (routeType) {
    case "park":
    case "low_traffic":
    case "scenic":
      return `${prefix}-green-100 ${prefix === "bg" ? "text-green-800" : ""}`;
    case "waterfront":
    case "open_view":
      return `${prefix}-blue-100 ${prefix === "bg" ? "text-blue-800" : ""}`;
    case "urban":
    case "cultural_sites":
      return `${prefix}-amber-100 ${prefix === "bg" ? "text-amber-800" : ""}`;
    case "medium_traffic":
      return `${prefix}-orange-100 ${prefix === "bg" ? "text-orange-800" : ""}`;
    case "high_traffic":
      return `${prefix}-red-100 ${prefix === "bg" ? "text-red-800" : ""}`;
    case "well_lit":
    case "morning_run":
      return `${prefix}-purple-100 ${prefix === "bg" ? "text-purple-800" : ""}`;
    default:
      return `${prefix}-gray-100 ${prefix === "bg" ? "text-gray-800" : ""}`;
  }
}

export function getFeatureIcon(feature: RouteFeature): JSX.Element {
  switch (feature) {
    case "scenic":
      return React.createElement('i', { className: "fas fa-tree text-green-500 mr-1" });
    case "low_traffic":
      return React.createElement('i', { className: "fas fa-car text-blue-500 mr-1" });
    case "well_lit":
      return React.createElement('i', { className: "fas fa-shield-alt text-purple-500 mr-1" });
    case "waterfront":
      return React.createElement('i', { className: "fas fa-water text-blue-500 mr-1" });
    case "open_view":
      return React.createElement('i', { className: "fas fa-sun text-yellow-500 mr-1" });
    case "medium_traffic":
      return React.createElement('i', { className: "fas fa-road text-orange-500 mr-1" });
    case "urban":
      return React.createElement('i', { className: "fas fa-building text-gray-500 mr-1" });
    case "cultural_sites":
      return React.createElement('i', { className: "fas fa-landmark text-purple-500 mr-1" });
    case "high_traffic":
      return React.createElement('i', { className: "fas fa-traffic-light text-red-500 mr-1" });
    case "morning_run":
      return React.createElement('i', { className: "fas fa-coffee text-yellow-500 mr-1" });
    default:
      return React.createElement('i', { className: "fas fa-running text-gray-500 mr-1" });
  }
}
