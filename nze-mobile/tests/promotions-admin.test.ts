// Promotions (administration) : statut d'une promotion, contrôle des saisies, libellés dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jourValide, pourcentageValide, periodeValide, statutPromotion } from '../src/lib/promotions-admin.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('le statut suit la période : à venir, en cours, terminée', () => {
  const maintenant = new Date('2026-11-25T10:00:00+01:00');
  assert.equal(statutPromotion('2026-12-01', '2026-12-10', maintenant), 'A_VENIR');
  assert.equal(statutPromotion('2026-11-20', '2026-11-30', maintenant), 'EN_COURS');
  assert.equal(statutPromotion('2026-11-01', '2026-11-24', maintenant), 'TERMINEE');
});

test('les saisies sont contrôlées : date réelle, période ordonnée, pourcentage entre 1 et 90', () => {
  assert.equal(jourValide('2026-02-30'), false);
  assert.equal(jourValide('25/11/2026'), false);
  assert.equal(periodeValide('2026-11-25', '2026-11-20'), false);
  assert.equal(periodeValide('2026-11-25', '2026-11-25'), true);
  assert.equal(pourcentageValide('0'), false);
  assert.equal(pourcentageValide('90'), true);
  assert.equal(pourcentageValide('91'), false);
  assert.equal(pourcentageValide('abc'), false);
});

test('les libellés de la gestion des promotions existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['onglets.promotions', 'admin.promo.nouvelle', 'admin.promo.liste', 'admin.promo.article', 'admin.promo.libelle', 'admin.promo.pourcentage', 'admin.promo.debut', 'admin.promo.fin', 'admin.promo.creer', 'admin.promo.creee', 'admin.promo.arreter', 'admin.promo.supprimer', 'admin.promo.enCours', 'admin.promo.aVenir', 'admin.promo.terminee', 'admin.promo.invalide', 'admin.promo.vide'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
