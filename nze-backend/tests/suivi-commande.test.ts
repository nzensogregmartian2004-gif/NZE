// Suivi de commande côté client : confirmée, en préparation, prête, en livraison, livrée.
// Les étapes de préparation sont saisies par l'administration, dans l'ordre, et plus jamais une fois la commande partie en livraison.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, ligneConfiee, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

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
  produit = (await jeuDeDonnees(ctx, admin)).produit;
  client = await connecter(ctx, '+24174950001');
  livreur = await connecter(ctx, '+24174950002');
  const role = await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } });
  assert.equal(role.status, 200);
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 10, motif: 'Stock de test suivi' } });
});
after(async () => {
  await ctx.close();
  await base.stop();
});

// Commande payée (paiement vérifié auprès de MyPVit) : renvoie son identifiant.
async function payerEtConfirmer(): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  const p = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074950001' } });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  const [t] = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where commande_id = $1 order by created_at desc limit 1', [c.body.id]);
  ctx.mypvit.state.statusOverride.set(t.r, { status: 'SUCCESS' });
  const v = await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token });
  assert.equal(v.body.statut, 'SUCCESS');
  return c.body.id as string;
}
const suivi = async (id: string) => (await api(ctx, 'GET', `/commandes/${id}`, { token: client.token })).body.suivi;
const etape = (id: string, e: string) => api(ctx, 'POST', `/admin/commandes/${id}/etape`, { token: admin.token, body: { etape: e } });
const notifications = async (userId: string, type: string) =>
  (await sql<{ n: number }>(ctx, 'select count(*)::int as n from notifications where destinataire_id = $1 and type = $2', [userId, type]))[0].n;

test('suivi : confirmée après paiement, puis en préparation, puis prête, avec notifications au client', async () => {
  const id = await payerEtConfirmer();
  assert.equal(await suivi(id), 'CONFIRMEE');
  assert.equal((await etape(id, 'PRETE')).status, 409, 'on ne passe pas directement à prête');
  assert.equal((await etape(id, 'EN_PREPARATION')).status, 200);
  assert.equal(await suivi(id), 'EN_PREPARATION');
  assert.equal(await notifications(client.id, 'COMMANDE_EN_PREPARATION'), 1);
  assert.equal((await etape(id, 'EN_PREPARATION')).status, 409, 'une étape n’est saisie qu’une fois');
  assert.equal((await etape(id, 'PRETE')).status, 200);
  assert.equal(await suivi(id), 'PRETE');
  assert.equal(await notifications(client.id, 'COMMANDE_PRETE'), 1);
});

test('une commande partie en livraison n’accepte plus d’étape de préparation', async () => {
  const ligne = await ligneConfiee(ctx, admin, client, livreur, produit.id);
  const [{ commande_id: id }] = await sql<{ commande_id: string }>(ctx, 'select commande_id from lignes_commande where id = $1', [ligne]);
  const [{ id: livraison }] = await sql<{ id: string }>(ctx, 'select id from livraisons where commande_id = $1', [id]);
  assert.equal((await api(ctx, 'POST', `/livreur/livraisons/${livraison}/demarrer`, { token: livreur.token })).status, 200);
  assert.equal(await suivi(id), 'EN_LIVRAISON');
  assert.equal((await etape(id, 'EN_PREPARATION')).status, 409);
});

test('seule l’administration saisit les étapes ; une commande non payée n’a pas d’étape', async () => {
  const id = await payerEtConfirmer();
  assert.equal((await api(ctx, 'POST', `/admin/commandes/${id}/etape`, { token: client.token, body: { etape: 'EN_PREPARATION' } })).status, 403);
  assert.equal(await suivi(id), 'CONFIRMEE');
  const brouillon = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal((await etape(brouillon.body.id, 'EN_PREPARATION')).status, 409, 'pas d’étape avant paiement');
  assert.equal(await suivi(brouillon.body.id), null);
});
