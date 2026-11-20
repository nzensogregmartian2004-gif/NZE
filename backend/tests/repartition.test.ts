// Frais de livraison au kilomètre calculés au moment de payer, répartition automatique à la vente, portefeuille du commerçant.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let partenaire: Session;
let produit: { id: string; entrepriseId: string };
let fraisEstime = 0;
let commandeLivree: { id: string; totalFcfa: number };

const CINQ_KM_AU_NORD = { latitude: 0.43496, longitude: 9.454 }; // environ 5 km du point fixe

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174500001');
  produit = (await jeuDeDonnees(ctx, admin)).produit;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 20, motif: 'Stock de test' } });
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: produit.entrepriseId, tauxBps: 1500 } });
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176500001', entrepriseId: produit.entrepriseId, motDePasse: 'motdepasse-test' } });
  partenaire = await connecter(ctx, '+24176500001');
});
after(async () => { await ctx.close(); await base.stop(); });

const ecrituresDe = (commandeId: string) =>
  sql<{ categorie: string; entrepriseId: string | null; montant: number }>(ctx,
    'select categorie, entreprise_id as "entrepriseId", montant_fcfa as montant from ecritures where commande_id = $1', [commandeId]);

test('les frais se calculent au kilomètre et sont fixés au moment de payer', async () => {
  const c = await api(ctx, 'POST', '/commandes', {
    token: client.token,
    body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'LIVRAISON', livraison: CINQ_KM_AU_NORD },
  });
  assert.equal(c.status, 201);
  fraisEstime = c.body.fraisLivraisonFcfa;
  assert.ok(c.body.distanceM > 4900 && c.body.distanceM < 5100, `distance : ${c.body.distanceM} m`);

  // Le tarif change entre le panier et le paiement : le paiement prend le tarif du moment.
  await api(ctx, 'POST', '/admin/livraison/tarif', { token: admin.token, body: { fcfaParKm: 400, minimumFcfa: 500 } });
  const p = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074500001' } });
  assert.equal(p.status, 201);

  const apres = await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: client.token });
  assert.ok(apres.body.fraisLivraisonFcfa >= 1900 && apres.body.fraisLivraisonFcfa <= 2100, `frais : ${apres.body.fraisLivraisonFcfa}`);
  assert.notEqual(apres.body.fraisLivraisonFcfa, fraisEstime);
  assert.equal(apres.body.totalFcfa, 5000 + apres.body.fraisLivraisonFcfa);
  commandeLivree = { id: c.body.id, totalFcfa: apres.body.totalFcfa };
});

test('à l’encaissement, la part du commerçant, la commission et les frais sont répartis et la somme égale le total', async () => {
  assert.equal((await api(ctx, 'POST', `/commandes/${commandeLivree.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const ecr = await ecrituresDe(commandeLivree.id);
  const net = ecr.find((e) => e.categorie === 'VENTE_NET')!;
  const commission = ecr.find((e) => e.categorie === 'COMMISSION')!;
  const frais = ecr.find((e) => e.categorie === 'FRAIS_LIVRAISON')!;
  assert.equal(net.entrepriseId, produit.entrepriseId);
  assert.equal(net.montant, 5000 - 750, 'commerçant : prix moins commission de 15 %');
  assert.equal(commission.montant, 750);
  assert.equal(commission.entrepriseId, null);
  assert.equal(frais.montant, commandeLivree.totalFcfa - 5000);
  // Registres PARTENAIRE et COMMISSIONS : leur somme égale le total ; le registre CLIENT porte l'encaissement.
  const somme = ecr.filter((e) => e.categorie !== 'ENCAISSEMENT').reduce((t, e) => t + e.montant, 0);
  assert.equal(somme, commandeLivree.totalFcfa);
  assert.equal(ecr.find((e) => e.categorie === 'ENCAISSEMENT')!.montant, commandeLivree.totalFcfa);
});

test('le portefeuille du commerçant affiche son solde et les articles vendus', async () => {
  const r = await api(ctx, 'GET', '/partenaire/portefeuille', { token: partenaire.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.solde, 0, 'rien n’est retirable avant la collecte');
  assert.equal(r.body.enAttenteCollecte, 4250, 'la part est comptée, en attente de collecte');
  assert.equal(r.body.ventes.length, 1);
  assert.equal(r.body.ventes[0].produit, 'Chargeur USB');
});

test('le résumé NZE montre commissions, frais de livraison et soldes dus', async () => {
  const r = await api(ctx, 'GET', '/admin/finance/resume', { token: admin.token });
  assert.equal(r.body.commissions, 750);
  assert.equal(r.body.fraisLivraison, commandeLivree.totalFcfa - 5000);
  assert.deepEqual(r.body.soldesCommercants.map((x: { solde: number }) => x.solde), [4250]);
});

test('retrait en boutique : aucun frais de livraison dans la répartition', async () => {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 2 }], reception: 'RETRAIT' } });
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'MOOV_MONEY', numero: '077500001' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const ecr = await ecrituresDe(c.body.id);
  assert.equal(ecr.some((e) => e.categorie === 'FRAIS_LIVRAISON'), false);
  assert.equal(ecr.filter((e) => e.categorie !== 'ENCAISSEMENT').reduce((t, e) => t + e.montant, 0), 10000);
});

test('un client ne voit pas le portefeuille d’un commerçant', async () => {
  assert.equal((await api(ctx, 'GET', '/partenaire/portefeuille', { token: client.token })).status, 403);
});
