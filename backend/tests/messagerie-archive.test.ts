// Archive des conversations liées à une réclamation (décision O-11), réponses de NZE, réglage des alertes (cahier V3.0 §17.1).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client1: Session;
let client2: Session;
let produitId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client1 = await connecter(ctx, '+24174600160');
  client2 = await connecter(ctx, '+24174600161');
  const jeu = await jeuDeDonnees(ctx, admin);
  produitId = jeu.produit.id;
  // Une réclamation de client1 sur cet article : ses conversations sur l'article deviennent des archives.
  const c = await api(ctx, 'POST', '/commandes', { token: client1.token, body: { lignes: [{ produitId, quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const [ligne] = await sql<{ id: string }>(ctx, 'SELECT id FROM lignes_commande WHERE commande_id = $1', [c.body.id]);
  const user1 = await sql<{ id: string }>(ctx, 'SELECT id FROM users WHERE telephone = $1', ['+24174600160']);
  await sql(
    ctx,
    `INSERT INTO reclamations (client_id, commande_id, ligne_commande_id, produit_id, nom_article, motif, description, echeance_decision_le)
     VALUES ($1, $2, $3, $4, 'Savon', 'ARTICLE_DEFECTUEUX', 'Article défectueux', now() + interval '72 hours')`,
    [user1[0].id, c.body.id, ligne.id, produitId],
  );
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const notificationsDe = async (session: Session) =>
  (await api(ctx, 'GET', '/notifications', { token: session.token })).body as Array<{ type: string }>;

test('supprimer une conversation liée à une réclamation l’archive pour NZE et la masque au client', async () => {
  const c = await api(ctx, 'POST', '/conversations', { token: client1.token, body: { produitId } });
  assert.equal(c.status, 201);
  assert.equal((await api(ctx, 'POST', `/conversations/${c.body.id}/messages`, { token: client1.token, body: { genre: 'TEXTE', corps: 'Bonjour, mon article est abîmé' } })).status, 201);
  assert.equal((await api(ctx, 'DELETE', `/conversations/${c.body.id}`, { token: client1.token })).status, 204);
  const liste = (await api(ctx, 'GET', '/conversations', { token: client1.token })).body as Array<{ id: string }>;
  assert.ok(!liste.some((x) => x.id === c.body.id), 'la conversation supprimée n’apparaît plus côté client');
  assert.equal((await api(ctx, 'GET', `/conversations/${c.body.id}/messages`, { token: client1.token })).status, 404);
  const archives = (await api(ctx, 'GET', '/admin/conversations/archivees', { token: admin.token })).body as Array<{ id: string }>;
  assert.ok(archives.some((x) => x.id === c.body.id), 'NZE retrouve la conversation archivée');
  const messages = (await api(ctx, 'GET', `/admin/conversations/${c.body.id}/messages`, { token: admin.token })).body as Array<{ corps: string }>;
  assert.ok(messages.some((m) => m.corps === 'Bonjour, mon article est abîmé'));
});

test('les archives sont réservées aux administrateurs', async () => {
  assert.equal((await api(ctx, 'GET', '/admin/conversations/archivees', { token: client2.token })).status, 403);
});

test('après suppression, une nouvelle conversation sur le même article peut être ouverte', async () => {
  const nouvelle = await api(ctx, 'POST', '/conversations', { token: client1.token, body: { produitId } });
  assert.equal(nouvelle.status, 201);
  assert.notEqual(nouvelle.body.id, undefined);
});

test('une réponse de NZE prévient le client, sauf s’il a désactivé les alertes', async () => {
  const c = await api(ctx, 'POST', '/conversations', { token: client1.token, body: { produitId } });
  await api(ctx, 'POST', `/conversations/${c.body.id}/messages`, { token: client1.token, body: { genre: 'TEXTE', corps: 'Question' } });
  const avant = (await notificationsDe(client1)).filter((n) => n.type === 'MESSAGE_RECU').length;
  const reponse = await api(ctx, 'POST', `/conversations/${c.body.id}/messages`, { token: admin.token, body: { genre: 'TEXTE', corps: 'Nous vous répondons' } });
  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  const apres = (await notificationsDe(client1)).filter((n) => n.type === 'MESSAGE_RECU').length;
  assert.equal(apres, avant + 1);
});

test('le client peut désactiver les alertes de messagerie, et la réponse ne prévient plus', async () => {
  assert.equal((await api(ctx, 'GET', '/messagerie/preferences', { token: client1.token })).body.notifMessages, true);
  const maj = await api(ctx, 'PATCH', '/messagerie/preferences', { token: client1.token, body: { notifMessages: false } });
  assert.equal(maj.body.notifMessages, false);
  const c = (await api(ctx, 'GET', '/conversations', { token: client1.token })).body[0];
  const avant = (await notificationsDe(client1)).filter((n) => n.type === 'MESSAGE_RECU').length;
  await api(ctx, 'POST', `/conversations/${c.id}/messages`, { token: admin.token, body: { genre: 'TEXTE', corps: 'Encore une réponse' } });
  const apres = (await notificationsDe(client1)).filter((n) => n.type === 'MESSAGE_RECU').length;
  assert.equal(apres, avant);
});

test('une conversation non liée à une réclamation est supprimée définitivement', async () => {
  const c = await api(ctx, 'POST', '/conversations', { token: client2.token, body: { produitId } });
  await api(ctx, 'POST', `/conversations/${c.body.id}/messages`, { token: client2.token, body: { genre: 'TEXTE', corps: 'Simple question' } });
  assert.equal((await api(ctx, 'DELETE', `/conversations/${c.body.id}`, { token: client2.token })).status, 204);
  const [{ n }] = await sql<{ n: number }>(ctx, 'SELECT count(*)::int AS n FROM conversations WHERE id = $1', [c.body.id]);
  assert.equal(n, 0);
  const archives = (await api(ctx, 'GET', '/admin/conversations/archivees', { token: admin.token })).body as Array<{ id: string }>;
  assert.ok(!archives.some((x) => x.id === c.body.id));
});
