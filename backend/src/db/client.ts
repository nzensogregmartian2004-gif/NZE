// Connexion PostgreSQL via pool pg et Drizzle ORM.
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

export function createDb(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  // Une connexion inactive coupée par le serveur ne doit pas faire tomber le processus (erreur non gérée).
  pool.on('error', (erreur) => {
    console.error('Connexion PostgreSQL inactive interrompue :', erreur.message);
  });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

export type Db = ReturnType<typeof createDb>['db'];
