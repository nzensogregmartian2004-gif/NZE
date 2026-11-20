// Vue commerçant (lecture seule) : chaque partenaire voit les paiements échelonnés de SES articles, sans identité de client.
// Le client voit l'identifiant de son plan dans sa commande.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, MDP_TEST, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let partenaire: Session;
let autre: Session;
let produit: { id: string };
let planId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176990001', entrepriseId: entreprise, motDePasse: MDP_TEST } });
  partenaire = await connecter(ctx, '+24176990001');
  const autreEntreprise = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Autre commerçant vue' } })).body.id;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176990002', entrepriseId: autreEntreprise, motDePasse: MDP_TEST } });
  autre = await connecter(ctx, '+24176990002');
  client = await connecter(ctx, '+24174990001');
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: true } })).status, 200);
  produit = await produitAvecMagasin(ctx, admin, entreprise, 'Article commerçant', 10000);
  assert.equal((await api(ctx, 'PATCH', `/admin/produits/${produit.id}/echelonnable`, { token: admin.token, body: { echelonnable: true, dureeMois: 3 } })).status, 200);

  // Un client règle l'avance (4 000) puis verse 2 000 sur le premier mois.
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  const plan = await api(ctx, 'POST', `/commandes/${c.body.id}/echelonnement`, { token: client.token, body: {} });
  planId = plan.body.id;
  const av = await api(ctx, 'POST', `/echelonnements/${planId}/avance`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074990001' } });
  await encaisser(av.body.transactionId);
  const [a] = await sql<{ id: string }>(ctx, 'select id from echeanciers_articles where plan_id = $1', [planId]);
  const v = await api(ctx, 'POST', `/echelonnements/${planId}/versements`, { token: client.token, body: { montantFcfa: 2000, echeancierId: a.id, canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074990001' } });
  await encaisser(v.body.transactionId);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

async function encaisser(transactionId: string) {
  const [t] = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where id = $1', [transactionId]);
  ctx.mypvit.state.statusOverride.set(t.r, { status: 'SUCCESS' });
  const r = await api(ctx, 'GET', `/echelonnements/${planId}/verifier-paiement`, { token: client.token });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}

test('le commerçant voit sa part encaissée et à verser, et l’état des mois de chaque article', async () => {
  const vue = await api(ctx, 'GET', '/partenaire/echelonnements', { token: partenaire.token });
  assert.equal(vue.status, 200);
  const plan = vue.body.find((p: { articles: { produitId: string }[] }) => p.articles.some((a) => a.produitId === produit.id));
  assert.ok(plan, 'le plan de l’article figure dans la vue du commerçant');
  // Part du commerçant : 8 500 au total ; 5 100 encaissés (avance 4 000 + versement 2 000, après commission) ; 3 400 à verser.
  assert.equal(plan.commercantEncaisseFcfa, 5100);
  assert.equal(plan.commercantAVerserFcfa, 3400);
  const article = plan.echeancesArticles.find((a: { nom: string }) => a.nom === 'Article commerçant');
  assert.equal(article.principalRestantFcfa, 4000);
  assert.equal(article.moisValides, 1);
  assert.equal(article.moisPartiels, 0);
  assert.equal(article.moisEnRetard, 0);
});

test('la vue ne montre aucune identité de client, ni les pénalités, et reste limitée à son magasin', async () => {
  const vue = await api(ctx, 'GET', '/partenaire/echelonnements', { token: partenaire.token });
  const texte = JSON.stringify(vue.body);
  assert.ok(!texte.includes('+24174990001'), 'pas de numéro de client');
  assert.ok(!texte.includes('clientId'), 'pas d’identifiant de client');
  assert.ok(!texte.includes('penalit'), 'pas de pénalité');
  const autreVue = await api(ctx, 'GET', '/partenaire/echelonnements', { token: autre.token });
  assert.equal(autreVue.body.some((p: { articles: { produitId: string }[] }) => p.articles.some((a) => a.produitId === produit.id)), false, 'un autre commerçant ne voit pas cet article');
});

test('le client retrouve l’identifiant de son plan dans le détail de sa commande', async () => {
  const [c] = await sql<{ id: string }>(ctx, 'select commande_id as id from plans_echelonnes where id = $1', [planId]);
  const detail = await api(ctx, 'GET', `/commandes/${c.id}`, { token: client.token });
  assert.equal(detail.body.echelonnementId, planId);
});
