// Parcours d'achat de bout en bout : recherche, panier, paiement Mobile Money, affectation, remise signée.
// Chaque étape vérifie l'effet réel (statuts, stock, journal), pas seulement le code de réponse.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let livreur: Session;
let produit: { id: string; nom: string };
const POSITION = { latitude: 0.43496, longitude: 9.454 };
const NUMERO_MOBILE = '074950001';

let commandeId: string;
let livraisonId: string;
let ligneId: string;

const stockDe = async () => (await sql<{ disponible: number }>(ctx, 'select disponible from stock_niveaux where produit_id = $1', [produit.id]))[0].disponible;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  produit = jeu.produit;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 7, motif: 'Stock du parcours d’achat' } });
  client = await connecter(ctx, '+24174950001');
  livreur = await connecter(ctx, '+24174950011');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  ctx.mypvit.state.defaultStatus = 'SUCCESS';
});
after(async () => { await ctx.close(); await base.stop(); });

test('1. le client trouve l’article par la recherche et par la liste, avec son stock', async () => {
  const recherche = await api(ctx, 'GET', '/produits?q=chargeur');
  assert.ok(recherche.body.some((p: { id: string }) => p.id === produit.id), 'trouvé par la recherche');
  const liste = await api(ctx, 'GET', '/produits');
  assert.ok(liste.body.some((p: { id: string }) => p.id === produit.id), 'visible dans la liste principale');
  const fiche = await api(ctx, 'GET', `/produits/${produit.id}`);
  assert.equal(fiche.body.enStock, true);
  assert.equal(fiche.body.quantiteDisponible, 10);
});

test('2. panier : total calculé côté serveur, frais de livraison inclus, stock non engagé', async () => {
  const r = await api(ctx, 'POST', '/commandes', {
    token: client.token,
    body: { lignes: [{ produitId: produit.id, quantite: 2 }], reception: 'LIVRAISON', livraison: POSITION },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.statut, 'PANIER');
  assert.equal(r.body.sousTotalFcfa, 10000);
  assert.equal(r.body.totalFcfa, r.body.sousTotalFcfa + r.body.fraisLivraisonFcfa);
  commandeId = r.body.id;
  assert.equal(await stockDe(), 10, 'le panier ne réserve rien');
});

test('3. paiement Mobile Money : en attente à l’initiation, payée après vérification, stock vendu une fois', async () => {
  const init = await api(ctx, 'POST', `/commandes/${commandeId}/paiement`, {
    token: client.token,
    body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: NUMERO_MOBILE },
  });
  assert.equal(init.status, 201, JSON.stringify(init.body));
  assert.equal(init.body.statut, 'PENDING');
  const verif = await api(ctx, 'POST', `/commandes/${commandeId}/verifier-paiement`, { token: client.token });
  assert.equal(verif.body.statut, 'SUCCESS', JSON.stringify(verif.body));
  const detail = await api(ctx, 'GET', `/commandes/${commandeId}`, { token: client.token });
  assert.equal(detail.body.statut, 'PAYEE');
  assert.equal(await stockDe(), 8, 'deux articles vendus, une seule fois');
});

test('4. NZE confie la commande payée à un livreur', async () => {
  const r = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.statut, 'ASSIGNEE');
  assert.match(r.body.reference, /^LIV-\d{4}-\d{6}$/);
  livraisonId = r.body.id;
  ligneId = r.body.lignes[0].id;
  const vue = await api(ctx, 'GET', `/livreur/livraisons/${livraisonId}`, { token: livreur.token });
  assert.equal(vue.body.destination.clientTelephone, client.telephone, 'le livreur reçoit le numéro du client');
});

test('5. le livreur démarre, puis remet avec signature papier : la livraison est close', async () => {
  const depart = await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/demarrer`, { token: livreur.token });
  assert.equal(depart.body.statut, 'EN_ROUTE');
  const remise = await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/confirmer`, {
    token: livreur.token,
    body: { signaturePapierRecue: true, lignes: [{ ligneId, quantiteLivree: 2 }], latitude: POSITION.latitude, longitude: POSITION.longitude, commentaire: 'Remis au client' },
  });
  assert.equal(remise.status, 200, JSON.stringify(remise.body));
  assert.equal(remise.body.statut, 'LIVREE');
  assert.equal(remise.body.lignes[0].statutLigne, 'LIVREE');
  const journal = await api(ctx, 'GET', `/admin/journal?action=LIVRAISON_CONFIRMEE&cibleId=${livraisonId}`, { token: admin.token });
  assert.equal(journal.body.length, 1);
  assert.equal(journal.body[0].acteurId, livreur.id);
});

test('6. après la remise : la commande reste payée, le client ne voit aucun code, rien n’est vendu deux fois', async () => {
  const suivi = await api(ctx, 'GET', `/commandes/${commandeId}/livraison`, { token: client.token });
  assert.equal(suivi.status, 200);
  assert.equal(suivi.body.statutActif, null, 'plus de livraison en cours');
  assert.ok(!JSON.stringify(suivi.body).includes('codeLivraison'), 'aucun code de remise');
  const detail = await api(ctx, 'GET', `/commandes/${commandeId}`, { token: client.token });
  assert.equal(detail.body.statut, 'PAYEE');
  assert.equal(await stockDe(), 8, 'le stock n’a pas bougé depuis le paiement');
  const confirmeeDeux = await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/confirmer`, { token: livreur.token, body: { signaturePapierRecue: true, lignes: [{ ligneId, quantiteLivree: 2 }] } });
  assert.equal(confirmeeDeux.status, 409, 'une remise close ne se confirme pas deux fois');
});

test('7. un autre client ne voit ni la commande ni sa livraison', async () => {
  const autre = await connecter(ctx, '+24174950002');
  assert.equal((await api(ctx, 'GET', `/commandes/${commandeId}`, { token: autre.token })).status, 404);
  assert.equal((await api(ctx, 'GET', `/commandes/${commandeId}/livraison`, { token: autre.token })).status, 404);
});
