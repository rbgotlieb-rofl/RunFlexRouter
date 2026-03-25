-- Migration: initial schema
-- Creates users, saved_routes, and preferences tables

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "username" varchar(255) NOT NULL UNIQUE,
  "password" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now()
)
