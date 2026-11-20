// Messagerie client-NZE liée à un article : une conversation par article, types de message, accès restreint.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let client: Session;
let autre: Session;
let produitId: string;
let conversationId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  const admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  produitId = (await jeuDeDonnees(ctx, admin)).produit.id;
  client = await connecter(ctx, '+24174300001');
  autre = await connecter(ctx, '+24174300002');
});
after(async () => { await ctx.close(); await base.stop(); });

test('une conversation par article : même conversation réouverte', async () => {
  const a = await api(ctx, 'POST', '/conversations', { token: client.token, body: { produitId } });
  assert.equal(a.status, 201);
  conversationId = a.body.id;
  const b = await api(ctx, 'POST', '/conversations', { token: client.token, body: { produitId } });
  assert.equal(b.body.id, conversationId);
});

test('texte, photo, vidéo et vocal sont acceptés avec leurs limites', async () => {
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'TEXTE', corps: 'Bonjour, ce chargeur est-il compatible ?' } })).status, 201);
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'PHOTO', fichierCle: 'msg/photo-1.jpg' } })).status, 201);
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'VIDEO', fichierCle: 'msg/video-1.mp4', dureeSec: 45 } })).status, 201);
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'VOCAL', fichierCle: 'msg/vocal-1.m4a', dureeSec: 30 } })).status, 201);
});

test('limites : vocal de plus de 2 minutes, vidéo de plus de 60 secondes, texte vide refusés', async () => {
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'VOCAL', fichierCle: 'msg/x.m4a', dureeSec: 200 } })).status, 400);
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'VIDEO', fichierCle: 'msg/x.mp4', dureeSec: 90 } })).status, 400);
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'TEXTE', corps: '   ' } })).status, 400);
  assert.equal((await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'PHOTO' } })).status, 400);
});

test('l’historique est lisible par son auteur, pas par un autre client', async () => {
  const mine = await api(ctx, 'GET', `/conversations/${conversationId}/messages`, { token: client.token });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.length, 4);
  const intrus = await api(ctx, 'GET', `/conversations/${conversationId}/messages`, { token: autre.token });
  assert.equal(intrus.status, 403);
});

test('un article inexistant ne peut pas ouvrir de conversation', async () => {
  const r = await api(ctx, 'POST', '/conversations', { token: client.token, body: { produitId: '00000000-0000-4000-8000-000000000000' } });
  assert.equal(r.status, 404);
});
