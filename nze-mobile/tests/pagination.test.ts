// Pagination du catalogue : fin de liste détectée, pas de doublon à l'affichage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionnerPages, TAILLE_PAGE, uneSuiteExiste } from '../src/lib/pagination.ts';

test('une page pleine annonce une suite, une page incomplète marque la fin', () => {
  assert.equal(uneSuiteExiste(TAILLE_PAGE, TAILLE_PAGE), true);
  assert.equal(uneSuiteExiste(TAILLE_PAGE - 1, TAILLE_PAGE), false);
  assert.equal(uneSuiteExiste(0, TAILLE_PAGE), false);
});

test('la fusion garde l’ordre des pages et n’affiche pas deux fois un article', () => {
  const premiere = [{ id: 'a' }, { id: 'b' }];
  const suivante = [{ id: 'b' }, { id: 'c' }];
  assert.deepEqual(fusionnerPages(premiere, suivante).map((p) => p.id), ['a', 'b', 'c']);
});

test('fusionner une page vide ne change rien', () => {
  const liste = [{ id: 'a' }];
  assert.deepEqual(fusionnerPages(liste, []), liste);
});

test('rafraîchir le fil garde les messages plus anciens chargés et ajoute les nouveaux', async () => {
  const { rafraichirFil } = await import('../src/lib/pagination.ts');
  const m = (n: number) => ({ id: `m${n}`, createdAt: new Date(Date.UTC(2026, 10, 16, 10, n)).toISOString() });
  // Chargés : les 3 plus récents (5, 6, 7) puis une page plus ancienne (2, 3, 4). Un message 8 arrive ensuite.
  const actuels = [m(2), m(3), m(4), m(5), m(6), m(7)];
  const derniere = [m(6), m(7), m(8)];
  const resultat = rafraichirFil(actuels, derniere).map((x) => x.id);
  assert.deepEqual(resultat, ['m2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']);
});

test('rafraîchir le fil sans messages chargés renvoie la dernière page', async () => {
  const { rafraichirFil } = await import('../src/lib/pagination.ts');
  const m = (n: number) => ({ id: `m${n}`, createdAt: new Date(Date.UTC(2026, 10, 16, 10, n)).toISOString() });
  assert.deepEqual(rafraichirFil([], [m(1), m(2)]).map((x) => x.id), ['m1', 'm2']);
});
