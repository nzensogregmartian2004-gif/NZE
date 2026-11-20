// Origine de la distance (emplacement du commerçant, ou point fixe NZE) et retraits des commerçants versés via MyPVit.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, collecterEtValider, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let partenaire: Session;
let produit: { id: string; entrepriseId: string };
let produit2: { id: string };
let produitM: { id: string; entrepriseId: string };
let livreur: Session;
let entreprise2: string;

const CINQ_KM_AU_NORD = { latitude: 0.43496, longitude: 9.454 };
const POINT_FIXE = { latitude: 0.39, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174600001');
  produit = (await jeuDeDonnees(ctx, admin)).produit;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 20, motif: 'Stock de test' } });
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: produit.entrepriseId, tauxBps: 1500 } });
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600001', entrepriseId: produit.entrepriseId, motDePasse: 'motdepasse-test' } });
  partenaire = await connecter(ctx, '+24176600001');
  entreprise2 = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Second commerçant' } })).body.id;
  produit2 = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: entreprise2, nom: 'Câble', prixFcfa: 3000 } })).body;
  await api(ctx, 'POST', `/admin/produits/${produit2.id}/ajustements`, { token: admin.token, body: { delta: 10, motif: 'Stock de test' } });
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: entreprise2, tauxBps: 1000 } });
  livreur = await connecter(ctx, '+24174700001');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  produitM = await produitAvecMagasin(ctx, admin, produit.entrepriseId, 'Chargeur M', 5000);
});
after(async () => { await ctx.close(); await base.stop(); });

const vendreUnArticle = async () => {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produitM.id, quantite: 1 }], reception: 'LIVRAISON', livraison: CINQ_KM_AU_NORD } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600001' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId: c.body.id, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  const detail = await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: client.token });
  await collecterEtValider(ctx, admin, livreur, partenaire, produitM, detail.body.lignes[0].id);
};
const portefeuille = async () => (await api(ctx, 'GET', '/partenaire/portefeuille', { token: partenaire.token })).body;
const demander = (montantFcfa: number, nomBeneficiaire = 'Jean Test') =>
  api(ctx, 'POST', '/partenaire/retraits', { token: partenaire.token, body: { montantFcfa, operateur: 'MOOV_MONEY', numero: '077600001', nomBeneficiaire } });

test('panier d’un seul commerçant ayant un emplacement : la distance part de son emplacement', async () => {
  await api(ctx, 'PATCH', `/admin/entreprises/${produit.entrepriseId}/emplacement`, { token: admin.token, body: CINQ_KM_AU_NORD });
  const c = await api(ctx, 'POST', '/commandes', {
    token: client.token,
    body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'LIVRAISON', livraison: CINQ_KM_AU_NORD },
  });
  assert.equal(c.status, 201);
  assert.ok(c.body.distanceM < 100, `distance depuis l'emplacement du commerçant : ${c.body.distanceM} m`);
  assert.equal(c.body.fraisLivraisonFcfa, 500, 'minimum de livraison');
  assert.equal(c.body.origineLatitude, CINQ_KM_AU_NORD.latitude);
});

test('panier de plusieurs commerçants : la distance part toujours du point fixe NZE', async () => {
  const c = await api(ctx, 'POST', '/commandes', {
    token: client.token,
    body: { lignes: [{ produitId: produit.id, quantite: 1 }, { produitId: produit2.id, quantite: 1 }], reception: 'LIVRAISON', livraison: CINQ_KM_AU_NORD },
  });
  assert.equal(c.status, 201);
  assert.equal(c.body.origineLatitude, POINT_FIXE.latitude);
  assert.ok(c.body.distanceM > 4900 && c.body.distanceM < 5100, `distance : ${c.body.distanceM} m`);
  assert.ok(c.body.fraisLivraisonFcfa >= 1400 && c.body.fraisLivraisonFcfa <= 1600, `frais : ${c.body.fraisLivraisonFcfa}`);
});

