// Cycle de vie des entreprises partenaires (cahier V3.0 §8.4) : transitions, activation liée à la commission, droits.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let entrepriseId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174600120');
  entrepriseId = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Boutique Cycle' } })).body.id;
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const statut = (cible: string, token = admin.token) =>
  api(ctx, 'PATCH', `/admin/entreprises/${entrepriseId}/statut`, { token, body: { statut: cible, motif: 'test' } });

test('une entreprise créée est un prospect', async () => {
  const liste = (await api(ctx, 'GET', '/admin/entreprises', { token: admin.token })).body as Array<{ id: string; statutPartenariat: string }>;
  const e = liste.find((x) => x.id === entrepriseId);
  assert.ok(e, 'entreprise absente de la liste');
  assert.equal(e.statutPartenariat, 'prospect');
});

test('un prospect ne passe pas directement à actif', async () => {
  assert.equal((await statut('actif')).status, 409);
});

test('un prospect passe en négociation', async () => {
  const r = await statut('negociation');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.statut, 'negociation');
});

test('l’activation exige une commission définie', async () => {
  const r = await statut('actif');
  assert.equal(r.status, 409);
  assert.ok(String(r.body.erreur?.message ?? r.body.message ?? '').includes('commission'), JSON.stringify(r.body));
});

test('une fois la commission définie, la négociation aboutit à actif', async () => {
  assert.equal((await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId, tauxBps: 1000 } })).status, 201);
  const r = await statut('actif');
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

test('un partenaire clôturé ne se réactive plus', async () => {
  assert.equal((await statut('cloture')).status, 200);
  assert.equal((await statut('actif')).status, 409);
});

test('un statut inconnu est refusé', async () => {
  assert.equal((await api(ctx, 'PATCH', `/admin/entreprises/${entrepriseId}/statut`, { token: admin.token, body: { statut: 'inconnu' } })).status, 400);
});

test('un client ne peut pas changer le statut d’un partenaire', async () => {
  assert.equal((await statut('negociation', client.token)).status, 403);
});
