/**
 * Run SQL migrations against the database.
 * Each .sql file should contain exactly ONE statement (no semicolons needed).
 * Usage: DATABASE_URL=... npx tsx scripts/migrate.ts
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skipping migrations");
    return;
  }

  const sql = neon(url);
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = join(__dirname, "..", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Running ${files.length} migration(s)...`);

  for (const file of files) {
    const content = readFileSync(join(migrationsDir, file), "utf-8").trim();
    if (!content || content.startsWith("--")) continue;
    console.log(`  → ${file}`);
    await sql(content);
  }

  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed (server will start anyway):", err);
});
