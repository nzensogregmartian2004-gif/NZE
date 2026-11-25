// Marque et modèle des articles : libellés présents dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('les libellés marque et modèle existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of ['admin.marque', 'admin.modele']) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
