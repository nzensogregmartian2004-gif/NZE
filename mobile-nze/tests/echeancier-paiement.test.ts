// Paiement d'une échéance : montant saisi (entier entre 1 et le reste de l'article) et reste à payer (mensualités + pénalités).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montantSaisi, restantArticle } from '../src/lib/echeancier-paiement.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('un montant entier entre 1 et le reste est accepté, espaces compris', () => {
  assert.equal(montantSaisi('12 000', 20000), 12000);
  assert.equal(montantSaisi('20000', 20000), 20000);
  assert.equal(montantSaisi('1', 20000), 1);
});

test('un montant vide, nul, décimal, non numérique ou au-delà du reste est refusé', () => {
  assert.equal(montantSaisi('', 20000), null);
  assert.equal(montantSaisi('0', 20000), null);
  assert.equal(montantSaisi('1.5', 20000), null);
  assert.equal(montantSaisi('abc', 20000), null);
  assert.equal(montantSaisi('20001', 20000), null);
  assert.equal(montantSaisi('-5', 20000), null);
});

test('le reste d’un article additionne mensualités et pénalités', () => {
  assert.equal(restantArticle({ principalRestantFcfa: 6000, penalitesRestantesFcfa: 20000 }), 26000);
  assert.equal(restantArticle({ principalRestantFcfa: 0, penalitesRestantesFcfa: 0 }), 0);
});

test('les nouveaux libellés du paiement existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['echeancier.payer.bouton', 'echeancier.payer.titre', 'echeancier.payer.article', 'echeancier.payer.reste', 'echeancier.payer.montant', 'echeancier.payer.montantInvalide', 'echeancier.payer.valider', 'echeancier.payer.attente', 'echeancier.payer.succes', 'echeancier.payer.nonConfirme', 'echeancier.payer.carteOuverte', 'echeancier.payer.soldeNul'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
