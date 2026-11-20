// Échéances mensuelles : versement affecté à un article, mois validés, partiels ou en retard, reste recalculé,
// clôture du plan, pénalités après le dernier mois tant qu'un solde reste dû (les pénalités sont payées après les mois).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';
import { appliquerPenalites } from '../src/modules/echelonnement/echeances.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produit: { id: string };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  client = await connecter(ctx, '+24174970001');
  const activation = await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: true } });
  assert.equal(activation.status, 200);
  produit = await produitAvecMagasin(ctx, admin, entreprise, 'Article mensuel', 10000);
  const p = await api(ctx, 'PATCH', `/admin/produits/${produit.id}/echelonnable`, { token: admin.token, body: { echelonnable: true, dureeMois: 3 } });
  assert.equal(p.status, 200, JSON.stringify(p.body));
});
after(async () => {
  await ctx.close();
  await base.stop();
});

// Crée un plan 3 mois sur l'article, puis règle l'avance (40 % de 10 000 = 4 000) : le plan devient actif.
async function planActif(): Promise<{ planId: string; echeancierId: string }> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  const plan = await api(ctx, 'POST', `/commandes/${c.body.id}/echelonnement`, { token: client.token, body: {} });
  assert.equal(plan.status, 201, JSON.stringify(plan.body));
  const planId = plan.body.id as string;
  const av = await api(ctx, 'POST', `/echelonnements/${planId}/avance`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074970001' } });
  assert.equal(av.status, 201, JSON.stringify(av.body));
  await issueEtEncaisse(planId, av.body.transactionId, 'verifier-paiement');
  const d = await detail(planId);
  return { planId, echeancierId: d.articles[0].echeancierId as string };
}

const detail = async (planId: string) => (await api(ctx, 'GET', `/echelonnements/${planId}/echeanciers`, { token: client.token })).body;

// Issue MyPVit pour une transaction donnée, puis vérification côté plan (encaissement).
async function issueEtEncaisse(planId: string, transactionId: string, _via: string) {
  const [t] = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where id = $1', [transactionId]);
  ctx.mypvit.state.statusOverride.set(t.r, { status: 'SUCCESS' });
  const v = await api(ctx, 'GET', `/echelonnements/${planId}/verifier-paiement`, { token: client.token });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v;
}

async function verser(planId: string, echeancierId: string, montant: number) {
  const r = await api(ctx, 'POST', `/echelonnements/${planId}/versements`, { token: client.token, body: { montantFcfa: montant, echeancierId, canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074970001' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  await issueEtEncaisse(planId, r.body.transactionId, 'verifier-paiement');
}

test('l’avance ouvre trois mensualités de 2 000 FCFA, chacune avec sa date limite', async () => {
  const { planId, echeancierId } = await planActif();
  const d = await detail(planId);
  assert.deepEqual(d.articles[0].mois.map((m: { montantDuFcfa: number }) => m.montantDuFcfa), [2000, 2000, 2000]);
  assert.ok(d.articles[0].mois.every((m: { dateLimite: string }) => m.dateLimite), 'chaque mois a une date limite');
  assert.equal(d.articles[0].mois[0].statut, 'A_VENIR');
  assert.ok(echeancierId);
});

test('un versement partiel est affecté au mois le plus ancien et le reste est recalculé sur les mois restants', async () => {
  const { planId, echeancierId } = await planActif();
  await verser(planId, echeancierId, 3000); // 2 000 pour le mois 1, 1 000 pour le mois 2
  const mois = (await detail(planId)).articles[0].mois;
  assert.deepEqual(mois.map((m: { statut: string }) => m.statut), ['VALIDE', 'PARTIEL', 'A_VENIR']);
  // Reste 3 000 réparti sur les deux mois non soldés : 1 500 chacun (le mois 2 a déjà reçu 1 000).
  assert.equal(mois[1].montantDuFcfa, 2500);
  assert.equal(mois[2].montantDuFcfa, 1500);
});

test('le plan se solde quand tous les mois sont validés et aucune pénalité ne reste due', async () => {
  const { planId, echeancierId } = await planActif();
  await verser(planId, echeancierId, 3000);
  await verser(planId, echeancierId, 1500); // mois 2 soldé
  await verser(planId, echeancierId, 1500); // mois 3 soldé
  const d = await detail(planId);
  assert.deepEqual(d.articles[0].mois.map((m: { statut: string }) => m.statut), ['VALIDE', 'VALIDE', 'VALIDE']);
  assert.equal(d.statut, 'SOLDE');
});

test('après le dernier mois, une pénalité par mois supplémentaire tant qu’un solde reste dû ; elle se règle après les mois', async () => {
  const { planId, echeancierId } = await planActif();
  const avant = (await detail(planId)).articles[0].mois;
  const derniere = new Date(avant[2].dateLimite);
  // Deux mois après la dernière date limite : deux pénalités de 10 000 FCFA.
  await appliquerPenalites(base.db, new Date(derniere.getTime() + 62 * 24 * 3600 * 1000));
  const apres = await detail(planId);
  assert.deepEqual(apres.articles[0].penalites.map((x: { montantFcfa: number }) => x.montantFcfa), [10000, 10000]);
  assert.equal(apres.articles[0].penalitesRestantesFcfa, 20000);
  // 26 000 : d'abord les 6 000 de mensualités restantes, puis 20 000 de pénalités.
  await verser(planId, echeancierId, 26000);
  const solde = await detail(planId);
  assert.equal(solde.articles[0].principalRestantFcfa, 0);
  assert.equal(solde.articles[0].penalitesRestantesFcfa, 0);
  assert.equal(solde.statut, 'SOLDE');
  void planId;
});
