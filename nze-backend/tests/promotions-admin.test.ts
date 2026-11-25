// Gestion des promotions par l'administration : création, contrôles, arrêt, suppression, accès réservé.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produit: { id: string };
const jour = (decalage: number) => new Date(Date.now() + decalage * 86400000).toISOString().slice(0, 10);

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174990701');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  produit = await produitAvecMagasin(ctx, admin, entreprise, 'Article gestion promo', 10000);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('l’administration crée une promotion en cours, visible à l’accueil au prix après réduction', async () => {
  const r = await api(ctx, 'POST', '/admin/promotions', { token: admin.token, body: { produitId: produit.id, titre: 'Top offre Noël', pourcentage: 15, debut: jour(-1), fin: jour(5) } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const accueil = await api(ctx, 'GET', '/promotions');
  const offre = accueil.body.find((o: { id: string }) => o.id === r.body.id);
  assert.ok(offre, 'l’offre en cours est visible');
  assert.equal(offre.prixApresFcfa, 8500);
});

test('une promotion à venir n’apparaît pas à l’accueil', async () => {
  const r = await api(ctx, 'POST', '/admin/promotions', { token: admin.token, body: { produitId: produit.id, titre: 'Offre à venir', pourcentage: 10, debut: jour(10), fin: jour(20) } });
  assert.equal(r.status, 201);
  const accueil = await api(ctx, 'GET', '/promotions');
  assert.equal(accueil.body.some((o: { id: string }) => o.id === r.body.id), false);
});

test('les contrôles refusent un pourcentage hors bornes et une période inversée', async () => {
  const base_ = { produitId: produit.id, titre: 'Test contrôle', debut: jour(0), fin: jour(3) };
  assert.equal((await api(ctx, 'POST', '/admin/promotions', { token: admin.token, body: { ...base_, pourcentage: 0 } })).status, 400);
  assert.equal((await api(ctx, 'POST', '/admin/promotions', { token: admin.token, body: { ...base_, pourcentage: 95 } })).status, 400);
  const inversee = await api(ctx, 'POST', '/admin/promotions', { token: admin.token, body: { ...base_, pourcentage: 10, debut: jour(5), fin: jour(2) } });
  assert.equal(inversee.status, 400);
  assert.equal(inversee.body.erreur?.code, 'PERIODE_INVALIDE');
});

test('un client ne peut pas gérer les promotions', async () => {
  const r = await api(ctx, 'POST', '/admin/promotions', { token: client.token, body: { produitId: produit.id, titre: 'Intrusion', pourcentage: 50, debut: jour(0), fin: jour(2) } });
  assert.equal(r.status, 403);
});

test('arrêter une promotion la retire immédiatement de l’accueil, puis la supprimer la fait disparaître', async () => {
  const cree = await api(ctx, 'POST', '/admin/promotions', { token: admin.token, body: { produitId: produit.id, titre: 'À arrêter', pourcentage: 20, debut: jour(-1), fin: jour(5) } });
  const arret = await api(ctx, 'PATCH', `/admin/promotions/${cree.body.id}`, { token: admin.token, body: { arreter: true } });
  assert.equal(arret.status, 200);
  const accueil = await api(ctx, 'GET', '/promotions');
  assert.equal(accueil.body.some((o: { id: string }) => o.id === cree.body.id), false);
  const suppr = await api(ctx, 'DELETE', `/admin/promotions/${cree.body.id}`, { token: admin.token });
  assert.equal(suppr.status, 200);
  const liste = await api(ctx, 'GET', '/admin/promotions', { token: admin.token });
  assert.equal(liste.body.some((o: { id: string }) => o.id === cree.body.id), false);
});
