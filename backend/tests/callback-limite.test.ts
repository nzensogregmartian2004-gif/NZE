// Limite du callback MyPVit : chaque appel valide déclenche une vérification auprès de PVit, donc il est limité par adresse.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrerBase, demarrerContexte, type Contexte } from './helpers.ts';

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

const appelCallback = () =>
  fetch(`${ctx.base}/paiements/callback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

test('au-delà de 60 appels par minute, le callback répond 429 avant tout traitement', async () => {
  for (let i = 0; i < 60; i++) {
    const r = await appelCallback();
    assert.notEqual(r.status, 429, `appel ${i + 1} accepté`);
  }
  const refus = await appelCallback();
  assert.equal(refus.status, 429);
  assert.equal((await refus.json()).erreur.code, 'TROP_DE_REQUETES');
});
