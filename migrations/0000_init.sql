-- Migration: initial schema
-- Creates users, saved_routes, and preferences tables

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "username" varchar(255) NOT NULL UNIQUE,
  "password" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now()
);

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
);

CREATE TABLE IF NOT EXISTS "preferences" (
  "id" serial PRIMARY KEY,
  "user_id" integer REFERENCES "users"("id"),
  "min_distance" double precision,
  "max_distance" double precision,
  "scenery_preference" integer,
  "traffic_preference" integer,
  "route_type" varchar(50),
  "updated_at" timestamp DEFAULT now()
);

-- Session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
