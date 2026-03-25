CREATE TABLE IF NOT EXISTS "saved_routes" (
  "id" serial PRIMARY KEY,
  "user_id" integer REFERENCES "users"("id"),
  "name" text NOT NULL,
  "description" text,
  "start_point" jsonb NOT NULL,
  "end_point" jsonb NOT NULL,
  "distance" double precision NOT NULL,
  "elevation_gain" double precision,
  "estimated_time" double precision,
  "route_path" jsonb,
  "route_type" varchar(50),
  "scenery_rating" integer,
  "traffic_level" integer,
  "features" jsonb,
  "directions" jsonb,
  "created_at" timestamp DEFAULT now()
)
