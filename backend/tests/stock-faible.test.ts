// Alerte de stock faible : envoyée à l'administration et au partenaire concerné, une seule fois au franchissement du seuil.
// Déclenchée par un ajustement, un signalement ou une réservation qui fait passer le stock vendable sous le seuil ;
// jamais par une libération. Un partenaire d'une autre entreprise ne reçoit rien.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, MDP_TEST, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let partenaire: Session;
let partenaireAutre: Session;
let produit: { id: string };
let entreprise: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  entreprise = jeu.entreprise.id;
  produit = jeu.produit;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176900001', entrepriseId: entreprise, motDePasse: MDP_TEST } });
  partenaire = await connecter(ctx, '+24176900001');
  const autre = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Autre commerçant alerte' } })).body.id;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176900002', entrepriseId: autre, motDePasse: MDP_TEST } });
  partenaireAutre = await connecter(ctx, '+24176900002');
  client = await connecter(ctx, '+24174900001');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const disponibilites = async () =>
  (await sql<{ disponible: number; reserve: number }>(ctx, 'select disponible, reserve from stock_niveaux where produit_id = $1', [produit.id]))[0];
const alertes = async (userId: string) =>
  (await sql<{ n: number }>(ctx, "select count(*)::int as n from notifications where destinataire_id = $1 and type = 'STOCK_FAIBLE'", [userId]))[0].n;
const ajuster = async (delta: number) => {
  const r = await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta, motif: 'Test alerte' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
};
const fixer = async (cible: number) => ajuster(cible - (await disponibilites()).disponible);
const commander = (token: string) => api(ctx, 'POST', '/commandes', { token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
const payer = (token: string, id: string) =>
  api(ctx, 'POST', `/commandes/${id}/paiement`, { token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074900001' } });
const derniereRef = async (id: string) =>
  (await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where commande_id = $1 order by created_at desc limit 1', [id]))[0].r;

test('franchissement du seuil : une alerte à l’administration et au partenaire, une seule fois', async () => {
  await fixer(6);
  assert.equal(await alertes(admin.id), 0, 'au-dessus du seuil : aucune alerte');
  await ajuster(-2); // 4 : toujours au-dessus du seuil
  assert.equal(await alertes(admin.id), 0);
  await ajuster(-1); // 3 : franchissement
  assert.equal(await alertes(admin.id), 1);
  assert.equal(await alertes(partenaire.id), 1, 'le partenaire concerné est prévenu');
  await ajuster(-1); // 2 : déjà sous le seuil, pas de nouvelle alerte
  assert.equal(await alertes(admin.id), 1, 'pas de répétition sous le seuil');
  await ajuster(4); // 6 : remontée, sans alerte
  assert.equal(await alertes(admin.id), 1);
  await ajuster(-3); // 3 : nouveau franchissement
  assert.equal(await alertes(admin.id), 2, 'une nouvelle alerte à chaque franchissement');
});

test('une réservation qui fait passer le stock vendable sous le seuil déclenche l’alerte ; sa libération non', async () => {
  await fixer(5);
  const avant = await alertes(admin.id);
  const a = await commander(client.token);
  assert.equal((await payer(client.token, a.body.id)).status, 201);
  assert.equal(await alertes(admin.id), avant, 'vendable à 4 : pas encore sous le seuil');
  const b = await commander(client.token);
  assert.equal((await payer(client.token, b.body.id)).status, 201);
  assert.equal(await alertes(admin.id), avant + 1, 'vendable à 3 : franchissement par la réservation');
  for (const id of [a.body.id, b.body.id]) {
    ctx.mypvit.state.statusOverride.set(await derniereRef(id), { status: 'FAILED' });
    await api(ctx, 'POST', `/commandes/${id}/verifier-paiement`, { token: client.token });
  }
  assert.deepEqual(await disponibilites(), { disponible: 5, reserve: 0 }, 'les réservations sont libérées');
  assert.equal(await alertes(admin.id), avant + 1, 'la libération ne déclenche aucune alerte');
});

test('un partenaire d’une autre entreprise ne reçoit aucune alerte de ce produit', async () => {
  assert.equal(await alertes(partenaireAutre.id), 0);
});
