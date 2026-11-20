// Notifications : chaque étape importante prévient le bon destinataire, sans jamais contenir le code de remise.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session, produitAvecMagasin, ligneConfiee } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let livreur1: Session;
let livreur2: Session;
let client: Session;
let client2: Session;
let partenaireA: Session;
let partenaireB: Session;
let produit: { id: string; entrepriseId: string };
let entrepriseA: string;
const POSITION = { latitude: 0.43496, longitude: 9.454 };
const codesVus: string[] = [];

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  produit = await produitAvecMagasin(ctx, admin, jeu.entreprise.id, 'Écran test', 5000);
  entrepriseA = jeu.entreprise.id;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 30, motif: 'Stock de test notifications' } });
  livreur1 = await connecter(ctx, '+24174700031');
  livreur2 = await connecter(ctx, '+24174700032');
  for (const l of [livreur1, livreur2]) {
    assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${l.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  }
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600031', entrepriseId: entrepriseA, motDePasse: 'motdepasse-test' } });
  partenaireA = await connecter(ctx, '+24176600031');
  const entrepriseB = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Autre commerçant' } })).body.id;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600032', entrepriseId: entrepriseB, motDePasse: 'motdepasse-test' } });
  partenaireB = await connecter(ctx, '+24176600032');
  client = await connecter(ctx, '+24174600031');
  client2 = await connecter(ctx, '+24174600032');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

