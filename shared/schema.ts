// shared/schema.ts
import { z } from "zod";

export const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const routeFilterSchema = z
  .object({
    // required
    startPoint: pointSchema,

    // may be missing OR null (we’ll guard in superRefine)
    endPoint: pointSchema.nullish().optional(),

    // filters (all optional)
    minDistance: z.number().optional(),
    maxDistance: z.number().optional(),
    sceneryRating: z.number().int().min(1).max(5).optional(),
    trafficLevel: z.number().int().min(1).max(5).optional(),
    routeType: z.string().optional(),
    targetDuration: z.number().optional(),
    targetDistance: z.number().optional(),
    distanceUnit: z.enum(['km', 'miles']).optional(),
    targetType: z.enum(['duration', 'distance']).optional(),

    routeMode: z.enum(["loop", "a_to_b", "duration", "all"]).default("loop"),
  })
  .superRefine((val, ctx) => {
    if (val.routeMode === "a_to_b" && !val.endPoint) {
      ctx.addIssue({
        code: "custom",
        path: ["endPoint"],
        message: "endPoint is required when routeMode = 'a_to_b'",
      });
    }
  });

export type RouteFilter = z.infer<typeof routeFilterSchema>;
export type Point = z.infer<typeof pointSchema>;

// Additional types needed by route generator
export type Route = {
  id: number;
  name: string;
  description?: string;
  startPoint: Point;
  endPoint: Point;
  distance: number;
  elevationGain?: number;
  estimatedTime?: number;
  routePath?: any;
  routeType?: string;
  sceneryRating?: number;
  trafficLevel?: number;
  features?: string[];
  directions?: DirectionStep[];
  imageUrl?: string;
};

export type DirectionStep = {
  instruction: string;
  distance: number;  // in kilometers
  duration: number;  // in minutes
};

export type RouteFeature = 'scenic' | 'low_traffic' | 'well_lit' | 'waterfront' | 'urban' | 'open_view' | 'medium_traffic' | 'high_traffic' | 'cultural_sites' | 'morning_run';
export type RouteType = 'all' | 'any' | 'urban' | 'park' | 'waterfront';
export type RouteMode = 'all' | 'a_to_b' | 'loop' | 'duration';
