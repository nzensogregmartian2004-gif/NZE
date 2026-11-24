// Cartographie (décision 18, Google Maps) : frais de livraison sur la distance routière. Pas de distance, pas de commande.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerCartographie } from '../src/modules/cartographie/index.ts';
import { api, CLE_GOOGLE_TEST, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produitId: string;
const POSITION = { latitude: 0.43496, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  produitId = (await jeuDeDonnees(ctx, admin)).produit.id;
  client = await connecter(ctx, '+24174600071');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

function reinitialiser() {
  const s = ctx.gmaps.state;
  s.distanceM = null;
  s.statutGlobal = 'OK';
  s.statutElement = 'OK';
  s.reseauCoupe = false;
}
const commander = (reception = 'LIVRAISON') =>
  api(ctx, 'POST', '/commandes', {
    token: client.token,
    body: { lignes: [{ produitId, quantite: 1 }], reception, ...(reception === 'LIVRAISON' ? { livraison: POSITION } : {}) },
  });
const nbCommandes = async () => (await base.pool.query('select count(*)::int as n from commandes where user_id = $1', [client.id])).rows[0].n as number;

test('Mapbox reçoit le départ, la destination en longitude,latitude, le profil voiture et le jeton serveur', async () => {
  reinitialiser();
  const avant = ctx.gmaps.state.requetes.length;
  assert.equal((await commander()).status, 201);
  const url = new URL(ctx.gmaps.state.requetes[avant].url);
  assert.ok(url.pathname.startsWith('/directions-matrix/v1/mapbox/driving/'), url.pathname);
  const paires = (url.pathname.split('/').pop() ?? '').split(';');
  assert.equal(paires[1], `${POSITION.longitude},${POSITION.latitude}`);
  assert.equal(url.searchParams.get('access_token'), CLE_GOOGLE_TEST);
  assert.equal(url.searchParams.get('annotations'), 'distance,duration');
});

test('la distance routière de Google est celle de la commande, avec son fournisseur et sa date de calcul', async () => {
  reinitialiser();
  ctx.gmaps.state.distanceM = 4321;
  const r = await commander();
  assert.equal(r.status, 201, JSON.stringify(r.body));
  // 4,321 km × 300 FCFA, supérieur au minimum de 500 FCFA
  assert.equal(r.body.fraisLivraisonFcfa, 1297);
  const { rows } = await base.pool.query('select distance_m, fournisseur_distance, distance_calculee_le from commandes where id = $1', [r.body.id]);
  assert.equal(rows[0].distance_m, 4321);
  assert.equal(rows[0].fournisseur_distance, 'MAPBOX');
  assert.ok(rows[0].distance_calculee_le instanceof Date);
});

test('une adresse hors réseau routier est refusée, et aucune commande n’est créée', async () => {
  reinitialiser();
  ctx.gmaps.state.statutElement = 'ZERO_RESULTS';
  const avant = await nbCommandes();
  const r = await commander();
  assert.equal(r.status, 422);
  assert.equal(r.body.erreur.code, 'ADRESSE_HORS_RESEAU');
  assert.equal(await nbCommandes(), avant);
});

test('un refus de Google (clé ou quota) est signalé comme indisponibilité, sans commande', async () => {
  reinitialiser();
  ctx.gmaps.state.statutGlobal = 'REQUEST_DENIED';
  const avant = await nbCommandes();
  const r = await commander();
  assert.equal(r.status, 503);
  assert.equal(r.body.erreur.code, 'CARTOGRAPHIE_INDISPONIBLE');
  assert.equal(await nbCommandes(), avant);
});

test('un réseau coupé ne laisse pas passer une commande, et le message ne contient jamais la clé', async () => {
  reinitialiser();
  ctx.gmaps.state.reseauCoupe = true;
  const avant = await nbCommandes();
  const r = await commander();
  assert.equal(r.status, 503);
  assert.equal(await nbCommandes(), avant);
  assert.ok(!JSON.stringify(r.body).includes(CLE_GOOGLE_TEST), 'la clé ne sort dans aucune réponse');
});

test('une commande en retrait n’appelle pas la cartographie', async () => {
  reinitialiser();
  const avant = ctx.gmaps.state.appels.length;
  assert.equal((await commander('RETRAIT')).status, 201);
  assert.equal(ctx.gmaps.state.appels.length, avant);
});

test('au paiement, les frais sont recalculés sur la distance routière du moment, et la trace est mise à jour', async () => {
  reinitialiser();
  ctx.gmaps.state.distanceM = 4321;
  const c = await commander();
  assert.equal(c.status, 201);
  ctx.gmaps.state.distanceM = 9000;
  const p = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, {
    token: client.token,
    body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600071' },
  });
  assert.ok(p.status < 300, JSON.stringify(p.body));
  const { rows } = await base.pool.query('select frais_livraison_fcfa, distance_m, fournisseur_distance from commandes where id = $1', [c.body.id]);
  assert.equal(rows[0].distance_m, 9000);
  assert.equal(rows[0].frais_livraison_fcfa, 2700);
  assert.equal(rows[0].fournisseur_distance, 'MAPBOX');
});

test('la configuration refuse l’estimation en production et exige le jeton Mapbox', () => {
  assert.throws(() => chargerCartographie({ CARTOGRAPHIE: 'estimation' }, 'production'), /interdit en production/);
  assert.throws(() => chargerCartographie({ CARTOGRAPHIE: 'mapbox' }, 'development'), /MAPBOX_ACCESS_TOKEN requis/);
  assert.equal(chargerCartographie({ CARTOGRAPHIE: 'estimation' }, 'development').fournisseur, 'ESTIMATION_VOL_OISEAU');
  assert.equal(chargerCartographie({ MAPBOX_ACCESS_TOKEN: 'jeton' }, 'production').fournisseur, 'MAPBOX');
});
