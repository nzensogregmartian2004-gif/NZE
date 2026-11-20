// Notifications des retraits : le commerçant est prévenu quand sa demande est refusée ou acceptée.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, collecterEtValider, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let partenaire: Session;
let produit: { id: string; entrepriseId: string };
let retraitAccepte: string;
let livreur: Session;
let produitM: { id: string; entrepriseId: string };
const POSITION = { latitude: 0.43496, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174600041');
  produit = (await jeuDeDonnees(ctx, admin)).produit;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 20, motif: 'Stock de test retraits' } });
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: produit.entrepriseId, tauxBps: 1500 } });
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600041', entrepriseId: produit.entrepriseId, motDePasse: 'motdepasse-test' } });
  partenaire = await connecter(ctx, '+24176600041');
  livreur = await connecter(ctx, '+24174700041');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  produitM = await produitAvecMagasin(ctx, admin, produit.entrepriseId, 'Chargeur M', 5000);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const vendreUnArticle = async () => {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produitM.id, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600041' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId: c.body.id, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  const detail = await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: client.token });
  await collecterEtValider(ctx, admin, livreur, partenaire, produitM, detail.body.lignes[0].id);
};
const demander = (montantFcfa: number) =>
  api(ctx, 'POST', '/partenaire/retraits', { token: partenaire.token, body: { montantFcfa, operateur: 'MOOV_MONEY', numero: '077600041', nomBeneficiaire: 'Jean Test' } });
const types = async () => (await api(ctx, 'GET', '/notifications?limite=100', { token: partenaire.token })).body.map((n: { type: string }) => n.type);

test('un retrait refusé prévient le commerçant, puis un retrait accepté aussi', async () => {
  await vendreUnArticle();
  const d = await demander(4000);
  assert.equal(d.status, 201);
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: admin.token, body: { decision: 'REJETER' } })).status, 200);
  assert.ok((await types()).includes('RETRAIT_REJETE'));

  const d2 = await demander(4000);
  assert.equal(d2.status, 201, 'le montant est libéré après le refus');
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${d2.body.id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } })).status, 200);
  assert.ok((await types()).includes('RETRAIT_EN_COURS'));
  retraitAccepte = d2.body.id;
});

test('le journal des décisions de retrait est écrit avec la décision', async () => {
  const journal = await api(ctx, 'GET', '/admin/journal?action=RETRAIT_DECIDE', { token: admin.token });
  assert.equal(journal.status, 200);
  assert.ok(journal.body.length >= 2);
  assert.ok(journal.body.every((e: { details: { decision: string } }) => ['ACCEPTER', 'REJETER'].includes(e.details.decision)));
});

test('un versement confirmé prévient le commerçant', async () => {
  const verif = await api(ctx, 'POST', `/admin/retraits/${retraitAccepte}/verifier-versement`, { token: admin.token });
  assert.equal(verif.body.statut, 'VERSEE');
  assert.ok((await types()).includes('RETRAIT_VERSE'));
});

test('un versement qui échoue prévient le commerçant, et le montant lui est rendu', async () => {
  await vendreUnArticle();
  const d = await demander(4000);
  assert.equal(d.status, 201);
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${d.body.id}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } })).status, 200);
  // Le versement échoue chez le prestataire : on le simule sur la référence de versement de cette demande.
  const { rows } = await base.pool.query('select reference_marchand from demandes_retrait where id = $1', [d.body.id]);
  ctx.mypvit.state.statusOverride.set(rows[0].reference_marchand, { status: 'FAILED' });
  const verif = await api(ctx, 'POST', `/admin/retraits/${d.body.id}/verifier-versement`, { token: admin.token });
  assert.equal(verif.body.statut, 'ECHEC');
  assert.ok((await types()).includes('RETRAIT_ECHEC'));
  const pf = (await api(ctx, 'GET', '/partenaire/portefeuille', { token: partenaire.token })).body;
  assert.ok(pf.disponible >= 4000, 'le montant en échec est rendu au solde disponible');
});
