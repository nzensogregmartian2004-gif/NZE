// Parcours complet d'un paiement échelonné (base de test embarquée, mêmes migrations que la production) :
// avance, versement, retard détecté par la relance, rattrapage, clôture. Les alertes du commerçant et du client
// sont calculées article par article (O-31).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, MDP_TEST, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';
import { relancerEcheances } from '../src/modules/echelonnement/service.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let partenaire: Session;
let client: Session;
let produit: { id: string };
let planId: string;
let echeancierId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176970001', entrepriseId: entreprise, motDePasse: MDP_TEST } });
  partenaire = await connecter(ctx, '+24176970001');
  client = await connecter(ctx, '+24174970101');
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: true } })).status, 200);
  produit = await produitAvecMagasin(ctx, admin, entreprise, 'Article parcours', 10000);
  assert.equal((await api(ctx, 'PATCH', `/admin/produits/${produit.id}/echelonnable`, { token: admin.token, body: { echelonnable: true, dureeMois: 3 } })).status, 200);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

// Encaisse une transaction MyPVit (succès) puis vérifie le plan.
async function encaisser(transactionId: string) {
  const [t] = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where id = $1', [transactionId]);
  ctx.mypvit.state.statusOverride.set(t.r, { status: 'SUCCESS' });
  const r = await api(ctx, 'GET', `/echelonnements/${planId}/verifier-paiement`, { token: client.token });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}

async function verser(montant: number) {
  const r = await api(ctx, 'POST', `/echelonnements/${planId}/versements`, { token: client.token, body: { montantFcfa: montant, echeancierId, canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074970101' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  await encaisser(r.body.transactionId);
}

// Vue du commerçant : le plan qui contient son article.
async function vueCommercant() {
  const vue = await api(ctx, 'GET', '/partenaire/echelonnements', { token: partenaire.token });
  return vue.body.find((p: { articles: { produitId: string }[] }) => p.articles.some((a) => a.produitId === produit.id));
}

test('parcours complet : avance, versement, retard, relance, rattrapage et clôture', async () => {
  // 1. Achat et avance : 4 000 FCFA ; le plan devient actif et les trois mensualités de 2 000 FCFA sont ouvertes.
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  const plan = await api(ctx, 'POST', `/commandes/${c.body.id}/echelonnement`, { token: client.token, body: {} });
  planId = plan.body.id;
  const av = await api(ctx, 'POST', `/echelonnements/${planId}/avance`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074970101' } });
  assert.equal(av.status, 201, JSON.stringify(av.body));
  await encaisser(av.body.transactionId);
  const [a] = await sql<{ id: string }>(ctx, 'select id from echeanciers_articles where plan_id = $1', [planId]);
  echeancierId = a.id;

  let vue = await vueCommercant();
  assert.equal(vue.enRetard, false);
  assert.equal(vue.dueCetteEcheanceFcfa, 2000, 'à l’échéance : la première mensualité');
  assert.equal(vue.commercantEncaisseFcfa, 3400, 'le commerçant reçoit sa part de l’avance');

  // 2. Un versement de 2 000 FCFA valide le premier mois.
  await verser(2000);
  vue = await vueCommercant();
  assert.equal(vue.echeancesArticles[0].moisValides, 1);
  assert.equal(vue.dueCetteEcheanceFcfa, 2000, 'l’échéance suivante est due');

  // 3. Le deuxième mois passe sans solde : le commerçant voit le retard, et la relance prévient le client.
  await sql(ctx, "update echeances_mois set date_limite = now() - interval '2 days' where echeancier_id = $1 and numero = 2", [echeancierId]);
  await relancerEcheances(base.db, new Date());
  vue = await vueCommercant();
  assert.equal(vue.enRetard, true, 'le retard apparaît dans la vue du commerçant');
  const [mois2] = await sql<{ id: string }>(ctx, 'select id from echeances_mois where echeancier_id = $1 and numero = 2', [echeancierId]);
  const notifs = await sql<{ type: string }>(ctx, 'select type from notifications where destinataire_id = $1 and cible_id = $2', [client.id, mois2.id]);
  assert.deepEqual(notifs.map((n) => n.type), ['ECHEANCE_RETARD']);

  // 4. Rattrapage : 4 000 FCFA couvrent les deux mois restants ; le plan est soldé.
  await verser(4000);
  vue = await vueCommercant();
  assert.equal(vue.statut, 'SOLDE');
  assert.equal(vue.enRetard, false);
  assert.equal(vue.dueCetteEcheanceFcfa, 0);
  assert.equal(vue.commercantAVerserFcfa, 0, 'tout ce qui revient au commerçant est encaissé');
  assert.equal(vue.commercantEncaisseFcfa, vue.commercantTotalFcfa);
});

test('le client voit les mêmes alertes que le commerçant, calculées par article', async () => {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  const plan2 = await api(ctx, 'POST', `/commandes/${c.body.id}/echelonnement`, { token: client.token, body: {} });
  const id2 = plan2.body.id;
  const av = await api(ctx, 'POST', `/echelonnements/${id2}/avance`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074970101' } });
  const [t] = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where id = $1', [av.body.transactionId]);
  ctx.mypvit.state.statusOverride.set(t.r, { status: 'SUCCESS' });
  await api(ctx, 'GET', `/echelonnements/${id2}/verifier-paiement`, { token: client.token });
  await sql(ctx, "update echeances_mois set date_limite = now() - interval '2 days' where echeancier_id in (select id from echeanciers_articles where plan_id = $1) and numero = 1", [id2]);
  const moi = await api(ctx, 'GET', `/echelonnements/${id2}`, { token: client.token });
  assert.equal(moi.body.enRetard, true, 'le client voit le retard de son mois');
  assert.equal(moi.body.dueCetteEcheanceFcfa, 2000);
});

test('la liste d’administration signale le retard calculé par article (O-33)', async () => {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  const plan = await api(ctx, 'POST', `/commandes/${c.body.id}/echelonnement`, { token: client.token, body: {} });
  const id = plan.body.id;
  const av = await api(ctx, 'POST', `/echelonnements/${id}/avance`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074970101' } });
  const [tr] = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where id = $1', [av.body.transactionId]);
  ctx.mypvit.state.statusOverride.set(tr.r, { status: 'SUCCESS' });
  await api(ctx, 'GET', `/echelonnements/${id}/verifier-paiement`, { token: client.token });
  const aJour = await api(ctx, 'GET', '/admin/echelonnements?enRetard=false', { token: admin.token });
  assert.ok(aJour.body.some((x: { id: string }) => x.id === id), 'à jour : listé hors retard');
  await sql(ctx, "update echeances_mois set date_limite = now() - interval '2 days' where echeancier_id in (select id from echeanciers_articles where plan_id = $1) and numero = 1", [id]);
  const enRetard = await api(ctx, 'GET', '/admin/echelonnements?enRetard=true', { token: admin.token });
  assert.ok(enRetard.body.some((x: { id: string }) => x.id === id), 'en retard : listé dans le filtre retard');
});
