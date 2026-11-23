import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, type Contexte, type Session } from './helpers.ts';
import { LEGAL_VERSION } from '../src/modules/legal/legal.content.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let client: Session;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  client = await connecter(ctx, '+24174600091');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('les conditions sont lisibles sans compte, en français et en anglais', async () => {
  const r = await api(ctx, 'GET', '/legal?lang=en', {});
  assert.equal(r.status, 200);
  assert.equal(r.body.version, LEGAL_VERSION);
  assert.equal(r.body.language, 'en');
  assert.ok(r.body.documents.length >= 2, 'conditions d’utilisation et politique de confidentialité');
  const doc = await api(ctx, 'GET', `/legal/${r.body.documents[0].slug}?lang=en`, {});
  assert.equal(doc.status, 200);
  assert.equal((await api(ctx, 'GET', '/legal/inexistant', {})).status, 404);
});

test('l’acceptation exige un compte, puis est enregistrée avec la version en vigueur', async () => {
  assert.equal((await api(ctx, 'POST', '/legal/accept', {})).status, 401);
  const r = await api(ctx, 'POST', '/legal/accept', { token: client.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.conditionsAcceptees, true);
  const { rows } = await base.pool.query('select conditions_version, conditions_acceptees_le from users where id = $1', [client.id]);
  assert.equal(rows[0].conditions_version, LEGAL_VERSION);
  assert.ok(rows[0].conditions_acceptees_le, 'la date d’acceptation est conservée');
});
