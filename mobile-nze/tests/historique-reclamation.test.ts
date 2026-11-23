// Historique de dossier : libellés d'action et résumé des détails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';
import { ACTIONS_CONNUES, cleAction, resumeDetails } from '../src/lib/historique-reclamation.ts';

test('chaque action connue a un libellé dans les quatre langues', () => {
  for (const action of ACTIONS_CONNUES) {
    for (const langue of ['fr', 'en', 'ar', 'zh-Hans'] as const) {
      const table = (dictionnaire as unknown as Record<string, Record<string, string>>)[langue];
      assert.ok(table[cleAction(action)], `${langue}:${cleAction(action)} absent`);
    }
  }
});

test('une action inconnue reçoit le libellé générique', () => {
  assert.equal(cleAction('ACTION_NOUVELLE'), 'historique.actionInconnue');
});

test('la note ou le motif est affiché ; les détails vides ne donnent rien', () => {
  assert.equal(resumeDetails({ texte: '  Client rappelé  ' }), 'Client rappelé');
  assert.equal(resumeDetails({ motif: 'Hors délai' }), 'Hors délai');
  assert.equal(resumeDetails({ texte: '   ', motif: 'Motif' }), 'Motif');
  assert.equal(resumeDetails(null), null);
  assert.equal(resumeDetails(['x']), null);
  assert.equal(resumeDetails({ solution: 'REMPLACEMENT' }), null);
});
