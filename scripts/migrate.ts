/**
 * Run SQL migrations against the database.
 * Usage: DATABASE_URL=... npx tsx scripts/migrate.ts
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(url);
  const migrationsDir = join(import.meta.dirname, "..", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Running ${files.length} migration(s)...`);

  for (const file of files) {
    const content = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`  → ${file}`);

    // Neon serverless driver doesn't support multiple statements per call.
    // Split on semicolons and run each statement individually.
    const statements = content
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      await sql(stmt);
    }
  }

  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
