// Chaîne de migrations : une base déjà migrée jusqu'à la version précédente (comme la base de production) reçoit la nouvelle migration, sans rien réécrire.
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import EmbeddedPostgres from 'embedded-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/db/client.ts';
import { portLibre } from './helpers.ts';

const migrations = fileURLToPath(new URL('../src/db/migrations', import.meta.url));
const temporaires: string[] = [];
after(() => { for (const d of temporaires) rmSync(d, { recursive: true, force: true }); });

// Générique : compare l'ensemble des colonnes avant et après, quelle que soit la dernière migration du journal.
test('une base migrée jusqu’à la version précédente reçoit la dernière migration sans erreur', async () => {
  const port = await portLibre();
  const dir = join(tmpdir(), `nze-chaine-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  const pgi = new EmbeddedPostgres({ databaseDir: dir, user: 'nze', password: 'nze_test_pwd', port, persistent: false, createPostgresUser: true, onLog: () => {}, onError: () => {} });
  await pgi.initialise();
  await pgi.start();
  await pgi.createDatabase('chaine');
  const url = `postgres://nze:nze_test_pwd@localhost:${port}/chaine`;
  const { pool, db } = createDb(url);
  try {
    // Étape 1 : dossier « historique » = mêmes migrations, sans la dernière.
    const historique = mkdtempSync(join(tmpdir(), 'nze-migr-'));
    temporaires.push(historique);
    cpSync(migrations, historique, { recursive: true });
    const journal = JSON.parse(readFileSync(join(historique, 'meta', '_journal.json'), 'utf8'));
    const derniere = journal.entries.pop();
    writeFileSync(join(historique, 'meta', '_journal.json'), JSON.stringify(journal, null, 2));
    unlinkSync(join(historique, `${derniere.tag}.sql`));
    await migrate(db, { migrationsFolder: historique });

    const colonnes = async () => new Set((await pool.query("select table_name || '.' || column_name || ' nullable=' || is_nullable || ' default=' || coalesce(column_default, '') as c from information_schema.columns where table_schema = 'public'")).rows.map((r) => r.c));
    const avant = await colonnes();

    // Étape 2 : la base reçoit la version fusionnée. Seule la nouvelle migration doit s'appliquer.
    await migrate(db, { migrationsFolder: migrations });
    const apres = await colonnes();
    const nouvelles = [...apres].filter((c) => !avant.has(c));
    assert.ok(nouvelles.length > 0, 'la dernière migration ajoute ou modifie au moins une colonne ou une table (ajout, défaut ou nullabilité)');
    const appliquees = await pool.query('select count(*)::int as n from drizzle.__drizzle_migrations');
    const attendues = JSON.parse(readFileSync(join(migrations, 'meta', '_journal.json'), 'utf8')).entries.length;
    assert.equal(appliquees.rows[0].n, attendues, 'chaque migration du journal est enregistrée une seule fois');
  } finally {
    await pool.end();
    await pgi.stop();
  }
});
