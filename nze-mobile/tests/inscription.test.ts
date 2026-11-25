// Inscription : date de naissance valide, et libellés présents dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateNaissanceValide } from '../src/lib/inscription.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('une date de naissance réelle et passée est acceptée', () => {
  assert.equal(dateNaissanceValide('1990-04-12', new Date('2026-11-24T10:00:00Z')), true);
});

test('une date mal formée, inexistante ou future est refusée', () => {
  const maintenant = new Date('2026-11-24T10:00:00Z');
  assert.equal(dateNaissanceValide('12/04/1990', maintenant), false);
  assert.equal(dateNaissanceValide('1990-02-30', maintenant), false);
  assert.equal(dateNaissanceValide('2999-01-01', maintenant), false);
  assert.equal(dateNaissanceValide('', maintenant), false);
});

test('les libellés de l’inscription existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['inscription.prenom', 'inscription.dateNaissance', 'inscription.dateInvalide', 'inscription.accepteConditions', 'inscription.lireConditions'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
