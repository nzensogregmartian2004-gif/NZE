// Adresses précises : consentement, aperçu et repérage, dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('les libellés de la position et du repérage existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['adresses.consentementTitre', 'adresses.consentement', 'adresses.autoriser', 'adresses.apercu', 'adresses.batiment', 'adresses.etage', 'adresses.instructions'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
