import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (db) return db;

  const url = process.env.DATABASE_URL;
  // Debug: list all env var names to diagnose Railway injection issue
  const allEnvKeys = Object.keys(process.env).sort().join(', ');
  console.log(`DB: Available env vars: ${allEnvKeys}`);
  console.log(`DB: DATABASE_URL ${url ? `set (length=${url.length})` : 'NOT SET'}`);
  if (!url) {
    return null;
  }

  try {
    const sql = neon(url);
    db = drizzle(sql, { schema });
    console.log("Connected to PostgreSQL via Neon");
    return db;
  } catch (err) {
    console.error("Failed to connect to database:", err);
    return null;
  }
}
