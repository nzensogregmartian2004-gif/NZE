// Réclamations : règles d'affichage côté mobile (la solution pour un article est toujours le remplacement).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estAdministration, LIBELLE_STATUT, MOTIFS, SOLUTION_ARTICLE, STATUTS } from '../src/lib/reclamations.ts';

test('la solution proposée pour un article est le remplacement', () => {
  assert.equal(SOLUTION_ARTICLE, 'REMPLACEMENT');
});

test('chaque motif et chaque statut a un libellé traduisible', () => {
  for (const statut of STATUTS) assert.ok(LIBELLE_STATUT[statut], `libellé manquant pour ${statut}`);
  assert.ok(MOTIFS.length >= 5);
});

test('seuls les rôles d’administration accèdent aux vues internes', () => {
  assert.equal(estAdministration('admin_principal'), true);
  assert.equal(estAdministration('client'), false);
  assert.equal(estAdministration(undefined), false);
});
