// Promotions : seules les offres en cours sont renvoyées, avec le prix après réduction en FCFA entiers.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let produit: { id: string };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  produit = await produitAvecMagasin(ctx, admin, entreprise, 'Article en promotion', 10000);
  await sql(ctx, `insert into promotions (produit_id, titre, pourcentage, debut, fin) values
    ($1, 'Top offre test', 20, now() - interval '1 hour', now() + interval '1 day'),
    ($1, 'Offre expirée', 50, now() - interval '2 days', now() - interval '1 day'),
    ($1, 'Offre future', 30, now() + interval '1 day', now() + interval '2 days')`, [produit.id]);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('seules les offres en cours sont renvoyées, sans connexion, avec le prix après réduction', async () => {
  const r = await api(ctx, 'GET', '/promotions');
  assert.equal(r.status, 200);
  const offres = r.body.filter((o: { produitId: string }) => o.produitId === produit.id);
  assert.equal(offres.length, 1, JSON.stringify(offres));
  assert.equal(offres[0].titre, 'Top offre test');
  assert.equal(offres[0].prixAvantFcfa, 10000);
  assert.equal(offres[0].prixApresFcfa, 8000);
});
