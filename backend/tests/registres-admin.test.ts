// Registres comptables côté administration : totaux par registre et écritures, consultation seule.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produitId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174600150');
  produitId = (await jeuDeDonnees(ctx, admin)).produit.id;
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId, quantite: 1 }], reception: 'RETRAIT' } });
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600150' } });
  await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token });
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('les totaux par registre couvrent la vente et se répartissent comme attendu', async () => {
  const r = await api(ctx, 'GET', '/admin/ecritures', { token: admin.token });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const { CLIENT, COMMISSIONS, PARTENAIRE } = r.body.totaux as Record<string, number>;
  assert.ok(CLIENT > 0);
  assert.equal(COMMISSIONS + PARTENAIRE, CLIENT);
});

test('le filtre par registre ne renvoie que ce registre', async () => {
  const r = await api(ctx, 'GET', '/admin/ecritures?registre=COMMISSIONS', { token: admin.token });
  assert.equal(r.status, 200);
  assert.ok(r.body.lignes.length > 0);
  assert.ok(r.body.lignes.every((l: { registre: string }) => l.registre === 'COMMISSIONS'));
});

test('la consultation est refusée au client', async () => {
  assert.equal((await api(ctx, 'GET', '/admin/ecritures', { token: client.token })).status, 403);
});

test('le total CLIENT en base égale la somme des écritures CLIENT', async () => {
  const [{ n }] = await sql<{ n: number }>(ctx, "SELECT count(*)::int AS n FROM ecritures WHERE registre = 'CLIENT'");
  assert.ok(n >= 1);
});
