// Permissions par module et par action (cahier V3.0 §4.2) : l'administrateur principal approuve les retraits (O-1).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { peut } from '../src/core/permissions.ts';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let principal: Session;
let secondaire: Session;
let client: Session;
let entrepriseId: string;
const INCONNU = '00000000-0000-4000-8000-000000000000';

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  principal = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  secondaire = await connecter(ctx, '+24101000002');
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  client = await connecter(ctx, '+24174600140');
  entrepriseId = (await jeuDeDonnees(ctx, principal)).entreprise.id;
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('la matrice réserve l’approbation des retraits à l’administrateur principal', () => {
  assert.equal(peut('admin_principal', 'retraits.approuver'), true);
  assert.equal(peut('admin_secondaire', 'retraits.approuver'), false);
  assert.equal(peut('client', 'retraits.consulter'), false);
});

test('l’administrateur secondaire ne peut pas approuver ni verser un retrait', async () => {
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${INCONNU}/decision`, { token: secondaire.token, body: { decision: 'APPROUVER' } })).status, 403);
  assert.equal((await api(ctx, 'POST', `/admin/retraits/${INCONNU}/verifier-versement`, { token: secondaire.token, body: {} })).status, 403);
});

test('l’administrateur principal passe la vérification des permissions sur la décision', async () => {
  const r = await api(ctx, 'POST', `/admin/retraits/${INCONNU}/decision`, { token: principal.token, body: { decision: 'APPROUVER' } });
  assert.notEqual(r.status, 403, JSON.stringify(r.body));
});

test('l’administrateur secondaire garde la consultation des retraits et la gestion des commissions', async () => {
  assert.equal((await api(ctx, 'GET', '/admin/retraits', { token: secondaire.token })).status, 200);
  const c = await api(ctx, 'POST', '/admin/commissions', { token: secondaire.token, body: { entrepriseId, tauxBps: 800 } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
});

test('un client n’accède à aucune action d’administration', async () => {
  assert.equal((await api(ctx, 'GET', '/admin/retraits', { token: client.token })).status, 403);
  assert.equal((await api(ctx, 'POST', '/admin/commissions', { token: client.token, body: { entrepriseId, tauxBps: 800 } })).status, 403);
});