test('le commerçant voit son solde, puis demande un retrait : le montant est bloqué jusqu’à la décision', async () => {
  await vendreUnArticle();
  const pf = await portefeuille();
  assert.equal(pf.solde, 4250);
  assert.equal(pf.disponible, 4250);
  const d = await demander(4000);
  assert.equal(d.status, 201);
  assert.equal(d.body.statut, 'EN_ATTENTE');
  const apres = await portefeuille();
  assert.equal(apres.solde, 4250);
  assert.equal(apres.disponible, 250);
});

test('une demande au-delà du disponible, sans montant ni nom valides, est refusée', async () => {
  assert.equal((await demander(300)).status, 409);
  assert.equal((await demander(0)).status, 400);
  const sansNom = await api(ctx, 'POST', '/partenaire/retraits', { token: partenaire.token, body: { montantFcfa: 100, operateur: 'AIRTEL_MONEY', numero: '074600002' } });
  assert.equal(sansNom.status, 400);
});

test('le rejet rend le montant disponible ; une demande ne se traite qu’une fois', async () => {
  const liste = await api(ctx, 'GET', '/admin/retraits?statut=EN_ATTENTE', { token: admin.token });
  assert.equal(liste.body.length, 1);
  assert.equal(liste.body[0].nomBeneficiaire, 'Jean Test');
  const rejet = await api(ctx, 'POST', `/admin/retraits/${liste.body[0].id}/decision`, { token: admin.token, body: { decision: 'REJETER' } });
  assert.equal(rejet.body.statut, 'REJETEE');
  assert.equal((await portefeuille()).disponible, 4250);
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${liste.body[0].id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } })).status, 409);
});

test('l’acceptation lance le versement MyPVit, le montant part du solde ; la vérification le marque versé', async () => {
  const d = await demander(4250);
  const acceptee = await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } });
  assert.equal(acceptee.body.statut, 'VERSEMENT_EN_COURS');
  assert.ok(acceptee.body.referenceMarchand, 'référence de versement créée');
  assert.equal(ctx.mypvit.state.amountByRef.get(acceptee.body.referenceMarchand), 4250, 'MyPVit a reçu le bon montant');
  const pendant = await portefeuille();
  assert.equal(pendant.solde, 0);
  assert.equal(pendant.disponible, 0);
  const verif = await api(ctx, 'POST', `/admin/retraits/${d.body.id}/verifier-versement`, { token: admin.token });
  assert.equal(verif.body.statut, 'VERSEE');
  assert.equal((await portefeuille()).solde, 0);
});

test('un versement refusé par MyPVit rend le montant au solde', async () => {
  await vendreUnArticle();
  assert.equal((await portefeuille()).solde, 4250);
  const d = await demander(4250);
  ctx.mypvit.state.initiationStatus = 'FAILED';
  const acceptee = await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } });
  ctx.mypvit.state.initiationStatus = 'SUCCESS';
  assert.equal(acceptee.body.statut, 'ECHEC');
  assert.equal((await portefeuille()).solde, 4250, 'le montant est revenu disponible');
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${d.body.id}/verifier-versement`, { token: admin.token })).status, 409);
});

test('les rôles sont respectés : client ne retire pas, partenaire ne décide pas ni ne modifie les emplacements', async () => {
  assert.equal((await api(ctx, 'POST', '/partenaire/retraits', { token: client.token, body: { montantFcfa: 1, operateur: 'AIRTEL_MONEY', numero: '074600004', nomBeneficiaire: 'Client' } })).status, 403);
  await vendreUnArticle();
  const d = await demander(10);
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: partenaire.token, body: { decision: 'ACCEPTER' } })).status, 403);
  assert.equal((await api(ctx, 'PATCH', `/admin/entreprises/${produit.entrepriseId}/emplacement`, { token: partenaire.token, body: CINQ_KM_AU_NORD })).status, 403);
});

test('aucun frais pour le commerçant : il reçoit le montant demandé en entier', async () => {
  const pf = await portefeuille();
  const d = await demander(pf.disponible);
  const acceptee = await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } });
  assert.equal(ctx.mypvit.state.amountByRef.get(acceptee.body.referenceMarchand), pf.disponible);
});
