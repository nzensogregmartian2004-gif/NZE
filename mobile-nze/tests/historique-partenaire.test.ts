// Historique partenaire : répartition du stock, et chaque statut renvoyé par l'API a un libellé dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';
import { CLES_STATUT_COLLECTE, CLES_STATUT_RETRAIT, enRupture, repartirStock } from '../src/lib/historique-partenaire.ts';

const table = dictionnaire as unknown as Record<string, Record<string, string>>;

test('un article sans quantité disponible est en rupture, les autres sont en stock', () => {
  assert.equal(enRupture(0), true);
  assert.equal(enRupture(null), true);
  assert.equal(enRupture(3), false);
  const { enStock, enRupture: rupture } = repartirStock([
    { id: 'a', disponible: 4 },
    { id: 'b', disponible: 0 },
    { id: 'c', disponible: null },
  ]);
  assert.deepEqual(enStock.map((p) => p.id), ['a']);
  assert.deepEqual(rupture.map((p) => p.id), ['b', 'c']);
});

test('tous les statuts de collecte renvoyés par l’API ont un libellé', () => {
  const statutsApi = ['ATTENTE_PARTENAIRE', 'ATTENTE_VALIDATION_NZE', 'CONTESTE', 'VALIDE', 'REFUSE', 'ANNULE'];
  for (const statut of statutsApi) assert.ok(CLES_STATUT_COLLECTE[statut], `statut de collecte sans libellé : ${statut}`);
});

test('tous les statuts de retrait renvoyés par l’API ont un libellé', () => {
  const statutsApi = ['EN_ATTENTE', 'VERSEMENT_EN_COURS', 'VERSEE', 'REJETEE', 'ECHEC'];
  for (const statut of statutsApi) assert.ok(CLES_STATUT_RETRAIT[statut], `statut de retrait sans libellé : ${statut}`);
});

test('chaque libellé de statut existe dans les quatre langues', () => {
  const cles = [...Object.values(CLES_STATUT_COLLECTE), ...Object.values(CLES_STATUT_RETRAIT), 'partHist.statutInconnu'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
