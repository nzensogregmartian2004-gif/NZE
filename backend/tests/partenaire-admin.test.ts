// Espace partenaire : le magasin gère son stock, les signalements s'appliquent directement. Administration des comptes.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let partenaire: Session;
let produitA: string;
let produitB: string;
let entrepriseA: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174200001');
  const a = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Entreprise A' } })).body;
  const b = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Entreprise B' } })).body;
  entrepriseA = a.id;
  produitA = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: a.id, nom: 'Produit A', prixFcfa: 1000 } })).body.id;
  produitB = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: b.id, nom: 'Produit B', prixFcfa: 1000 } })).body.id;
  await api(ctx, 'POST', `/admin/produits/${produitA}/ajustements`, { token: admin.token, body: { delta: 5, motif: 'Stock initial' } });
  await api(ctx, 'POST', `/admin/produits/${produitB}/ajustements`, { token: admin.token, body: { delta: 5, motif: 'Stock initial' } });
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176000001', entrepriseId: a.id, motDePasse: 'motdepasse-test' } });
  partenaire = await connecter(ctx, '+24176000001');
});
after(async () => { await ctx.close(); await base.stop(); });

const stock = async (id: string) => (await sql<{ disponible: number }>(ctx, 'select disponible from stock_niveaux where produit_id = $1', [id]))[0].disponible;
const signaler = (produitId: string, genre: string, quantite: number, token = partenaire.token) =>
  api(ctx, 'POST', '/partenaire/signalements', { token, body: { produitId, genre, quantite } });

test('le partenaire ne voit que les produits de son entreprise', async () => {
  const r = await api(ctx, 'GET', '/partenaire/produits', { token: partenaire.token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((p: { id: string }) => p.id), [produitA]);
});

test('un client ne peut pas utiliser l’espace partenaire', async () => {
  assert.equal((await api(ctx, 'GET', '/partenaire/produits', { token: client.token })).status, 403);
  assert.equal((await signaler(produitA, 'VENTE', 1, client.token)).status, 403);
});

test('le partenaire ne peut pas signaler un produit d’une autre entreprise', async () => {
  assert.equal((await signaler(produitB, 'RUPTURE', 0)).status, 404);
});

test('une vente signalée par le magasin réduit le stock immédiatement', async () => {
  const r = await signaler(produitA, 'VENTE', 2);
  assert.equal(r.status, 201);
  assert.equal(r.body.statut, 'APPLIQUE');
  assert.equal(await stock(produitA), 3);
});

test('une rupture ramène le disponible à zéro', async () => {
  await signaler(produitA, 'RUPTURE', 0);
  assert.equal(await stock(produitA), 0);
});

test('un retour augmente le stock, une variation négative ne passe jamais sous zéro', async () => {
  await signaler(produitA, 'RETOUR', 3);
  assert.equal(await stock(produitA), 3);
  const trop = await signaler(produitA, 'VARIATION', -10);
  assert.equal(trop.status, 409);
  assert.equal(await stock(produitA), 3);
});

test('un ajustement qui rendrait le stock négatif est refusé', async () => {
  const r = await api(ctx, 'POST', `/admin/produits/${produitB}/ajustements`, { token: admin.token, body: { delta: -100, motif: 'Essai négatif' } });
  assert.equal(r.status, 409);
});

test('l’administrateur principal crée un administrateur secondaire, qui n’administre pas les rôles', async () => {
  const cible = await connecter(ctx, '+24174200002');
  const cree = await api(ctx, 'POST', '/admin/administrateurs', { token: admin.token, body: { telephone: '+24174200002', role: 'admin_secondaire' } });
  assert.equal(cree.status, 201);
  assert.equal(cree.body.role, 'admin_secondaire');
  const secondaire = await connecter(ctx, '+24174200002');
  assert.equal(secondaire.role, 'admin_secondaire');
  const r = await api(ctx, 'POST', `/admin/utilisateurs/${cible.id}/role`, { token: secondaire.token, body: { role: 'livreur' } });
  assert.equal(r.status, 403);
});

test('un administrateur ne peut pas modifier son propre rôle', async () => {
  const r = await api(ctx, 'POST', `/admin/utilisateurs/${admin.id}/role`, { token: admin.token, body: { role: 'client' } });
  assert.equal(r.status, 409);
});
