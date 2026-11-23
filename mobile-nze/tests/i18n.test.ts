// Traductions : quatre langues complètes, variables cohérentes, clés utilisées présentes, détection de la langue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dictionnaire, LANGUES } from '../src/i18n/dictionnaire.ts';
import { detecterLangue } from '../src/i18n/detection.ts';
import { ETATS_STOCK, REGISTRES, STATUTS_ENTREPRISE } from '../src/lib/admin-entreprises.ts';

type Table = Record<string, Record<string, string>>;
const table = dictionnaire as unknown as Table;
const cles = (langue: string) => new Set(Object.keys(table[langue]));
const variables = (texte: string) => [...texte.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('chaque langue a exactement les mêmes clés que le français', () => {
  const fr = cles('fr');
  for (const langue of LANGUES) {
    const c = cles(langue);
    assert.deepEqual([...fr].filter((k) => !c.has(k)), [], `clés manquantes en ${langue}`);
    assert.deepEqual([...c].filter((k) => !fr.has(k)), [], `clés en trop en ${langue}`);
  }
});

test('aucun texte n’est vide et les variables {…} sont les mêmes dans toutes les langues', () => {
  for (const langue of LANGUES) {
    for (const [cle, valeur] of Object.entries(table[langue])) {
      assert.ok(valeur.trim().length > 0, `${langue}:${cle} est vide`);
      assert.equal(variables(valeur), variables(table.fr[cle]), `variables différentes pour ${langue}:${cle}`);
    }
  }
});

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(tsx?|ts)$/.test(nom) ? [chemin] : [];
  });
}

test('chaque clé passée à t(…) dans l’application existe dans le dictionnaire', () => {
  const racine = join(import.meta.dirname ?? '.', '..');
  const utilisees = new Set<string>();
  for (const dossier of ['app', 'src']) {
    for (const f of fichiers(join(racine, dossier))) {
      if (f.includes(`${join('src', 'i18n')}`)) continue;
      for (const m of readFileSync(f, 'utf-8').matchAll(/\bt\(\s*['"]([A-Za-z0-9_.\-]+)['"]/g)) utilisees.add(m[1]);
    }
  }
  assert.ok(utilisees.size > 100, `trop peu de clés détectées : ${utilisees.size}`);
  const manquantes = [...utilisees].filter((k) => !cles('fr').has(k));
  assert.deepEqual(manquantes, [], 'clés utilisées mais absentes du dictionnaire');
});

test('la langue du téléphone choisit la langue proposée au premier lancement', () => {
  assert.equal(detecterLangue('ar', 'ar-GA'), 'ar');
  assert.equal(detecterLangue('zh', 'zh-CN'), 'zh-Hans');
  assert.equal(detecterLangue('zh', 'zh-Hans-CN'), 'zh-Hans');
  assert.equal(detecterLangue('zh', 'zh-TW'), 'fr', 'le chinois traditionnel retombe sur le français');
  assert.equal(detecterLangue('en', 'en-US'), 'en');
  assert.equal(detecterLangue('fr', 'fr-GA'), 'fr');
  assert.equal(detecterLangue('de', 'de-DE'), 'fr', 'langue non prise en charge : français');
});

test('les libellés des écrans d’administration sont des clés existantes dans toutes les langues', () => {
  const attendues = [
    ...STATUTS_ENTREPRISE.map((x) => x.cle), ...ETATS_STOCK.map((x) => x.cle), ...REGISTRES.map((x) => x.cle),
    'collectesAdmin.statut.ATTENTE_PARTENAIRE', 'collectesAdmin.statut.ATTENTE_VALIDATION_NZE', 'collectesAdmin.statut.CONTESTE',
    'collectesAdmin.statut.VALIDE', 'collectesAdmin.statut.REFUSE', 'collectesAdmin.statut.ANNULE',
    'livreurCollectes.statut.ATTENTE_PARTENAIRE', 'livreurCollectes.statut.ATTENTE_VALIDATION_NZE', 'livreurCollectes.statut.CONTESTE',
    'livreurCollectes.statut.VALIDE', 'livreurCollectes.statut.REFUSE', 'livreurCollectes.statut.ANNULE',
    'onglets.collectes', 'onglets.entreprises', 'onglets.stock', 'onglets.registres', 'onglets.recuperations',
  ];
  for (const langue of LANGUES) {
    for (const cle of attendues) assert.ok(table[langue][cle], `${langue}:${cle} absente`);
  }
});
