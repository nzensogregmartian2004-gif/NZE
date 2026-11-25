// Accueil sans compte : les libellés de l'invitation à se connecter existent dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('les libellés de l’invitation à se connecter existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['auth.requise.connexion', 'auth.requise.inscription', 'auth.requise.panier', 'auth.requise.messages', 'auth.requise.profil'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
