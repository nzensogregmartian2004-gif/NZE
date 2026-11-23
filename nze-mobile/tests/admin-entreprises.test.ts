// Saisie des écrans d'administration : taux, dates, libellés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleEtat, dateVersIso, pourcentageVersBps } from '../src/lib/admin-entreprises.ts';

test('un pourcentage se convertit en points de base, virgule ou point', () => {
  assert.equal(pourcentageVersBps('10'), 1000);
  assert.equal(pourcentageVersBps('12,5'), 1250);
  assert.equal(pourcentageVersBps(' 7.25 '), 725);
});

test('un pourcentage hors de 0 à 100 ou mal formé est refusé', () => {
  assert.equal(pourcentageVersBps('101'), null);
  assert.equal(pourcentageVersBps('-1'), null);
  assert.equal(pourcentageVersBps('abc'), null);
  assert.equal(pourcentageVersBps('1.234'), null);
});

test('une date AAAA-MM-JJ devient un instant UTC, les dates inexistantes sont refusées', () => {
  assert.equal(dateVersIso('2026-06-01'), '2026-06-01T00:00:00.000Z');
  assert.equal(dateVersIso('2026-02-30'), null);
  assert.equal(dateVersIso('01/06/2026'), null);
});

test('chaque état du stock a une clé de traduction', () => {
  assert.equal(cleEtat('INDISPONIBLE'), 'etat.INDISPONIBLE');
  assert.equal(cleEtat('AUTRE'), 'AUTRE');
});
