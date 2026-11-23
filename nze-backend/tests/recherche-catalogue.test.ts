// Recherche du catalogue : recherche par nom dans la liste de l'accueil (paramètre q).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let ventilateurId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const entrepriseId = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  ventilateurId = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId, nom: 'Ventilateur Solaire', prixFcfa: 15000 } })).body.id;
  await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId, nom: 'Lampe frontale', prixFcfa: 4000 } });
});
after(async () => { await ctx.close(); await base.stop(); });

test('la recherche trouve un article par une partie de son nom, sans tenir compte de la casse', async () => {
  const r = await api(ctx, 'GET', '/produits?q=VENTILATEUR%20solaire');
  assert.equal(r.status, 200);
  assert.deepEqual((r.body as Array<{ id: string }>).map((p) => p.id), [ventilateurId]);
});

test('une recherche sans résultat renvoie une liste vide', async () => {
  const r = await api(ctx, 'GET', '/produits?q=introuvable-xyz');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, []);
});

test('la recherche reste paginée', async () => {
  const r = await api(ctx, 'GET', '/produits?q=lampe&limite=1&decalage=0');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].nom, 'Lampe frontale');
});
