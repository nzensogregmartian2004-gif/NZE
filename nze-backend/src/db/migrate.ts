import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("⏳ Application des migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("✅ Migrations appliquées");

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Échec des migrations :", err);
  process.exit(1);
});
