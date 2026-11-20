// Cœur métier : panier sans stock engagé, paiement en ligne, échec sans effet, paiement sur place, MyPVit, idempotence.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

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
  client = await connecter(ctx, '+24174100001');
  produit = (await jeuDeDonnees(ctx, admin)).produit;
  await ajuster(47); // stock de départ : 50 unités
});
after(async () => { await ctx.close(); await base.stop(); });

async function ajuster(delta: number) {
  const r = await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta, motif: 'Réglage de test' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
const disponibleDe = async (id: string) => (await sql<{ disponible: number }>(ctx, 'select disponible from stock_niveaux where produit_id = $1', [id]))[0].disponible;
const reserveDe = async (id: string) => (await sql<{ reserve: number }>(ctx, 'select reserve from stock_niveaux where produit_id = $1', [id]))[0].reserve;
const statutCommande = async (id: string) => (await sql<{ statut: string }>(ctx, 'select statut from commandes where id = $1', [id]))[0].statut;
const transactionsDe = async (id: string) =>
  sql<{ statut: string; referenceMarchand: string; canal: string }>(ctx, 'select statut, canal, reference_marchand as "referenceMarchand" from transactions where commande_id = $1 order by created_at', [id]);
const derniereRef = async (id: string) => (await transactionsDe(id)).at(-1)!.referenceMarchand;

async function commander(quantite = 1, reception: 'RETRAIT' | 'LIVRAISON' = 'RETRAIT') {
  const body: Record<string, unknown> = { lignes: [{ produitId: produit.id, quantite }], reception };
  if (reception === 'LIVRAISON') body.livraison = { latitude: 0.44, longitude: 9.46 };
  return api(ctx, 'POST', '/commandes', { token: client.token, body });
}
const payer = (id: string, operateur = 'AIRTEL_MONEY', numero = '074111111') =>
  api(ctx, 'POST', `/commandes/${id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur, numero } });
const verifier = (id: string) => api(ctx, 'POST', `/commandes/${id}/verifier-paiement`, { token: client.token });

test('le panier calcule le total côté serveur et n’engage aucun stock', async () => {
  const avant = await disponibleDe(produit.id);
  const r = await commander(2);
  assert.equal(r.status, 201);
  assert.equal(r.body.statut, 'PANIER');
  assert.equal(r.body.totalFcfa, 10000);
  assert.equal(r.body.lignes[0].commissionFcfa, undefined, 'la commission n’est pas exposée au client');
  assert.equal(await disponibleDe(produit.id), avant);
});

test('la livraison ajoute des frais calculés depuis le point fixe, au moins le minimum', async () => {
  const r = await commander(1, 'LIVRAISON');
  assert.equal(r.status, 201);
  assert.ok(r.body.fraisLivraisonFcfa >= 500);
  assert.equal(r.body.totalFcfa, r.body.sousTotalFcfa + r.body.fraisLivraisonFcfa);
});

test('un panier au-delà du stock est accepté, mais le paiement est refusé sans changement', async () => {
  const c = await commander(99);
  assert.equal(c.status, 201);
  const avant = await disponibleDe(produit.id);
  const r = await payer(c.body.id);
  assert.equal(r.status, 409);
  assert.equal(await statutCommande(c.body.id), 'PANIER');
  assert.equal(await disponibleDe(produit.id), avant);
});

test('paiement Airtel Money : en attente, jamais payé à l’initiation, un seul paiement à la fois', async () => {
  const c = await commander(1);
  const r = await payer(c.body.id);
  assert.equal(r.status, 201);
  assert.equal(r.body.statut, 'PENDING');
  assert.equal(await statutCommande(c.body.id), 'EN_ATTENTE_PAIEMENT');
  assert.equal((await payer(c.body.id)).status, 409);
  // Nettoyage : le paiement est clos par un échec, la réservation est libérée.
  ctx.mypvit.state.statusOverride.set(await derniereRef(c.body.id), { status: 'FAILED' });
  assert.equal((await verifier(c.body.id)).body.statut, 'FAILED');
  assert.equal(await reserveDe(produit.id), 0);
});

test('paiement confirmé : commande payée, stock vendu une seule fois, idempotent', async () => {
  const avant = await disponibleDe(produit.id);
  const c = await commander(1);
  await payer(c.body.id, 'MOOV_MONEY', '077000001');
  ctx.mypvit.state.defaultStatus = 'SUCCESS';
  const v1 = await verifier(c.body.id);
  assert.equal(v1.body.statut, 'SUCCESS');
  assert.equal(await statutCommande(c.body.id), 'PAYEE');
  assert.equal(await disponibleDe(produit.id), avant - 1);
  const v2 = await verifier(c.body.id);
  assert.equal(v2.body.statut, 'AUCUN_PAIEMENT_EN_COURS');
  assert.equal(await disponibleDe(produit.id), avant - 1, 'pas de double vente');
});

test('dernier article : réservé au premier paiement, le second est refusé avant tout appel au fournisseur', async () => {
  const actuel = await disponibleDe(produit.id);
  await ajuster(1 - actuel);
  const a = await commander(1);
  const b = await commander(1);
  assert.equal((await payer(a.body.id)).status, 201);
  const refus = await payer(b.body.id);
  assert.equal(refus.status, 409, 'le stock réservé ne peut pas être payé deux fois');
  assert.equal(await statutCommande(b.body.id), 'PANIER');
  assert.equal((await transactionsDe(b.body.id)).length, 0, 'aucun paiement créé pour la commande refusée');
  assert.equal((await verifier(a.body.id)).body.statut, 'SUCCESS');
  assert.equal(await disponibleDe(produit.id), 0);
  assert.equal(await reserveDe(produit.id), 0, 'la réservation est devenue une vente');
  const ecarts = await sql(ctx, "select id from mouvements_stock where motif = 'STOCK_INSUFFISANT_APRES_PAIEMENT'");
  assert.equal(ecarts.length, 0, 'aucun écart : le stock ne peut plus être vendu deux fois');
  await ajuster(20);
});

test('montant différent côté MyPVit : statut UNCERTAIN, commande non payée', async () => {
  const c = await commander(1);
  await payer(c.body.id);
  const ref = await derniereRef(c.body.id);
  ctx.mypvit.state.statusOverride.set(ref, { status: 'SUCCESS', amount: 1 });
  const v = await verifier(c.body.id);
  assert.equal(v.body.statut, 'UNCERTAIN');
  assert.equal(await statutCommande(c.body.id), 'EN_ATTENTE_PAIEMENT');
  ctx.mypvit.state.statusOverride.delete(ref);
});

test('paiement échoué : la réservation est libérée, nouvelle tentative possible', async () => {
  const avant = await disponibleDe(produit.id);
  const reserveAvant = await reserveDe(produit.id);
  const c = await commander(1);
  await payer(c.body.id);
  assert.equal(await reserveDe(produit.id), reserveAvant + 1, 'le paiement en attente réserve l’article');
  const ref = await derniereRef(c.body.id);
  ctx.mypvit.state.statusOverride.set(ref, { status: 'FAILED' });
  const v = await verifier(c.body.id);
  assert.equal(v.body.statut, 'FAILED');
  assert.equal(await statutCommande(c.body.id), 'PANIER');
  assert.equal(await reserveDe(produit.id), reserveAvant, 'la réservation est libérée');
  assert.equal(await disponibleDe(produit.id), avant, 'rien n’a été vendu');
  assert.equal((await payer(c.body.id)).status, 201, 'le client peut réessayer depuis le panier');
  ctx.mypvit.state.statusOverride.set(await derniereRef(c.body.id), { status: 'FAILED' });
  await verifier(c.body.id);
  assert.equal(await reserveDe(produit.id), reserveAvant, 'nettoyage : seconde tentative libérée aussi');
});

test('callback : le contenu annoncé ne suffit pas, le statut est vérifié auprès de MyPVit', async () => {
  const c = await commander(1);
  await payer(c.body.id);
  const ref = await derniereRef(c.body.id);
  ctx.mypvit.state.statusOverride.set(ref, { status: 'PENDING' });
  const cb = await api(ctx, 'POST', '/paiements/callback', { body: { merchant_reference_id: ref, status: 'SUCCESS' } });
  assert.equal(cb.status, 200);
  assert.equal(cb.body.traite, true);
  assert.equal(await statutCommande(c.body.id), 'EN_ATTENTE_PAIEMENT');
  ctx.mypvit.state.statusOverride.delete(ref);
});

test('callback inconnu : aucune modification', async () => {
  const r = await api(ctx, 'POST', '/paiements/callback', { body: { merchant_reference_id: 'INCONNU-999' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.traite, false);
});

test('annulation : possible au panier, refusée pendant un paiement en ligne', async () => {
  const c = await commander(1);
  const ok = await api(ctx, 'POST', `/commandes/${c.body.id}/annulation`, { token: client.token });
  assert.equal(ok.body.statut, 'ANNULEE');
  const c2 = await commander(1);
  await payer(c2.body.id);
  assert.equal((await api(ctx, 'POST', `/commandes/${c2.body.id}/annulation`, { token: client.token })).status, 409);
});

test('paiement par carte : lien PVit renvoyé, aucune donnée de carte demandée', async () => {
  const c = await commander(1);
  const r = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'CARTE' } });
  assert.equal(r.status, 201);
  assert.match(r.body.urlPaiement, /^https:\/\/checkout\.test\//);
});

test('payer sur place : simple message, le paiement en ligne reste toujours possible', async () => {
  const reglage = await api(ctx, 'GET', '/reglages/paiement-sur-place');
  assert.match(reglage.body.message, /payer dès maintenant en ligne/);
  const c = await commander(1);
  const choix = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement-sur-place`, { token: client.token });
  assert.equal(choix.status, 200);
  assert.equal(await statutCommande(c.body.id), 'PANIER', 'le choix ne bloque rien');
  assert.equal((await payer(c.body.id)).status, 201, 'le paiement en ligne reste possible');
});

test('un produit sans commission bloque l’ajout au panier', async () => {
  const autre = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Sans contrat' } })).body;
  const p = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: autre.id, nom: 'Produit sans contrat', prixFcfa: 2000 } })).body;
  const r = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: p.id, quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal(r.status, 409);
  assert.match(r.body.erreur.message, /Commission non définie/);
});

test('un client ne voit pas les commandes d’un autre client', async () => {
  const autre = await connecter(ctx, '+24174100002');
  const c = await commander(1);
  assert.equal((await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: autre.token })).status, 404);
});
