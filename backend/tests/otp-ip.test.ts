// Limite des demandes de code OTP par adresse IP : empêche de contourner la limite par numéro en changeant de numéro.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, demarrerBase, demarrerContexte, type Contexte } from './helpers.ts';

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

test('au-delà de 30 demandes depuis une même adresse, la demande est refusée, même pour un numéro neuf', async () => {
  for (let i = 0; i < 30; i++) {
    const r = await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: `+2417772${String(i).padStart(4, '0')}` } });
    assert.equal(r.status, 200, `demande ${i + 1} acceptée`);
  }
  const refus = await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: '+24177729999' } });
  assert.equal(refus.status, 429);
  assert.equal(refus.body.erreur.code, 'TROP_DE_DEMANDES');
});
