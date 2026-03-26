// shared/schema.ts
import { z } from "zod";
import { pgTable, serial, text, integer, doublePrecision, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// -- Drizzle table definitions ----------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedRoutes = pgTable("saved_routes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  startPoint: jsonb("start_point").notNull(), // { lat, lng }
  endPoint: jsonb("end_point").notNull(),     // { lat, lng }
  distance: doublePrecision("distance").notNull(),
  elevationGain: doublePrecision("elevation_gain"),
  estimatedTime: doublePrecision("estimated_time"),
  routePath: jsonb("route_path"),       // Point[]
  routeType: varchar("route_type", { length: 50 }),
  surfaceType: varchar("surface_type", { length: 20 }),
  sceneryRating: integer("scenery_rating"),
  trafficLevel: integer("traffic_level"),
  features: jsonb("features"),          // string[]
  directions: jsonb("directions"),      // DirectionStep[]
  createdAt: timestamp("created_at").defaultNow(),
});

export const preferences = pgTable("preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  minDistance: doublePrecision("min_distance"),
  maxDistance: doublePrecision("max_distance"),
  sceneryPreference: integer("scenery_preference"),
  trafficPreference: integer("traffic_preference"),
  routeType: varchar("route_type", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// -- Insert schemas (for validation) ----------------------------------------

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertSavedRouteSchema = createInsertSchema(savedRoutes).omit({
  id: true,
  createdAt: true,
});

export const insertPreferencesSchema = createInsertSchema(preferences).omit({
  id: true,
  updatedAt: true,
});

// -- Drizzle inferred types -------------------------------------------------

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SavedRoute = typeof savedRoutes.$inferSelect;
export type InsertSavedRoute = z.infer<typeof insertSavedRouteSchema>;
export type Preferences = typeof preferences.$inferSelect;
export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;

// -- Zod schemas for API validation -----------------------------------------

export const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const routeFilterSchema = z
  .object({
    // required
    startPoint: pointSchema,

    // may be missing OR null (we'll guard in superRefine)
    endPoint: pointSchema.nullish().optional(),

    // filters (all optional)
    minDistance: z.number().optional(),
    maxDistance: z.number().optional(),
    sceneryRating: z.number().int().min(1).max(5).optional(),
    trafficLevel: z.number().int().min(1).max(5).optional(),
    routeType: z.string().optional(),
    surfaceType: z.enum(['road', 'trail', 'mixed']).optional(),
    requiredFeatures: z.array(z.string()).optional(),
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
  userId?: number;
  name: string;
  description?: string;
  startPoint: Point;
  endPoint: Point;
  distance: number;
  elevationGain?: number;
  estimatedTime?: number;
  routePath?: any;
  routeType?: string;
  surfaceType?: 'road' | 'trail' | 'mixed';
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

// -- Backwards-compatible types used by storage -----------------------------

export type RoutePreferences = {
  id: number;
  minDistance?: number;
  maxDistance?: number;
  sceneryPreference?: number;
  trafficPreference?: number;
  routeType?: string;
};
