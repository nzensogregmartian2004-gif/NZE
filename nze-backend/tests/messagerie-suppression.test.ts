// Suppression définitive d'une conversation (point O-11) : propriétaire seul, messages effacés, réouverture possible.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let client: Session;
let autre: Session;
let produitId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  const admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  produitId = (await jeuDeDonnees(ctx, admin)).produit.id;
  client = await connecter(ctx, '+24174600160');
  autre = await connecter(ctx, '+24174600161');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('le client supprime sa conversation : elle et ses messages disparaissent', async () => {
  const c = await api(ctx, 'POST', '/conversations', { token: client.token, body: { produitId } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/conversations/${c.body.id}/messages`, { token: client.token, body: { genre: 'TEXTE', corps: 'Bonjour' } });
  const r = await api(ctx, 'DELETE', `/conversations/${c.body.id}`, { token: client.token });
  assert.equal(r.status, 204, JSON.stringify(r.body));
  const restants = await sql<{ n: number }>(ctx, 'SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1', [c.body.id]);
  assert.equal(restants[0].n, 0, 'les messages sont effacés');
  assert.equal((await api(ctx, 'GET', `/conversations/${c.body.id}/messages`, { token: client.token })).status, 404);
});

test('un autre utilisateur ne peut pas supprimer la conversation d’autrui', async () => {
  const c = await api(ctx, 'POST', '/conversations', { token: client.token, body: { produitId } });
  assert.equal((await api(ctx, 'DELETE', `/conversations/${c.body.id}`, { token: autre.token })).status, 403);
  assert.equal((await api(ctx, 'GET', `/conversations/${c.body.id}/messages`, { token: client.token })).status, 200, 'la conversation reste intacte');
});

test('après suppression, une nouvelle conversation pour le même article peut être ouverte', async () => {
  const premiere = await api(ctx, 'POST', '/conversations', { token: client.token, body: { produitId } });
  await api(ctx, 'DELETE', `/conversations/${premiere.body.id}`, { token: client.token });
  const nouvelle = await api(ctx, 'POST', '/conversations', { token: client.token, body: { produitId } });
  assert.equal(nouvelle.status, 201);
  assert.notEqual(nouvelle.body.id, premiere.body.id);
});
