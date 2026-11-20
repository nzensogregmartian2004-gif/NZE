// Applique les migrations versionnées. Usage : DATABASE_URL=... node --experimental-strip-types src/db/migrate.ts
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client.ts';

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { pool, db } = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL requis');
  await runMigrations(url);
  console.log('Migrations appliquées');
}
