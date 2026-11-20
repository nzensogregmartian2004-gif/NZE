// P0 financier : une vente n'est retirable qu'après collecte validée, sans réclamation ni litige ouvert (cahier §15.5).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, collecterEtValider, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let partenaire: Session;
let livreur: Session;
let produit: { id: string; entrepriseId: string };
const POSITION = { latitude: 0.43496, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000081');
  await promouvoir(base, '+24101000081');
  const jeu = await jeuDeDonnees(ctx, admin);
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600081', entrepriseId: jeu.entreprise.id, motDePasse: 'motdepasse-test' } });
  partenaire = await connecter(ctx, '+24176600081');
  client = await connecter(ctx, '+24174600081');
  livreur = await connecter(ctx, '+24174700081');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  produit = await produitAvecMagasin(ctx, admin, jeu.entreprise.id, 'Chargeur P0', 5000);
});
after(async () => { await ctx.close(); await base.stop(); });

const portefeuille = async () => (await api(ctx, 'GET', '/partenaire/portefeuille', { token: partenaire.token })).body;
const demander = (montantFcfa: number) =>
  api(ctx, 'POST', '/partenaire/retraits', { token: partenaire.token, body: { montantFcfa, operateur: 'MOOV_MONEY', numero: '077600081', nomBeneficiaire: 'Partenaire P0' } });

// Vente livrable : commande payée, livraison confiée au livreur. Renvoie la ligne et la livraison.
async function vente(): Promise<{ ligneId: string; livraisonId: string }> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600081' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId: c.body.id, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  const detail = await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: client.token });
  return { ligneId: detail.body.lignes[0].id, livraisonId: a.body.id };
}

async function livrer(livraisonId: string): Promise<void> {
  await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/demarrer`, { token: livreur.token });
  const d = await api(ctx, 'GET', `/livreur/livraisons/${livraisonId}`, { token: livreur.token });
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/confirmer`, {
    token: livreur.token,
    body: { signaturePapierRecue: true, lignes: d.body.lignes.map((l: { id: string; quantiteDemandee: number }) => ({ ligneId: l.id, quantiteLivree: l.quantiteDemandee })) },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
}

test('une vente payée mais non collectée n’est pas retirable', async () => {
  await vente();
  const p = await portefeuille();
  assert.equal(p.disponible, 0, 'rien n’est retirable avant la collecte');
  assert.equal(p.enAttenteCollecte, 4250, 'la part est visible, en attente de collecte');
  assert.equal((await demander(100)).status, 409);
});

test('après collecte validée, la part devient retirable', async () => {
  const v = await vente();
  await collecterEtValider(ctx, admin, livreur, partenaire, produit, v.ligneId);
  const p = await portefeuille();
  assert.equal(p.disponible, 4250, 'la part de la vente collectée est retirable');
});

test('une réclamation ouverte bloque la part de sa ligne, même collectée', async () => {
  const v = await vente();
  await collecterEtValider(ctx, admin, livreur, partenaire, produit, v.ligneId);
  await livrer(v.livraisonId);
  assert.equal((await portefeuille()).disponible, 8500, 'avant la réclamation : deux ventes collectées');
  const r = await api(ctx, 'POST', '/reclamations', { token: client.token, body: { ligneCommandeId: v.ligneId, motif: 'ARTICLE_DEFECTUEUX', description: 'Le câble ne charge plus correctement.' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal((await portefeuille()).disponible, 4250, 'la ligne en réclamation n’est plus retirable');
});

test('le retrait est accepté dans la limite du disponible, et refusé au-delà', async () => {
  const avant = (await portefeuille()).disponible;
  assert.equal((await demander(avant + 1)).status, 409, 'au-delà du disponible : refusé');
  const d = await demander(avant);
  assert.equal(d.status, 201, JSON.stringify(d.body));
  assert.equal((await portefeuille()).disponible, 0, 'le montant est réservé dès la demande');
  assert.equal((await demander(1)).status, 409, 'pas de second retrait sur le même montant');
});

test('une vente en retrait en magasin n’est pas retirable : aucune collecte ne la couvre', async () => {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600081' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  assert.equal((await portefeuille()).disponible, 0);
});

test('un litige ouvert sans réclamation liée bloque tout le solde retirable du partenaire', async () => {
  const v = await vente();
  await collecterEtValider(ctx, admin, livreur, partenaire, produit, v.ligneId);
  assert.ok((await portefeuille()).disponible > 0, 'un montant est retirable avant le litige');
  const l = await api(ctx, 'POST', '/admin/litiges-partenaire', {
    token: admin.token,
    body: { entrepriseId: produit.entrepriseId, motif: 'Écart de stock déclaré', description: 'Litige ouvert sans réclamation liée au client.' },
  });
  assert.equal(l.status, 201, JSON.stringify(l.body));
  assert.ok((await portefeuille()).disponible <= 0, 'aucun montant retirable tant que le litige est ouvert');
  assert.equal((await demander(100)).status, 409, 'aucune demande de retrait pendant le litige');
  const c = await api(ctx, 'POST', `/admin/litiges-partenaire/${l.body.id}/cloture`, { token: admin.token, body: { issue: 'Litige clos après vérification du stock.' } });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.ok((await portefeuille()).disponible > 0, 'le montant redevient retirable après clôture');
});

test('un versement dont le résultat est inconnu reste en cours, son montant reste réservé, et il n’est jamais relancé', async () => {
  const v = await vente();
  await collecterEtValider(ctx, admin, livreur, partenaire, produit, v.ligneId);
  const d = await demander(100);
  assert.equal(d.status, 201, JSON.stringify(d.body));
  const avant = (await portefeuille()).disponible;
  ctx.mypvit.state.initiationFails = true;
  try {
    const r = await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.statut, 'VERSEMENT_EN_COURS', 'résultat inconnu : le versement reste en cours, sans être marqué échoué');
  } finally {
    ctx.mypvit.state.initiationFails = false;
  }
  assert.equal((await portefeuille()).disponible, avant, 'le montant reste réservé');
  const seconde = await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } });
  assert.equal(seconde.status, 409, 'aucun second versement sur la même demande');
});
