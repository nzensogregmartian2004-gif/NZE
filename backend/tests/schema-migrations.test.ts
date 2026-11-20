// Garde-fou anti-dérive. La base obtenue en appliquant les migrations réelles doit correspondre
// au snapshot Drizzle (src/db/migrations/meta/0000_snapshot.json) : tables, colonnes, types,
// nullabilité et valeurs par défaut. Tout écart fait échouer ce test.
// Quand schema.ts change : relancer « npm run db:generate » (crée une migration et son snapshot), puis relancer les tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { demarrerBase } from './helpers.ts';

interface ColonneSnapshot {
  name: string;
  type: string;
  notNull: boolean;
  default?: unknown;
}

interface Snapshot {
  tables: Record<string, { name: string; columns: Record<string, ColonneSnapshot> }>;
}

interface ColonneBase {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
}

// Le snapshot de référence est le plus récent (0000, 0001, ...) : chaque migration en produit un.
const dossierMeta = new URL('../src/db/migrations/meta/', import.meta.url);
const dernierSnapshot = readdirSync(dossierMeta)
  .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
  .sort()
  .at(-1);
if (!dernierSnapshot) throw new Error('Aucun snapshot de migration trouvé');
const snapshot: Snapshot = JSON.parse(readFileSync(new URL(dernierSnapshot, dossierMeta), 'utf8'));

// Ramène une valeur par défaut à une forme comparable : « 'PANIER'::text » et « PANIER » deviennent « panier ».
function normaliserDefaut(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined) return null;
  return String(valeur).replace(/::text$/, '').replace(/^'(.*)'$/, '$1').toLowerCase();
}

test('la base migrée correspond exactement au snapshot Drizzle', async () => {
  const base = await demarrerBase();
  try {
    const { rows } = await base.pool.query<ColonneBase>(
      `select table_name, column_name, data_type, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'public'`,
    );

    const enBase = new Map<string, Map<string, ColonneBase>>();
    for (const r of rows) {
      if (!enBase.has(r.table_name)) enBase.set(r.table_name, new Map());
      enBase.get(r.table_name)!.set(r.column_name, r);
    }

    const ecarts: string[] = [];
    const tablesAttendues = Object.values(snapshot.tables);

    for (const table of tablesAttendues) {
      const colonnesBase = enBase.get(table.name);
      if (!colonnesBase) {
        ecarts.push(`table absente de la base : ${table.name}`);
        continue;
      }
      for (const [nom, attendue] of Object.entries(table.columns)) {
        const reelle = colonnesBase.get(nom);
        if (!reelle) {
          ecarts.push(`${table.name}.${nom} : colonne absente de la base`);
          continue;
        }
        if (reelle.data_type !== attendue.type) {
          ecarts.push(`${table.name}.${nom} : type ${reelle.data_type} ≠ ${attendue.type}`);
        }
        if ((reelle.is_nullable === 'NO') !== attendue.notNull) {
          ecarts.push(`${table.name}.${nom} : nullabilité différente`);
        }
        const defautReel = normaliserDefaut(reelle.column_default);
        const defautAttendu = normaliserDefaut(attendue.default);
        if (defautReel !== defautAttendu) {
          ecarts.push(`${table.name}.${nom} : défaut ${defautReel} ≠ ${defautAttendu}`);
        }
      }
      for (const nom of colonnesBase.keys()) {
        if (!table.columns[nom]) ecarts.push(`${table.name}.${nom} : colonne absente du snapshot`);
      }
    }

    const nomsAttendus = new Set(tablesAttendues.map((t) => t.name));
    for (const nom of enBase.keys()) {
      if (!nomsAttendus.has(nom)) ecarts.push(`table absente du snapshot : ${nom}`);
    }

    assert.deepEqual(ecarts, [], `Dérive détectée entre migrations et schéma :\n${ecarts.join('\n')}`);
  } finally {
    await base.stop();
  }
});
