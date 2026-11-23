// Règles du paiement échelonné (décisions du fondateur). Tests purs, sans base de données.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterMois, moisEcoules, proposerPlan, situation, ventiler, verifierParametres, verifierVersement } from '../src/modules/echelonnement/regles.ts';

const DEBUT = new Date(Date.UTC(2026, 10, 2)); // 2 novembre 2026

test('avance de 40 % arrondie au supérieur, reste sur 3 mois au maximum', () => {
  const p = proposerPlan(50000, 2, 10000);
  assert.equal(p.avanceFcfa, 20000);
  assert.equal(p.resteFcfa, 30000);
  assert.equal(p.mensualiteMinFcfa, 10000);
  assert.equal(p.dureeMois, 3);
  const q = proposerPlan(1001, 1, 600);
  assert.equal(q.avanceFcfa, 401, 'arrondi au supérieur');
  assert.equal(q.resteFcfa, 600);
  assert.equal(q.dureeMois, 1);
});

test('une mensualité trop faible est refusée : le reste doit être réglé en 3 mois au plus', () => {
  assert.throws(() => proposerPlan(50000, 2, 9000), /au moins 10000 FCFA/);
});

test('tout régler en un mois est permis ; une mensualité au-delà du reste est refusée', () => {
  assert.equal(proposerPlan(50000, 1, 30000).dureeMois, 1);
  assert.throws(() => proposerPlan(50000, 1, 30001), /ne peut pas dépasser/);
});

test('au maximum 5 articles par paiement échelonné', () => {
  assert.equal(proposerPlan(50000, 5, 10000).mensualiteFcfa, 10000);
  assert.throws(() => proposerPlan(50000, 6, 10000), /maximum 5 articles/);
});

test('un versement libre dépassant le reste à payer est refusé', () => {
  verifierVersement(30000, 30000);
  assert.throws(() => verifierVersement(30000, 30001), /dépasse le reste/);
  assert.throws(() => verifierVersement(30000, 0), /invalide/);
});

test('exemple du fondateur : 20 000 par mois, une avance de 10 000 laisse 10 000 pour ce mois', () => {
  // Commande de 100 000 : avance 40 000, reste 60 000, soit 3 mensualités de 20 000.
  const s = situation({ resteInitialFcfa: 60000, mensualiteFcfa: 20000, dateDebut: DEBUT, maintenant: DEBUT, versements: [{ montantFcfa: 10000, date: DEBUT }] });
  assert.equal(s.dueCetteEcheanceFcfa, 10000);
  assert.equal(s.restantFcfa, 50000);
  assert.equal(s.moisRestants, 3);
  assert.deepEqual(s.echeances.map((e) => e.montantFcfa), [10000, 20000, 20000]);
});

test('exemple du fondateur : 40 000 versés d’un coup laissent 20 000 et un seul mois restant', () => {
  const s = situation({ resteInitialFcfa: 60000, mensualiteFcfa: 20000, dateDebut: DEBUT, maintenant: DEBUT, versements: [{ montantFcfa: 40000, date: DEBUT }] });
  assert.equal(s.dueCetteEcheanceFcfa, 0, 'rien à payer ce mois');
  assert.equal(s.restantFcfa, 20000);
  assert.equal(s.moisRestants, 1);
  assert.deepEqual(s.echeances.map((e) => e.montantFcfa), [20000]);
  assert.equal(s.echeances[0].date.getUTCMonth(), DEBUT.getUTCMonth() + 1, 'échéance le mois suivant');
});

test('solde atteint : plus aucune échéance', () => {
  const s = situation({ resteInitialFcfa: 60000, mensualiteFcfa: 20000, dateDebut: DEBUT, maintenant: DEBUT, versements: [{ montantFcfa: 60000, date: DEBUT }] });
  assert.equal(s.restantFcfa, 0);
  assert.equal(s.moisRestants, 0);
  assert.deepEqual(s.echeances, []);
});

test('retard : signalé, mais sans pénalité ni blocage (le montant reste le même)', () => {
  const dans2Mois = new Date(Date.UTC(2027, 0, 5));
  const s = situation({ resteInitialFcfa: 60000, mensualiteFcfa: 20000, dateDebut: DEBUT, maintenant: dans2Mois, versements: [] });
  assert.equal(s.enRetard, true);
  assert.equal(s.restantFcfa, 60000, 'aucune majoration');
  assert.equal(s.dueCetteEcheanceFcfa, 60000, 'retard et échéance du mois regroupés');
});

