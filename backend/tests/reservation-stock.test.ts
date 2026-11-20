// Réservation du stock au paiement : réservé pendant le paiement, vendu une seule fois, libéré en cas d'échec.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let autre: Session;
let produit: { id: string };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174100001');
  autre = await connecter(ctx, '+24174100002');
  produit = (await jeuDeDonnees(ctx, admin)).produit;
});
after(async () => { await ctx.close(); await base.stop(); });

const niveau = async () =>
  (await sql<{ disponible: number; reserve: number }>(ctx, 'select disponible, reserve from stock_niveaux where produit_id = $1', [produit.id]))[0];
const statutCommande = async (id: string) => (await sql<{ statut: string }>(ctx, 'select statut from commandes where id = $1', [id]))[0].statut;
const nbTransactions = async (id: string) => (await sql(ctx, 'select id from transactions where commande_id = $1', [id])).length;
const derniereRef = async (id: string) =>
  (await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where commande_id = $1 order by created_at desc limit 1', [id]))[0].r;

// Fixe le stock disponible à une valeur donnée (ajustement de test).
async function fixerStock(cible: number) {
  const actuel = (await niveau()).disponible;
  const r = await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: cible - actuel, motif: 'Réglage de test' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
async function commander(token: string, quantite = 1) {
  return api(ctx, 'POST', '/commandes', { token, body: { lignes: [{ produitId: produit.id, quantite }], reception: 'RETRAIT' } });
}
const payer = (token: string, id: string) =>
  api(ctx, 'POST', `/commandes/${id}/paiement`, { token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074111111' } });
const verifier = (token: string, id: string) => api(ctx, 'POST', `/commandes/${id}/verifier-paiement`, { token });
// Issue fournie par MyPVit pour la dernière tentative de paiement de la commande.
async function issue(id: string, statut: 'SUCCESS' | 'FAILED') {
  ctx.mypvit.state.statusOverride.set(await derniereRef(id), { status: statut });
}

test('pendant un paiement, l’article est réservé : la fiche n’annonce que la quantité vendable', async () => {
  await fixerStock(2);
  const a = await commander(client.token);
  assert.equal((await payer(client.token, a.body.id)).status, 201);
  assert.deepEqual(await niveau(), { disponible: 2, reserve: 1 });
  const fiche = await api(ctx, 'GET', `/produits/${produit.id}`);
  assert.equal(fiche.body.quantiteDisponible, 1, 'un article réservé ne compte plus comme vendable');
  assert.equal(fiche.body.enStock, true);
  await issue(a.body.id, 'FAILED');
  assert.equal((await verifier(client.token, a.body.id)).body.statut, 'FAILED');
  assert.deepEqual(await niveau(), { disponible: 2, reserve: 0 }, 'échec : réservation libérée');
});

test('deux paiements simultanés pour le dernier article : un seul est accepté, l’autre est refusé sans paiement créé', async () => {
  await fixerStock(1);
  const a = await commander(client.token);
  const b = await commander(autre.token);
  const [ra, rb] = await Promise.all([payer(client.token, a.body.id), payer(autre.token, b.body.id)]);
  assert.deepEqual([ra.status, rb.status].sort(), [201, 409]);
  const gagnante = ra.status === 201 ? a : b;
  const perdante = ra.status === 201 ? b : a;
  assert.equal(await statutCommande(perdante.body.id), 'PANIER');
  assert.equal(await nbTransactions(perdante.body.id), 0, 'aucun paiement pour la commande refusée');
  assert.deepEqual(await niveau(), { disponible: 1, reserve: 1 });
  await issue(gagnante.body.id, 'SUCCESS');
  const tokenGagnant = ra.status === 201 ? client.token : autre.token;
  assert.equal((await verifier(tokenGagnant, gagnante.body.id)).body.statut, 'SUCCESS');
  assert.deepEqual(await niveau(), { disponible: 0, reserve: 0 }, 'vendu une seule fois');
  const ecarts = await sql(ctx, "select id from mouvements_stock where motif = 'STOCK_INSUFFISANT_APRES_PAIEMENT'");
  assert.equal(ecarts.length, 0, 'aucun écart de stock');
});

test('échec : le dernier article revient à la vente pour un autre client', async () => {
  await fixerStock(1);
  const a = await commander(client.token);
  assert.equal((await payer(client.token, a.body.id)).status, 201);
  const b = await commander(autre.token);
  assert.equal((await payer(autre.token, b.body.id)).status, 409, 'l’article est réservé par un autre paiement');
  await issue(a.body.id, 'FAILED');
  assert.equal((await verifier(client.token, a.body.id)).body.statut, 'FAILED');
  assert.deepEqual(await niveau(), { disponible: 1, reserve: 0 }, 'la réservation est libérée');
  assert.equal((await payer(autre.token, b.body.id)).status, 201, 'l’article est à nouveau vendable');
  await issue(b.body.id, 'FAILED');
  await verifier(autre.token, b.body.id);
  assert.deepEqual(await niveau(), { disponible: 1, reserve: 0 }, 'nettoyage');
});

test('un ajustement qui passerait sous les quantités réservées est refusé', async () => {
  const a = await commander(client.token);
  assert.equal((await payer(client.token, a.body.id)).status, 201);
  const refuse = await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: -1, motif: 'Test' } });
  assert.equal(refuse.status, 409, JSON.stringify(refuse.body));
  assert.deepEqual(await niveau(), { disponible: 1, reserve: 1 }, 'rien n’a changé');
  const accepte = await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 1, motif: 'Test' } });
  assert.equal(accepte.status, 200, JSON.stringify(accepte.body));
  assert.deepEqual(await niveau(), { disponible: 2, reserve: 1 });
  await issue(a.body.id, 'FAILED');
  await verifier(client.token, a.body.id);
  assert.deepEqual(await niveau(), { disponible: 2, reserve: 0 });
});

test('un paiement non tranché garde sa réservation jusqu’à la vérification', async () => {
  const avant = await niveau();
  const a = await commander(client.token);
  assert.equal((await payer(client.token, a.body.id)).status, 201);
  ctx.mypvit.state.statusOverride.set(await derniereRef(a.body.id), { status: 'SUCCESS', amount: 1 });
  assert.equal((await verifier(client.token, a.body.id)).body.statut, 'UNCERTAIN');
  assert.equal((await niveau()).reserve, avant.reserve + 1, 'la réservation reste tant que le paiement n’est pas tranché');
  await issue(a.body.id, 'FAILED');
  await verifier(client.token, a.body.id);
  assert.equal((await niveau()).reserve, avant.reserve, 'libérée une fois l’échec confirmé');
});
