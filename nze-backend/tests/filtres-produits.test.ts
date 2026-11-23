// Filtres essentiels du catalogue client : en stock, fourchette de prix, tri.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let entrepriseId: string;
let enStockId: string;
let ruptureId: string;
const ID = (liste: Array<{ id: string }>) => liste.map((p) => p.id);

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  entrepriseId = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  const bon = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId, nom: 'Savon filtre', prixFcfa: 2000 } })).body;
  await api(ctx, 'POST', `/admin/produits/${bon.id}/ajustements`, { token: admin.token, body: { delta: 4, motif: 'Stock de test filtres' } });
  enStockId = bon.id;
  ruptureId = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId, nom: 'Huile filtre', prixFcfa: 9000 } })).body.id;
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('le filtre « en stock » exclut les articles en rupture', async () => {
  const r = await api(ctx, 'GET', '/produits?enStock=true');
  assert.equal(r.status, 200);
  assert.ok(ID(r.body).includes(enStockId));
  assert.ok(!ID(r.body).includes(ruptureId));
  assert.ok(r.body.every((p: { enStock: boolean }) => p.enStock === true));
});

test('la fourchette de prix ne garde que les articles dans les bornes', async () => {
  const r = await api(ctx, 'GET', '/produits?prixMin=5000');
  assert.ok(!ID(r.body).includes(enStockId), 'l’article à 2000 est hors fourchette');
  assert.ok(ID(r.body).includes(ruptureId));
  const borne = await api(ctx, 'GET', '/produits?prixMax=2000');
  assert.ok(ID(borne.body).includes(enStockId));
  assert.ok(!ID(borne.body).includes(ruptureId));
});

test('le tri par prix range les articles dans l’ordre demandé', async () => {
  const croissant = (await api(ctx, 'GET', '/produits?tri=prix-croissant')).body as Array<{ prixFcfa: number }>;
  const decroissant = (await api(ctx, 'GET', '/produits?tri=prix-decroissant')).body as Array<{ prixFcfa: number }>;
  for (let i = 1; i < croissant.length; i++) assert.ok(croissant[i - 1].prixFcfa <= croissant[i].prixFcfa);
  for (let i = 1; i < decroissant.length; i++) assert.ok(decroissant[i - 1].prixFcfa >= decroissant[i].prixFcfa);
});

test('un paramètre de tri ou de prix invalide est refusé', async () => {
  assert.equal((await api(ctx, 'GET', '/produits?tri=n-importe-quoi')).status, 400);
  assert.equal((await api(ctx, 'GET', '/produits?prixMin=-5')).status, 400);
});
