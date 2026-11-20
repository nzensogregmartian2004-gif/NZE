// Calcul des frais de livraison : fonctions pures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMetres, fraisLivraison } from '../src/modules/livraisons/pricing.ts';
import { commissionOf } from '../src/core/money.ts';

test('distance à vol d’oiseau : un degré de latitude vaut environ 111 km', () => {
  const d = distanceMetres({ latitude: 0, longitude: 9 }, { latitude: 1, longitude: 9 });
  assert.ok(Math.abs(d - 111195) < 300, `distance obtenue : ${d}`);
});

test('frais : minimum appliqué sur les courtes distances, tarif au kilomètre ensuite', () => {
  const tarif = { fcfaParKm: 300, minimumFcfa: 500 };
  assert.equal(fraisLivraison(0, tarif), 500);
  assert.equal(fraisLivraison(1500, tarif), 500, '1,5 km × 300 = 450, ramené au minimum');
  assert.equal(fraisLivraison(5000, tarif), 1500);
  assert.equal(fraisLivraison(5100, tarif), 1530, 'arrondi au franc supérieur');
});

test('commission : arrondi au franc, taux en points de base', () => {
  assert.equal(commissionOf(10000, 1500), 1500);
  assert.equal(commissionOf(5000, 1500), 750);
  assert.equal(commissionOf(333, 1500), 50);
});