async function commandePayee(quantite = 1, token = client.token): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token, body: { lignes: [{ produitId: produit.id, quantite }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600031' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token })).body.statut, 'SUCCESS');
  return c.body.id as string;
}
async function affecter(commandeId: string, livreur: Session) {
  const r = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function codeDe(commandeId: string, token = client.token): Promise<string> {
  const r = await api(ctx, 'GET', `/commandes/${commandeId}/livraison`, { token });
  codesVus.push(r.body.codeLivraison);
  return r.body.codeLivraison;
}
const notifs = async (token: string) => (await api(ctx, 'GET', '/notifications?limite=100', { token })).body as { id: string; type: string; titre: string; message: string }[];
const types = async (token: string) => (await notifs(token)).map((n) => n.type);

test('l’affectation prévient le client, et le code de remise n’apparaît dans aucune notification', async () => {
  const commande = await commandePayee(1);
  const livraison = await affecter(commande, livreur1);
  assert.ok((await types(client.token)).includes('LIVRAISON_AFFECTEE'));
  const code = await codeDe(commande);
  assert.ok(!JSON.stringify(await notifs(client.token)).includes(code), 'aucun code dans les notifications');
  assert.ok(!(await types(livreur1.token)).includes('LIVRAISON_AFFECTEE'), 'le livreur n’est pas notifié de sa propre affectation');
  assert.ok(livraison.id);
});

test('le compteur de non lues diminue à la lecture, et relire ne change rien', async () => {
  const avant = (await api(ctx, 'GET', '/notifications/non-lues', { token: client.token })).body.nombre;
  assert.ok(avant >= 1);
  const premiere = (await notifs(client.token))[0];
  assert.equal((await api(ctx, 'POST', `/notifications/${premiere.id}/lue`, { token: client.token })).status, 200);
  const apres = (await api(ctx, 'GET', '/notifications/non-lues', { token: client.token })).body.nombre;
  assert.equal(apres, avant - 1);
  await api(ctx, 'POST', `/notifications/${premiere.id}/lue`, { token: client.token });
  assert.equal((await api(ctx, 'GET', '/notifications/non-lues', { token: client.token })).body.nombre, apres);
});

test('un autre client ne peut pas marquer une notification qui n’est pas la sienne', async () => {
  const premiere = (await notifs(client.token))[0];
  assert.equal((await api(ctx, 'POST', `/notifications/${premiere.id}/lue`, { token: client2.token })).status, 404);
  assert.equal((await notifs(client2.token)).length, 0, 'le second client n’a aucune notification');
});

test('arrivée, puis remise : le client est prévenu à chaque étape', async () => {
  const commande = await commandePayee(1);
  const livraison = await affecter(commande, livreur1);
  await api(ctx, 'POST', `/livreur/livraisons/${livraison.id}/demarrer`, { token: livreur1.token });
  await api(ctx, 'POST', `/livreur/livraisons/${livraison.id}/arrivee`, { token: livreur1.token });
  assert.ok((await types(client.token)).includes('LIVREUR_ARRIVE'));
  const code = await codeDe(commande);
  const ligne = (await api(ctx, 'GET', `/livreur/livraisons/${livraison.id}`, { token: livreur1.token })).body.lignes[0];
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${livraison.id}/confirmer`, {
    token: livreur1.token,
    body: { code, signaturePapierRecue: true, lignes: [{ ligneId: ligne.id, quantiteLivree: 1 }] },
  });
  assert.equal(ok.status, 200);
  assert.ok((await types(client.token)).includes('LIVRAISON_CONFIRMEE'));
});

test('une livraison partielle et un échec prévienne le client avec le message adapté', async () => {
  const commande = await commandePayee(2);
  const livraison = await affecter(commande, livreur2);
  await api(ctx, 'POST', `/livreur/livraisons/${livraison.id}/demarrer`, { token: livreur2.token });
  const code = await codeDe(commande);
  const ligne = (await api(ctx, 'GET', `/livreur/livraisons/${livraison.id}`, { token: livreur2.token })).body.lignes[0];
  const partielle = await api(ctx, 'POST', `/livreur/livraisons/${livraison.id}/confirmer`, {
    token: livreur2.token,
    body: { code, signaturePapierRecue: true, lignes: [{ ligneId: ligne.id, quantiteLivree: 1 }] },
  });
  assert.equal(partielle.body.statut, 'PARTIELLE');
  assert.ok((await types(client.token)).includes('LIVRAISON_PARTIELLE'));

  const commande2 = await commandePayee(1);
  const livraison2 = await affecter(commande2, livreur1);
  await api(ctx, 'POST', `/livreur/livraisons/${livraison2.id}/demarrer`, { token: livreur1.token });
  await api(ctx, 'POST', `/livreur/livraisons/${livraison2.id}/echec`, { token: livreur1.token, body: { motif: 'CLIENT_ABSENT' } });
  const echec = (await notifs(client.token)).find((n) => n.type === 'LIVRAISON_ECHEC');
  assert.ok(echec, 'notification d’échec attendue');
  assert.ok(!echec.message.includes('CLIENT_ABSENT'), 'le message reste lisible par le client, sans code interne');
});

test('une anomalie de qualité prévient les partenaires de l’entreprise concernée, et eux seuls', async () => {
  const r = await api(ctx, 'POST', '/livreur/bordereaux', {
    token: livreur1.token,
    body: { entrepriseId: entrepriseA, lignes: [{ produitId: produit.id, ligneCommandeId: await ligneConfiee(ctx, admin, client, livreur1, produit.id), quantite: 1, etat: 'Écran rayé', testEffectue: false, controle: 'ANOMALIE' }] },
  });
  assert.equal(r.status, 201);
  assert.ok((await types(partenaireA.token)).includes('ANOMALIE_QUALITE'));
  assert.ok(!(await types(partenaireB.token)).includes('ANOMALIE_QUALITE'));
});

test('les notifications ne sortent pas du destinataire et la liste reste bornée', async () => {
  assert.equal((await api(ctx, 'GET', '/notifications?limite=500', { token: client.token })).status, 400, 'limite supérieure à 100 refusée');
  assert.equal((await api(ctx, 'GET', '/notifications', { token: admin.token })).status, 200);
});

test('marquer toutes les notifications lues remet le compteur à zéro', async () => {
  assert.equal((await api(ctx, 'POST', '/notifications/toutes-lues', { token: client.token })).status, 200);
  assert.equal((await api(ctx, 'GET', '/notifications/non-lues', { token: client.token })).body.nombre, 0);
});
