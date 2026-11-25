// Profil du compte : initiales de l'avatar, et libellés des sections dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initiales } from '../src/lib/profil.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('les initiales viennent du prénom et du nom, sinon du nom affiché', () => {
  assert.equal(initiales('Awa', 'Mba', null), 'AM');
  assert.equal(initiales(null, null, 'Awa Mba'), 'AM');
  assert.equal(initiales('  awa ', 'mba', null), 'AM');
  assert.equal(initiales(null, null, null), '?');
});

test('les libellés du profil existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['profil.bonjour', 'profil.section.achats', 'profil.section.compte', 'profil.section.communication', 'profil.section.preferences', 'profil.infos', 'profil.dateNaissance', 'profil.conditions', 'profil.commandes', 'profil.listes', 'profil.reclamations', 'profil.adresses', 'profil.motDePasse', 'profil.messages', 'profil.deconnexion'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
