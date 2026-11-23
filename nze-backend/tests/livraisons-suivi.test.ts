// Suivi de livraison : statut « arrivé », position GPS du livreur pendant la mission, interrupteur du suivi par NZE.
// La position n'est jamais journalisée, n'est visible du client que si le suivi est activé et récent, et disparaît à la clôture.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let secondaire: Session;
let livreur1: Session;
let livreur2: Session;
let client: Session;
let produit: { id: string };
const POSITION_CLIENT = { latitude: 0.43496, longitude: 9.454 };
const POSITION_LIVREUR = { latitude: 0.4, longitude: 9.45 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  secondaire = await connecter(ctx, '+24101000002');
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  const jeu = await jeuDeDonnees(ctx, admin);
  produit = jeu.produit;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 30, motif: 'Stock de test suivi' } });
  livreur1 = await connecter(ctx, '+24174700021');
  livreur2 = await connecter(ctx, '+24174700022');
  for (const l of [livreur1, livreur2]) {
    assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${l.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  }
  client = await connecter(ctx, '+24174600040');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

async function commandePayee(): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION_CLIENT } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600040' } });
  const v = await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token });
  assert.equal(v.body.statut, 'SUCCESS', JSON.stringify(v.body));
  return c.body.id as string;
}

async function affecter(commandeId: string, livreur: Session): Promise<string> {
  const r = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id as string;
}

const position = (id: string, token: string, body: unknown) => api(ctx, 'POST', `/livreur/livraisons/${id}/position`, { token, body });

let livraison: string;
let commande: string;
let ligneId: string;

test('le suivi GPS est désactivé par défaut, et seul l’administrateur principal peut l’activer', async () => {
  const etat = await api(ctx, 'GET', '/admin/reglages/suivi-gps', { token: admin.token });
  assert.equal(etat.status, 200);
  assert.equal(etat.body.actif, false);
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/suivi-gps', { token: secondaire.token, body: { actif: true } })).status, 403);
});

test('une position n’est acceptée qu’en mission démarrée, et seulement si le suivi est activé', async () => {
  commande = await commandePayee();
  livraison = await affecter(commande, livreur1);
  assert.equal((await position(livraison, livreur1.token, POSITION_LIVREUR)).status, 409, 'pas de position avant démarrage');
  assert.equal((await api(ctx, 'POST', `/livreur/livraisons/${livraison}/arrivee`, { token: livreur1.token })).status, 409, 'pas d’arrivée avant démarrage');

  await api(ctx, 'POST', `/livreur/livraisons/${livraison}/demarrer`, { token: livreur1.token });
  const refus = await position(livraison, livreur1.token, POSITION_LIVREUR);
  assert.equal(refus.status, 409);
  assert.equal(refus.body.erreur.code, 'SUIVI_GPS_DESACTIVE');
});

test('NZE active le suivi : la position du livreur est acceptée et la distance restante calculée', async () => {
  const active = await api(ctx, 'PUT', '/admin/reglages/suivi-gps', { token: admin.token, body: { actif: true } });
  assert.equal(active.status, 200);
  assert.equal(active.body.actif, true);
  const journal = await api(ctx, 'GET', '/admin/journal?action=SUIVI_GPS_DEFINI', { token: admin.token });
  assert.equal(journal.body.length, 1);

  const ok = await position(livraison, livreur1.token, POSITION_LIVREUR);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(typeof ok.body.distanceVolOiseauM, 'number');
  assert.ok(ok.body.distanceVolOiseauM > 0);

  const suivi = await api(ctx, 'GET', `/commandes/${commande}/livraison`, { token: client.token });
  assert.equal(suivi.body.statutActif, 'EN_ROUTE');
  assert.equal(suivi.body.positionLivreur.latitude, POSITION_LIVREUR.latitude);
  assert.equal(suivi.body.positionLivreur.longitude, POSITION_LIVREUR.longitude);
});

test('un autre livreur ne peut pas envoyer la position d’une mission qui n’est pas la sienne', async () => {
  assert.equal((await position(livraison, livreur2.token, POSITION_LIVREUR)).status, 403);
});

test('des coordonnées hors limites sont refusées', async () => {
  assert.equal((await position(livraison, livreur1.token, { latitude: 95, longitude: 9 })).status, 400);
});

test('l’arrivée chez le client est signalée, et la livraison peut être clôturée depuis ce statut', async () => {
  const arrivee = await api(ctx, 'POST', `/livreur/livraisons/${livraison}/arrivee`, { token: livreur1.token });
  assert.equal(arrivee.status, 200);
  assert.equal(arrivee.body.statut, 'ARRIVE');
  assert.ok(arrivee.body.arriveLe);

  const suivi = await api(ctx, 'GET', `/commandes/${commande}/livraison`, { token: client.token });
  assert.equal(suivi.body.statutActif, 'ARRIVE');
  assert.equal((await position(livraison, livreur1.token, POSITION_LIVREUR)).status, 200, 'la position reste envoyée à l’arrivée');

  assert.ok(!('codeLivraison' in suivi.body), 'aucun code de remise n’est émis : la preuve est la signature papier');
  const detail = await api(ctx, 'GET', `/livreur/livraisons/${livraison}`, { token: livreur1.token });
  ligneId = detail.body.lignes[0].id;
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${livraison}/confirmer`, {
    token: livreur1.token,
    body: { signaturePapierRecue: true, lignes: [{ ligneId, quantiteLivree: 1 }] },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.statut, 'LIVREE');
});

test('à la clôture, la position disparaît : ni le client, ni l’administration ne la voient', async () => {
  const suivi = await api(ctx, 'GET', `/commandes/${commande}/livraison`, { token: client.token });
  assert.equal(suivi.body.positionLivreur, null);
  const admin1 = await api(ctx, 'GET', `/admin/livraisons/${livraison}`, { token: admin.token });
  assert.equal(admin1.body.positionLivreur, null);
  assert.equal(admin1.body.livreurLatitude, undefined, 'les champs bruts ne sortent jamais');
});

test('désactiver le suivi coupe la position visible du client, même pendant une mission', async () => {
  const commande2 = await commandePayee();
  const livraison2 = await affecter(commande2, livreur2);
  await api(ctx, 'POST', `/livreur/livraisons/${livraison2}/demarrer`, { token: livreur2.token });
  assert.equal((await position(livraison2, livreur2.token, POSITION_LIVREUR)).status, 200);
  assert.notEqual((await api(ctx, 'GET', `/commandes/${commande2}/livraison`, { token: client.token })).body.positionLivreur, null);

  await api(ctx, 'PUT', '/admin/reglages/suivi-gps', { token: admin.token, body: { actif: false } });
  assert.equal((await api(ctx, 'GET', `/commandes/${commande2}/livraison`, { token: client.token })).body.positionLivreur, null);
  assert.equal((await position(livraison2, livreur2.token, POSITION_LIVREUR)).body.erreur.code, 'SUIVI_GPS_DESACTIVE');
});

test('les positions ne sont jamais journalisées : seules les actions de mission apparaissent', async () => {
  const entrees = await api(ctx, 'GET', `/admin/journal?cibleId=${livraison}&limite=200`, { token: admin.token });
  const actions = entrees.body.map((e: { action: string }) => e.action);
  assert.ok(!actions.some((a: string) => /POSITION|GPS_POINT|PING/.test(a)));
  assert.ok(actions.includes('LIVREUR_ARRIVE'));
  assert.ok(actions.includes('LIVRAISON_CONFIRMEE'));
});