test('à jour : pas de retard quand les mensualités précédentes sont réglées', () => {
  const dans1Mois = new Date(Date.UTC(2026, 11, 3));
  const s = situation({ resteInitialFcfa: 60000, mensualiteFcfa: 20000, dateDebut: DEBUT, maintenant: dans1Mois, versements: [{ montantFcfa: 20000, date: DEBUT }] });
  assert.equal(s.enRetard, false);
  assert.equal(s.dueCetteEcheanceFcfa, 20000);
});

test('calendrier : mois écoulés et dates des échéances', () => {
  assert.equal(moisEcoules(DEBUT, DEBUT), 0);
  assert.equal(moisEcoules(DEBUT, new Date(Date.UTC(2026, 11, 1))), 0, 'le 1er décembre, avant le 2 : encore le premier mois');
  assert.equal(moisEcoules(DEBUT, new Date(Date.UTC(2026, 11, 2))), 1);
  assert.equal(ajouterMois(new Date(Date.UTC(2026, 0, 31)), 1).getUTCDate(), 28, 'fin de mois respectée (2026 n’est pas bissextile)');
});

test('répartition de chaque encaissement : commerçant, commission et livraison, sans centime perdu', () => {
  const parts = { commercantFcfa: 80000, commissionFcfa: 10000, livraisonFcfa: 10000 };
  const avance = ventiler({ montantFcfa: 40000, cumulAvantFcfa: 0, totalFcfa: 100000, parts });
  assert.deepEqual(avance, { commercantFcfa: 32000, commissionFcfa: 4000, livraisonFcfa: 4000 });
  const solde = ventiler({ montantFcfa: 60000, cumulAvantFcfa: 40000, totalFcfa: 100000, parts });
  assert.equal(avance.commercantFcfa + solde.commercantFcfa, 80000);
  assert.equal(avance.commissionFcfa + solde.commissionFcfa, 10000);
  assert.equal(avance.livraisonFcfa + solde.livraisonFcfa, 10000);

  // Totaux impairs : la somme des parts égale toujours le montant encaissé.
  const impair = { commercantFcfa: 33, commissionFcfa: 33, livraisonFcfa: 34 };
  let cumul = 0;
  for (const m of [7, 40, 53]) {
    const v = ventiler({ montantFcfa: m, cumulAvantFcfa: cumul, totalFcfa: 100, parts: impair });
    assert.equal(v.commercantFcfa + v.commissionFcfa + v.livraisonFcfa, m);
    cumul += m;
  }
  assert.throws(() => ventiler({ montantFcfa: 10, cumulAvantFcfa: 0, totalFcfa: 100, parts: { commercantFcfa: 50, commissionFcfa: 10, livraisonFcfa: 10 } }), /ne correspondent pas/);
});

test('les réglages changent l’avance et la durée ; sans réglage, les valeurs initiales restent 40 % et 3 mois', () => {
  const reglage = { avancePourcent: 30, dureeMaxMois: 2 };
  const p = proposerPlan(50000, 1, 17500, reglage);
  assert.equal(p.avanceFcfa, 15000);
  assert.equal(p.resteFcfa, 35000);
  assert.equal(p.mensualiteMinFcfa, 17500);
  assert.throws(() => proposerPlan(50000, 1, 17499, reglage), /au moins 17500 FCFA pour régler le reste en 2 mois/);
  assert.equal(proposerPlan(50000, 1, 10000).avanceFcfa, 20000, 'valeur initiale : 40 %');
});

test('les réglages hors bornes ou non entiers sont refusés', () => {
  assert.throws(() => verifierParametres({ avancePourcent: 5, dureeMaxMois: 3 }));
  assert.throws(() => verifierParametres({ avancePourcent: 40, dureeMaxMois: 0 }));
  assert.throws(() => verifierParametres({ avancePourcent: 40.5, dureeMaxMois: 3 }));
  assert.throws(() => verifierParametres({ avancePourcent: 40, dureeMaxMois: 13 }));
  assert.deepEqual(verifierParametres({ avancePourcent: 50, dureeMaxMois: 6 }), { avancePourcent: 50, dureeMaxMois: 6 });
});
