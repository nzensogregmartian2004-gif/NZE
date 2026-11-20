// Espace partenaire, phase 1 (décision D-P10) : signalement de stock — ventes physiques, ruptures, retours, variations (cahier V3.0 §10.1).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let partenaireA: Session;
let partenaireB: Session;
let client: Session;
let produitId: string;

const dispoDe = async (token: string, id: string) =>
  ((await api(ctx, 'GET', '/partenaire/produits', { token })).body as Array<{ id: string; disponible: number }>).find((p) => p.id === id)!.disponible;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001', 'admin_principal');
  const jeu = await jeuDeDonnees(ctx, admin);
  produitId = (await produitAvecMagasin(ctx, admin, jeu.entreprise.id, 'Chargeur signalement', 5000)).id;
  await api(ctx, 'POST', `/admin/produits/${produitId}/ajustements`, { token: admin.token, body: { delta: 10, motif: 'Stock initial de test' } });
  const autre = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Autre commerçant' } })).body.id;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600021', entrepriseId: jeu.entreprise.id, motDePasse: 'motdepasse-test' } });
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600022', entrepriseId: autre, motDePasse: 'motdepasse-test' } });
  partenaireA = await connecter(ctx, '+24176600021');
  partenaireB = await connecter(ctx, '+24176600022');
  client = await connecter(ctx, '+24174600170');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('une vente physique signalée réduit le disponible et apparaît dans l’historique', async () => {
  const avant = await dispoDe(partenaireA.token, produitId);
  const r = await api(ctx, 'POST', '/partenaire/signalements', { token: partenaireA.token, body: { produitId, genre: 'VENTE', quantite: 3 } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(await dispoDe(partenaireA.token, produitId), avant - 3);
  const mouvements = (await api(ctx, 'GET', '/partenaire/mouvements-stock', { token: partenaireA.token })).body as Array<{ delta: number }>;
  assert.ok(mouvements.some((m) => m.delta === -3));
});

test('un retour augmente le disponible', async () => {
  const avant = await dispoDe(partenaireA.token, produitId);
  assert.equal((await api(ctx, 'POST', '/partenaire/signalements', { token: partenaireA.token, body: { produitId, genre: 'RETOUR', quantite: 2 } })).status, 201);
  assert.equal(await dispoDe(partenaireA.token, produitId), avant + 2);
});

test('une rupture ramène le disponible à zéro', async () => {
  assert.equal((await api(ctx, 'POST', '/partenaire/signalements', { token: partenaireA.token, body: { produitId, genre: 'RUPTURE', quantite: 0 } })).status, 201);
  assert.equal(await dispoDe(partenaireA.token, produitId), 0);
});

test('une vente au-delà du stock est refusée : le stock ne devient pas négatif', async () => {
  const r = await api(ctx, 'POST', '/partenaire/signalements', { token: partenaireA.token, body: { produitId, genre: 'VENTE', quantite: 1 } });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(await dispoDe(partenaireA.token, produitId), 0);
});

test('un partenaire ne signale pas le stock d’une autre entreprise', async () => {
  const r = await api(ctx, 'POST', '/partenaire/signalements', { token: partenaireB.token, body: { produitId, genre: 'RETOUR', quantite: 1 } });
  assert.equal(r.status, 404);
});

test('un client ne signale aucun stock', async () => {
  assert.equal((await api(ctx, 'POST', '/partenaire/signalements', { token: client.token, body: { produitId, genre: 'VENTE', quantite: 1 } })).status, 403);
});

test('le partenaire voit l’état du stock de ses articles, tel que fixé par NZE', async () => {
  await api(ctx, 'PATCH', `/admin/produits/${produitId}/etat-stock`, { token: admin.token, body: { etat: 'INDISPONIBLE', motif: 'Vérification en magasin' } });
  const liste = (await api(ctx, 'GET', '/partenaire/produits', { token: partenaireA.token })).body as Array<{ id: string; etat: string }>;
  assert.equal(liste.find((p) => p.id === produitId)!.etat, 'INDISPONIBLE');
});
