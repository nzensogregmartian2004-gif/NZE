// Accueil : une seule offre par article (la plus forte réduction), et libellés dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promotionParProduit, type Promotion } from '../src/lib/promotions.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

const offre = (id: string, produitId: string, pourcentage: number): Promotion => ({
  id, titre: 'Top offre', pourcentage, produitId, produitNom: 'Article', prixAvantFcfa: 10000, prixApresFcfa: 10000 - (10000 * pourcentage) / 100,
});

test('quand deux offres visent le même article, la plus forte réduction est gardée', () => {
  const carte = promotionParProduit([offre('a', 'p1', 10), offre('b', 'p1', 25), offre('c', 'p2', 5)]);
  assert.equal(carte.get('p1')?.id, 'b');
  assert.equal(carte.get('p2')?.id, 'c');
  assert.equal(carte.size, 2);
});

test('les libellés de l’accueil existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['accueil.localisation', 'accueil.offres', 'accueil.topOffre', 'accueil.reduction'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
