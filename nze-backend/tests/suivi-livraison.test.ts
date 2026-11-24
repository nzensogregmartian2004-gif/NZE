// Suivi de livraison côté client : état de la livraison et distance restante, seulement si le suivi GPS est activé
// par l'administration et si le livreur a transmis sa position.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, ligneConfiee, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let livreur: Session;
let produit: { id: string };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  client = await connecter(ctx, '+24174950301');
  livreur = await connecter(ctx, '+24174950302');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  produit = await produitAvecMagasin(ctx, admin, entreprise, 'Article suivi', 4000);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('le client voit l’état de sa livraison ; la position n’est pas transmise tant que le suivi GPS est désactivé', async () => {
  const ligne = await ligneConfiee(ctx, admin, client, livreur, produit.id);
  const [{ commande_id: commandeId }] = await sql<{ commande_id: string }>(ctx, 'select commande_id from lignes_commande where id = $1', [ligne]);
  const [{ id: livraisonId }] = await sql<{ id: string }>(ctx, 'select id from livraisons where commande_id = $1', [commandeId]);

  const avant = await api(ctx, 'GET', `/commandes/${commandeId}`, { token: client.token });
  assert.equal(avant.body.livraison.statut, 'ASSIGNEE');
  assert.equal(avant.body.livraison.distanceRestanteMetres, null, 'pas de distance sans position');
  assert.equal(avant.body.livraison.positionMiseAJourLe, null);

  assert.equal((await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/demarrer`, { token: livreur.token })).status, 200);
  const refus = await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/position`, { token: livreur.token, body: { latitude: 0.39, longitude: 9.454 } });
  assert.equal(refus.status, 409, 'le suivi GPS doit être activé par l’administration');
  assert.match(JSON.stringify(refus.body), /GPS/, 'le message indique que le suivi GPS est désactivé');

  assert.equal((await api(ctx, 'PUT', '/admin/reglages/suivi-gps', { token: admin.token, body: { actif: true } })).status, 200);
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${livraisonId}/position`, { token: livreur.token, body: { latitude: 0.39, longitude: 9.454 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const apres = await api(ctx, 'GET', `/commandes/${commandeId}`, { token: client.token });
  assert.notEqual(apres.body.livraison.positionMiseAJourLe, null, 'la position transmise est visible du client');
  assert.ok('distanceRestanteMetres' in apres.body.livraison);
  assert.deepEqual(apres.body.livraison.livreur, { latitude: 0.39, longitude: 9.454 }, 'la carte client reçoit la position du livreur');
  assert.ok('destination' in apres.body.livraison);
  await api(ctx, 'PUT', '/admin/reglages/suivi-gps', { token: admin.token, body: { actif: false } });
});
