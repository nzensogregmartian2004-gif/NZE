// Suivi de livraison : avancement et libellés présents dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancement, ETAPES_SUIVI } from '../src/lib/suivi-livraison.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';
import { CLES_SUIVI } from '../src/lib/suivi-commande.ts';

test('l’avancement suit les étapes, et la distance affine la progression pendant la livraison', () => {
  assert.equal(avancement(null, null), 0);
  assert.equal(avancement('CONFIRMEE', null), 0);
  assert.equal(avancement('PRETE', null), 0.5);
  assert.equal(avancement('EN_LIVRAISON', null), 0.75);
  assert.equal(avancement('LIVREE', null), 1);
  assert.ok(avancement('EN_LIVRAISON', 1500) > avancement('EN_LIVRAISON', 2000), 'plus le livreur est proche, plus la barre avance');
  assert.ok(avancement('EN_LIVRAISON', 0) <= 0.95, 'la barre n’atteint 100 % qu’à la livraison');
  assert.equal(avancement('EN_LIVRAISON', 5000), 0.75, 'au-delà de 2 km, la barre reste à l’étape');
});

test('chaque étape a un libellé, présent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = [...ETAPES_SUIVI.map((e) => CLES_SUIVI[e]), 'livraison.suivi.titre', 'livraison.suivi.distance', 'livraison.suivi.attente'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
