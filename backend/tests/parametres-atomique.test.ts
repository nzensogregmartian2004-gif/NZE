// Paramétrage : point fixe et tarif de livraison. La trace part avec la valeur, dans la même transaction.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { definirPointFixe, definirTarif } from '../src/modules/parametres/service.ts';
import { api, connecter, demarrerBase, demarrerContexte, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('un tarif ou un point fixe dont la trace échoue n’est pas enregistré', async () => {
  const tarifsAvant = await base.pool.query('select count(*)::int as n from tarifs_livraison');
  const pointsAvant = await base.pool.query('select count(*)::int as n from points_fixes');
  await assert.rejects(() => definirTarif(base.db, 300, 500, randomUUID()));
  await assert.rejects(() => definirPointFixe(base.db, 'Point test', 0.4, 9.4, randomUUID()));
  assert.equal((await base.pool.query('select count(*)::int as n from tarifs_livraison')).rows[0].n, tarifsAvant.rows[0].n);
  assert.equal((await base.pool.query('select count(*)::int as n from points_fixes')).rows[0].n, pointsAvant.rows[0].n);
});

test('un tarif valide est journalisé avec son auteur, dans le même mouvement', async () => {
  const r = await api(ctx, 'POST', '/admin/livraison/tarif', { token: admin.token, body: { fcfaParKm: 350, minimumFcfa: 600 } });
  assert.equal(r.status, 201);
  const journal = await api(ctx, 'GET', `/admin/journal?action=TARIF_DEFINI&cibleId=${r.body.id}`, { token: admin.token });
  assert.equal(journal.body.length, 1);
  assert.equal(journal.body[0].acteurId, admin.id);
  assert.deepEqual(journal.body[0].details, { fcfaParKm: 350, minimumFcfa: 600 });
});

test('un point fixe valide est journalisé avec son auteur', async () => {
  const r = await api(ctx, 'POST', '/admin/livraison/point-fixe', { token: admin.token, body: { libelle: 'Siège NZE', latitude: 0.39, longitude: 9.454 } });
  assert.equal(r.status, 201);
  const journal = await api(ctx, 'GET', `/admin/journal?action=POINT_FIXE_DEFINI&cibleId=${r.body.id}`, { token: admin.token });
  assert.equal(journal.body.length, 1);
  assert.equal(journal.body[0].acteurId, admin.id);
});
