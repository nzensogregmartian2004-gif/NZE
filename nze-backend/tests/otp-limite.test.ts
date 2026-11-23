// Limite des demandes de code OTP par numéro : au-delà du seuil, aucun nouveau code n'est créé ni envoyé.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, demarrerBase, demarrerContexte, sql, type Contexte } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('au-delà de cinq demandes en dix minutes, la demande est refusée (429) et aucun code n’est créé', async () => {
  const telephone = '+24177700001';
  for (let i = 0; i < 5; i++) {
    const r = await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone } });
    assert.equal(r.status, 200, `demande ${i + 1} acceptée`);
  }
  const refus = await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone } });
  assert.equal(refus.status, 429);
  assert.equal(refus.body.erreur.code, 'TROP_DE_DEMANDES');
  const [{ n }] = await sql<{ n: number }>(ctx, 'select count(*)::int as n from otp_codes where telephone = $1', [telephone]);
  assert.equal(n, 5, 'la sixième demande ne crée aucun code');
});

test('la limite porte sur le numéro : un autre numéro reste joignable', async () => {
  const r = await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: '+24177700002' } });
  assert.equal(r.status, 200);
});
