// Échéancier par article : durée et avance propres à chaque article, échéance de base = reste ÷ durée (arrondi au franc
// supérieur, le dernier mois absorbe l'arrondi), conditions affichées avant confirmation, pénalité réglable.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let secondaire: Session;
let client: Session;
let entreprise: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  secondaire = await connecter(ctx, '+24101000002');
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  client = await connecter(ctx, '+24174960001');
  const activation = await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: true } });
  assert.equal(activation.status, 200);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const parametrer = (id: string, corps: Record<string, unknown>) =>
  api(ctx, 'PATCH', `/admin/produits/${id}/echelonnable`, { token: admin.token, body: corps });

test('deux articles échelonnés dans un même panier gardent chacun leurs conditions', async () => {
  const a = await produitAvecMagasin(ctx, admin, entreprise, 'Article échelonné A', 10000);
  const b = await produitAvecMagasin(ctx, admin, entreprise, 'Article échelonné B', 20000);
  assert.equal((await parametrer(a.id, { echelonnable: true, dureeMois: 3 })).status, 200);
  const pb = await parametrer(b.id, { echelonnable: true, dureeMois: 6, avancePourcent: 20 });
  assert.equal(pb.status, 200, JSON.stringify(pb.body));
  assert.equal(pb.body.dureeMois, 6);
  assert.equal(pb.body.avancePourcent, 20);

  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: a.id, quantite: 1 }, { produitId: b.id, quantite: 1 }], reception: 'RETRAIT' } });
  const conditions = await api(ctx, 'GET', `/commandes/${c.body.id}/echelonnement/conditions`, { token: client.token });
  assert.equal(conditions.status, 200, JSON.stringify(conditions.body));
  const [ca, cb] = conditions.body.articles;
  // Article A : 40 % par défaut, 3 mois. 10 000 → avance 4 000, reste 6 000, 2 000 par mois.
  assert.deepEqual([ca.avanceFcfa, ca.resteFcfa, ca.dureeMois, ca.mensualiteFcfa, ca.dernierMoisFcfa], [4000, 6000, 3, 2000, 2000]);
  // Article B : 20 %, 6 mois. 20 000 → avance 4 000, reste 16 000 ; 16 000 ÷ 6 = 2 666,67 → 2 667 ; dernier mois 2 665.
  assert.deepEqual([cb.avancePourcent, cb.avanceFcfa, cb.resteFcfa, cb.dureeMois, cb.mensualiteFcfa, cb.dernierMoisFcfa], [20, 4000, 16000, 6, 2667, 2665]);
  assert.equal(cb.mensualiteFcfa * 5 + cb.dernierMoisFcfa, cb.resteFcfa, 'les mensualités additionnées donnent le reste exact');
  assert.equal(conditions.body.penaliteParMoisFcfa, 10000);
  assert.equal(conditions.body.resteFcfa, 22000);
  assert.equal(conditions.body.avanceFcfa, 8000 + conditions.body.livraisonFcfa);

  const plan = await api(ctx, 'POST', `/commandes/${c.body.id}/echelonnement`, { token: client.token, body: {} });
  assert.equal(plan.status, 201, JSON.stringify(plan.body));
  const lignes = await sql<{ prix_fcfa: number; reste_fcfa: number; duree_mois: number }>(ctx,
    'select prix_fcfa, reste_fcfa, duree_mois from echeanciers_articles where plan_id = $1 order by prix_fcfa', [plan.body.id]);
  assert.deepEqual(lignes.map((l) => [l.prix_fcfa, l.reste_fcfa, l.duree_mois]), [[10000, 6000, 3], [20000, 16000, 6]], 'un échéancier par article');
});

test('une durée est obligatoire pour un article échelonnable, et reste dans les bornes', async () => {
  const sans = await produitAvecMagasin(ctx, admin, entreprise, 'Article sans durée', 5000);
  assert.equal((await parametrer(sans.id, { echelonnable: true })).status, 400, 'pas d’activation sans durée');
  assert.equal((await parametrer(sans.id, { echelonnable: true, dureeMois: 13 })).status, 400, 'durée au-delà de 12 mois');
  assert.equal((await parametrer(sans.id, { echelonnable: true, dureeMois: 3, avancePourcent: 5 })).status, 400, 'avance sous 10 %');
});

test('la pénalité mensuelle est réglée par l’administration : 10 000 FCFA par défaut, modifiable par le principal seul', async () => {
  const lecture = await api(ctx, 'GET', '/admin/reglages/echelonnement/penalite', { token: admin.token });
  assert.deepEqual(lecture.body, { penaliteParMoisFcfa: 10000 });
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement/penalite', { token: secondaire.token, body: { penaliteParMoisFcfa: 15000 } })).status, 403);
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement/penalite', { token: admin.token, body: { penaliteParMoisFcfa: 200000 } })).status, 400);
  const ok = await api(ctx, 'PUT', '/admin/reglages/echelonnement/penalite', { token: admin.token, body: { penaliteParMoisFcfa: 15000 } });
  assert.equal(ok.status, 200);
  assert.deepEqual((await api(ctx, 'GET', '/admin/reglages/echelonnement/penalite', { token: admin.token })).body, { penaliteParMoisFcfa: 15000 });
  await api(ctx, 'PUT', '/admin/reglages/echelonnement/penalite', { token: admin.token, body: { penaliteParMoisFcfa: 10000 } });
});
