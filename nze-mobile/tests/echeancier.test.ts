// Échéancier : chaque statut de mois a un libellé, et chaque clé de la vue commerçant existe dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';
import { CLES_STATUT_MOIS } from '../src/lib/echeancier.ts';

const table = dictionnaire as unknown as Record<string, Record<string, string>>;
const CLES_COMMERCANT = ['partHist.onglet.echeances', 'partHist.ech.encaisse', 'partHist.ech.attendu', 'partHist.ech.mois', 'echeancier.titre', 'echeancier.voir', 'echeancier.article', 'echeancier.mois', 'echeancier.du', 'echeancier.paye', 'echeancier.penalite', 'echeancier.erreur', 'echeancier.resteMois'];

test('chaque statut de mois renvoyé par l’API a un libellé', () => {
  for (const statut of ['VALIDE', 'PARTIEL', 'EN_RETARD', 'A_VENIR']) assert.ok(CLES_STATUT_MOIS[statut], `statut sans libellé : ${statut}`);
});

test('chaque libellé de l’échéancier existe dans les quatre langues', () => {
  const cles = [...Object.values(CLES_STATUT_MOIS), ...CLES_COMMERCANT];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
