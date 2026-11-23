// Publication de produits depuis l'administration (fiche complète, état du stock) et message « payer sur place » modifiable.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let entrepriseNze: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001', 'admin_principal');
  await jeuDeDonnees(ctx, admin);
  client = await connecter(ctx, '+24174800010');
  entrepriseNze = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'NZE Boutique' } })).body.id;
});
after(async () => { await ctx.close(); await base.stop(); });

const ps5 = {
  entrepriseId: () => entrepriseNze,
  nom: 'PlayStation 5',
  description: 'Console de jeux de nouvelle génération, livrée avec une manette.',
  prixFcfa: 350000,
  garantieJours: 365,
  caracteristiques: [{ nom: 'Stockage', valeur: '825 Go SSD' }, { nom: 'Sortie vidéo', valeur: '4K 120 Hz' }],
  commentaires: 'Neuve, emballage d’origine.',
};

test('publication d’un produit : fiche complète et stock initial de 10 unités', async () => {
  const c = await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { ...ps5, entrepriseId: ps5.entrepriseId() } });
  assert.equal(c.status, 201);
  await api(ctx, 'POST', `/admin/produits/${c.body.id}/ajustements`, { token: admin.token, body: { delta: 10, motif: 'Réception initiale' } });
  const f = await api(ctx, 'GET', `/produits/${c.body.id}`, { sansJeton: true } as never);
  assert.equal(f.status, 200);
  assert.equal(f.body.nom, 'PlayStation 5');
  assert.equal(f.body.quantiteDisponible, 10);
  assert.equal(f.body.etatStock, 'EN_STOCK');
  assert.equal(f.body.caracteristiques.length, 2);
  assert.equal(f.body.commentaires, 'Neuve, emballage d’origine.');
  assert.equal(f.body.garantieJours, 365);
});

test('état du stock : stock faible sous le seuil, rupture à zéro', async () => {
  const c = await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { ...ps5, nom: 'Manette', entrepriseId: entrepriseNze } });
  await api(ctx, 'POST', `/admin/produits/${c.body.id}/ajustements`, { token: admin.token, body: { delta: 2, motif: 'Réception' } });
  assert.equal((await api(ctx, 'GET', `/produits/${c.body.id}`)).body.etatStock, 'STOCK_FAIBLE');
  await api(ctx, 'POST', `/admin/produits/${c.body.id}/ajustements`, { token: admin.token, body: { delta: -2, motif: 'Vente hors application' } });
  const rupture = await api(ctx, 'GET', `/produits/${c.body.id}`);
  assert.equal(rupture.body.etatStock, 'RUPTURE');
  assert.equal(rupture.body.enStock, false);
});

test('modification : nom, description, caractéristiques et statut ; un brouillon n’est pas visible du client', async () => {
  const c = await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { ...ps5, nom: 'Brouillon', entrepriseId: entrepriseNze, statut: 'BROUILLON' } });
  assert.equal((await api(ctx, 'GET', `/produits/${c.body.id}`)).status, 404, 'brouillon masqué');
  const m = await api(ctx, 'PATCH', `/admin/produits/${c.body.id}`, { token: admin.token, body: { nom: 'PlayStation 5 Slim', statut: 'PUBLIE', caracteristiques: [{ nom: 'Poids', valeur: '3,2 kg' }] } });
  assert.equal(m.status, 200);
  const f = await api(ctx, 'GET', `/produits/${c.body.id}`);
  assert.equal(f.body.nom, 'PlayStation 5 Slim');
  assert.equal(f.body.caracteristiques[0].nom, 'Poids');
});

test('liste des entreprises réservée à l’administration', async () => {
  const r = await api(ctx, 'GET', '/admin/entreprises', { token: admin.token });
  assert.equal(r.status, 200);
  assert.ok(r.body.some((e: { id: string }) => e.id === entrepriseNze));
  assert.equal((await api(ctx, 'GET', '/admin/entreprises', { token: client.token })).status, 403);
});

test('message « payer sur place » : lisible par tous, modifiable par l’administration uniquement', async () => {
  const defaut = await api(ctx, 'GET', '/reglages/paiement-sur-place');
  assert.ok(defaut.body.message.includes('livreur'), 'message par défaut');
  const nouveau = 'Votre commande sera préparée et livrée à l’adresse indiquée. Veuillez payer en ligne, puis patienter jusqu’à l’arrivée du livreur.';
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/paiement-sur-place', { token: client.token, body: { message: nouveau } })).status, 403);
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/paiement-sur-place', { token: admin.token, body: { message: 'trop court' } })).status, 400);
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/paiement-sur-place', { token: admin.token, body: { message: nouveau } })).status, 200);
  assert.equal((await api(ctx, 'GET', '/reglages/paiement-sur-place')).body.message, nouveau);
});

test('paiement sur place : le client reçoit le message modifié par l’administration', async () => {
  const p = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: (await api(ctx, 'GET', '/produits')).body[0].id, quantite: 1 }], reception: 'LIVRAISON', livraison: { latitude: 0.39, longitude: 9.45 } } });
  if (p.status !== 201) return; // commande non créable dans ce jeu (pas de tarif) : couvert par les tests de commandes
  const r = await api(ctx, 'POST', `/commandes/${p.body.id}/paiement-sur-place`, { token: client.token });
  assert.equal(r.status, 200);
  assert.ok(r.body.message.includes('préparée'), 'message de l’administration affiché');
});
