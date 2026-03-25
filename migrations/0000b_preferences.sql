CREATE TABLE IF NOT EXISTS "preferences" (
  "id" serial PRIMARY KEY,
  "user_id" integer REFERENCES "users"("id"),
  "min_distance" double precision,
  "max_distance" double precision,
  "scenery_preference" integer,
  "traffic_preference" integer,
  "route_type" varchar(50),
  "updated_at" timestamp DEFAULT now()
)
