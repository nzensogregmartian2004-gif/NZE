// Connexion par mot de passe : au-delà de 20 tentatives par adresse et par 10 minutes, la connexion est refusée (429).
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

test('au-delà de 20 tentatives de connexion par adresse en 10 minutes, la connexion est refusée (429)', async () => {
  // Un numéro différent à chaque tentative : on teste la limite par adresse, pas le verrouillage par numéro.
  for (let i = 0; i < 20; i++) {
    const r = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: `+2417773${String(i).padStart(4, '0')}`, motDePasse: 'mauvais-essai' } });
    assert.equal(r.status, 401, `tentative ${i + 1} refusée pour identifiants incorrects`);
  }
  const refus = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24177739999', motDePasse: 'mauvais-essai' } });
  assert.equal(refus.status, 429);
  assert.equal(refus.body.erreur.code, 'TROP_DE_REQUETES');
});
