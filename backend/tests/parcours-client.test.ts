// Parcours client : catégories, profil, adresses, liste d'envies, panier, achats à nouveau, listes d'administration.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let autre: Session;
let produit: { id: string; nom: string };

const PAIEMENT = { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074800001' };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174800001');
  autre = await connecter(ctx, '+24174800002');
  produit = (await jeuDeDonnees(ctx, admin)).produit;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 20, motif: 'Stock de test' } });
});
after(async () => { await ctx.close(); await base.stop(); });

test('catégories : publiques, triées par nom', async () => {
  await api(ctx, 'POST', '/admin/categories', { token: admin.token, body: { nom: 'Électronique', slug: 'electronique' } });
  await api(ctx, 'POST', '/admin/categories', { token: admin.token, body: { nom: 'Aménager la maison', slug: 'maison' } });
  const r = await api(ctx, 'GET', '/categories');
  assert.equal(r.status, 200, 'accessible sans connexion');
  assert.deepEqual(r.body.map((c: { slug: string }) => c.slug), ['maison', 'electronique']);
});

test('profil : lecture, changement de langue (4 langues), refus d’une langue inconnue', async () => {
  const p = await api(ctx, 'GET', '/profil', { token: client.token });
  assert.equal(p.body.langue, 'fr');
  assert.equal(p.body.telephone, '+24174800001');
  const ar = await api(ctx, 'PATCH', '/profil', { token: client.token, body: { langue: 'ar', nomAffiche: 'Awa Test' } });
  assert.equal(ar.body.langue, 'ar');
  assert.equal(ar.body.nomAffiche, 'Awa Test');
  assert.equal((await api(ctx, 'PATCH', '/profil', { token: client.token, body: { langue: 'de' } })).status, 400);
  assert.equal((await api(ctx, 'PATCH', '/profil', { token: client.token, body: { langue: 'zh-Hans' } })).body.langue, 'zh-Hans');
});

test('adresses : chaque client ne voit que les siennes, suppression limitée au propriétaire', async () => {
  const a = await api(ctx, 'POST', '/adresses', { token: client.token, body: { libelle: 'Maison', quartier: 'Akanda', repere: 'Près du marché', latitude: 0.43, longitude: 9.45 } });
  assert.equal(a.status, 201);
  await api(ctx, 'POST', '/adresses', { token: client.token, body: { libelle: 'Bureau', quartier: 'Louis', latitude: 0.39, longitude: 9.44, photoCle: 'lieux/bureau.jpg' } });
  assert.equal((await api(ctx, 'GET', '/adresses', { token: client.token })).body.length, 2);
  assert.equal((await api(ctx, 'GET', '/adresses', { token: autre.token })).body.length, 0);
  assert.equal((await api(ctx, 'DELETE', `/adresses/${a.body.id}`, { token: autre.token })).status, 404);
  assert.equal((await api(ctx, 'DELETE', `/adresses/${a.body.id}`, { token: client.token })).status, 200);
  assert.equal((await api(ctx, 'POST', '/adresses', { token: client.token, body: { libelle: 'X', quartier: 'Y', latitude: 200, longitude: 0 } })).status, 400);
});

test('liste d’envies : ajout sans doublon, retrait', async () => {
  assert.equal((await api(ctx, 'POST', '/listes-envies', { token: client.token, body: { produitId: produit.id } })).status, 201);
  await api(ctx, 'POST', '/listes-envies', { token: client.token, body: { produitId: produit.id } });
  const liste = await api(ctx, 'GET', '/listes-envies', { token: client.token });
  assert.equal(liste.body.length, 1);
  assert.equal(liste.body[0].nom, produit.nom);
  await api(ctx, 'DELETE', `/listes-envies/${produit.id}`, { token: client.token });
  assert.equal((await api(ctx, 'GET', '/listes-envies', { token: client.token })).body.length, 0);
});

test('panier : remplacé sans perte, une seule version active, annulé quand vide', async () => {
  assert.equal(await api(ctx, 'GET', '/panier', { token: client.token }).then((r) => r.body), null);
  const v1 = await api(ctx, 'PUT', '/panier', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 2 }], reception: 'RETRAIT' } });
  assert.equal(v1.status, 200);
  assert.equal(v1.body.statut, 'PANIER');
  assert.equal(v1.body.totalFcfa, 10000);
  const v2 = await api(ctx, 'PUT', '/panier', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  assert.notEqual(v2.body.id, v1.body.id);
  assert.equal(v2.body.totalFcfa, 5000);
  assert.equal((await api(ctx, 'GET', `/commandes/${v1.body.id}`, { token: client.token })).body.statut, 'ANNULEE');
  assert.equal((await api(ctx, 'GET', '/panier', { token: client.token })).body.id, v2.body.id);
  const refus = await api(ctx, 'PUT', '/panier', { token: client.token, body: { lignes: [{ produitId: '00000000-0000-4000-8000-000000000000', quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal(refus.status, 404);
  assert.equal((await api(ctx, 'GET', '/panier', { token: client.token })).body.id, v2.body.id, 'le panier survit à une erreur');
  await api(ctx, 'PUT', '/panier', { token: client.token, body: { lignes: [], reception: 'RETRAIT' } });
  assert.equal((await api(ctx, 'GET', '/panier', { token: client.token })).body, null);
});

test('achats à nouveau : articles des commandes payées, sans doublon', async () => {
  assert.equal((await api(ctx, 'GET', '/achats-a-nouveau', { token: client.token })).body.length, 0);
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: PAIEMENT });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const r = await api(ctx, 'GET', '/achats-a-nouveau', { token: client.token });
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].produitId, produit.id);
  assert.ok(r.body[0].dernierAchat, 'date du dernier achat');
});

test('listes d’administration : commandes filtrables, produits avec stock ; réservées à l’administration', async () => {
  const cmd = await api(ctx, 'GET', '/admin/commandes?statut=PAYEE', { token: admin.token });
  assert.equal(cmd.status, 200);
  assert.ok(cmd.body.every((c: { statut: string }) => c.statut === 'PAYEE'));
  const pro = await api(ctx, 'GET', '/admin/produits', { token: admin.token });
  assert.equal(pro.status, 200);
  assert.ok(pro.body.some((p: { id: string; disponible: number }) => p.id === produit.id && p.disponible >= 0));
  assert.equal((await api(ctx, 'GET', '/admin/produits', { token: client.token })).status, 403);
});
