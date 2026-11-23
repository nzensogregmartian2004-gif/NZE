// Suivi du commerçant : résumé du tableau de bord, historique de stock, détail des collectes, accès par commerçant.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session, produitAvecMagasin, ligneConfiee } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let livreur: Session;
let partenaireA: Session;
let partenaireB: Session;
let client: Session;
let entrepriseA: string;
let entrepriseB: string;
let produitA: { id: string; nom: string };
let bordereauId: string;

const CONFORME = { quantite: 1, etat: 'Neuf, emballage d’origine', testEffectue: true, resultatTest: 'Fonctionne', controle: 'CONFORME' };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001', 'admin_principal');
  const jeu = await jeuDeDonnees(ctx, admin);
  entrepriseA = jeu.entreprise.id;
  produitA = await produitAvecMagasin(ctx, admin, jeu.entreprise.id, 'Chargeur test', 5000);
  await api(ctx, 'POST', `/admin/produits/${produitA.id}/ajustements`, { token: admin.token, body: { delta: 10, motif: 'Stock de test' } });
  entrepriseB = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Second commerçant' } })).body.id;
  livreur = await connecter(ctx, '+24174700001');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600011', entrepriseId: entrepriseA, motDePasse: 'motdepasse-test' } });
  partenaireA = await connecter(ctx, '+24176600011');
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600012', entrepriseId: entrepriseB, motDePasse: 'motdepasse-test' } });
  partenaireB = await connecter(ctx, '+24176600012');
  client = await connecter(ctx, '+24174600020');
});
after(async () => { await ctx.close(); await base.stop(); });

test('résumé : stock et argent visibles dès le départ, aucune collecte ni vente', async () => {
  const r = await api(ctx, 'GET', '/partenaire/resume', { token: partenaireA.token });
  assert.equal(r.status, 200);
  assert.ok(r.body.stock.produits >= 1);
  assert.equal(r.body.stock.ruptures, 0);
  assert.equal(r.body.ventes.aujourdhui.articles, 0);
  assert.equal(r.body.collectes.length, 0);
  assert.equal(r.body.argent.solde, 0);
});

test('une collecte apparaît dans le résumé avec sa date et son nombre d’articles', async () => {
  const c = await api(ctx, 'POST', '/livreur/bordereaux', { token: livreur.token, body: { entrepriseId: entrepriseA, lignes: [{ produitId: produitA.id, ligneCommandeId: await ligneConfiee(ctx, admin, client, livreur, produitA.id), ...CONFORME }] } });
  assert.equal(c.status, 201);
  bordereauId = c.body.id;
  const r = await api(ctx, 'GET', '/partenaire/resume', { token: partenaireA.token });
  assert.equal(r.body.collectes.length, 1);
  assert.equal(r.body.collectes[0].nombreArticles, 1);
  assert.ok(r.body.collectes[0].date, 'date de collecte');
});

test('détail d’une collecte : le commerçant voit ses articles, sans identité du collecteur ; un autre commerçant ne la voit pas', async () => {
  const ok = await api(ctx, 'GET', `/partenaire/bordereaux/${bordereauId}`, { token: partenaireA.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.lignes.length, 1);
  assert.equal(ok.body.lignes[0].quantite, 1);
  assert.equal(ok.body.collecteurId, undefined, 'identité du collecteur masquée');
  assert.equal((await api(ctx, 'GET', `/partenaire/bordereaux/${bordereauId}`, { token: partenaireB.token })).status, 404);
  assert.equal((await api(ctx, 'GET', `/partenaire/bordereaux/${bordereauId}`, { token: client.token })).status, 403);
});

test('historique de stock : les signalements du commerçant apparaissent avec leur date et leur quantité', async () => {
  const s = await api(ctx, 'POST', '/partenaire/signalements', { token: partenaireA.token, body: { produitId: produitA.id, genre: 'VENTE', quantite: -1 } });
  assert.equal(s.status, 201);
  const h = await api(ctx, 'GET', '/partenaire/mouvements-stock', { token: partenaireA.token });
  assert.equal(h.status, 200);
  const signale = h.body.find((x: { origine: string; delta: number }) => x.origine === 'SIGNALEMENT' && x.delta === -1);
  assert.ok(signale, 'signalement présent dans l’historique');
  assert.equal(signale.produit, produitA.nom);
  assert.ok(signale.date, 'date et heure du mouvement');
  assert.ok(!h.body.some((x: { produit: string }) => x.produit === 'Câble'), 'pas de produit d’un autre commerçant');
});

test('une vente apparaît dans le résumé : articles et montant perçus aujourd’hui', async () => {
  // Les ventes déjà enregistrées par les autres scénarios sont comptées : on vérifie l'écart, pas le total.
  const avant = (await api(ctx, 'GET', '/partenaire/resume', { token: partenaireA.token })).body.ventes.aujourdhui.articles as number;
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produitA.id, quantite: 1 }], reception: 'RETRAIT' } });
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600020' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const r = await api(ctx, 'GET', '/partenaire/resume', { token: partenaireA.token });
  assert.equal(r.body.ventes.aujourdhui.articles, avant + 1, 'une vente de plus aujourd’hui');
  assert.ok(r.body.ventes.aujourdhui.montantFcfa > 0);
  assert.ok(r.body.argent.enAttenteCollecte > 0, 'la vente est comptée, en attente de collecte');
});
