// Suivi de commande : chaque étape renvoyée par l'API a un libellé dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';
import { CLES_SUIVI } from '../src/lib/suivi-commande.ts';

const table = dictionnaire as unknown as Record<string, Record<string, string>>;

test('chaque étape du suivi renvoyée par l’API a un libellé', () => {
  for (const etape of ['CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE']) {
    assert.ok(CLES_SUIVI[etape], `étape sans libellé : ${etape}`);
  }
});

test('chaque libellé du suivi existe dans les quatre langues', () => {
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of Object.values(CLES_SUIVI)) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
