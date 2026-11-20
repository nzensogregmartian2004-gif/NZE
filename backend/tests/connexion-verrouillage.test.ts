// Verrouillage des connexions par numéro : 5 échecs consécutifs bloquent le numéro pendant 15 minutes.
// Le verrouillage s'applique aussi aux numéros sans compte : il ne révèle donc jamais si un numéro est enregistré.
// Chaque scénario a son propre serveur : la limite par adresse (20 connexions) ne doit pas fausser les autres.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, demarrerBase, demarrerContexte, type Contexte } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
const MDP = 'MotDePasseCorrect1';

before(async () => {
  base = await demarrerBase();
});
after(async () => {
  await base.stop();
});

async function scenario(fn: (ctx: Contexte) => Promise<void>) {
  const ctx = await demarrerContexte(base);
  try {
    await fn(ctx);
  } finally {
    await ctx.close();
  }
}
const connexion = (ctx: Contexte, telephone: string, motDePasse: string) =>
  api(ctx, 'POST', '/auth/connexion', { body: { telephone, motDePasse } });

test('cinq échecs bloquent le numéro : même le bon mot de passe est refusé (429)', () =>
  scenario(async (ctx) => {
    const tel = '+24177740001';
    await api(ctx, 'POST', '/auth/inscription', { body: { telephone: tel, motDePasse: MDP } });
    for (let i = 0; i < 5; i++) assert.equal((await connexion(ctx, tel, 'faux-mot-de-passe')).status, 401, `échec ${i + 1}`);
    const bloque = await connexion(ctx, tel, MDP);
    assert.equal(bloque.status, 429);
    assert.equal(bloque.body.erreur.code, 'COMPTE_VERROUILLE');
  }));

test('le verrouillage s’applique aussi à un numéro sans compte : aucune révélation', () =>
  scenario(async (ctx) => {
    const inconnu = '+24177740002';
    for (let i = 0; i < 5; i++) assert.equal((await connexion(ctx, inconnu, 'faux')).status, 401);
    assert.equal((await connexion(ctx, inconnu, 'faux')).status, 429, 'un numéro inconnu est verrouillé comme un autre');
  }));

test('une connexion réussie remet le compteur à zéro', () =>
  scenario(async (ctx) => {
    const tel = '+24177740003';
    await api(ctx, 'POST', '/auth/inscription', { body: { telephone: tel, motDePasse: MDP } });
    for (let i = 0; i < 4; i++) assert.equal((await connexion(ctx, tel, 'faux')).status, 401);
    assert.equal((await connexion(ctx, tel, MDP)).status, 200, 'quatre échecs puis un succès : pas de verrouillage');
    for (let i = 0; i < 4; i++) assert.equal((await connexion(ctx, tel, 'faux')).status, 401, 'le compteur repart de zéro');
  }));

test('le verrouillage expire après 15 minutes', () =>
  scenario(async (ctx) => {
    const tel = '+24177740004';
    await api(ctx, 'POST', '/auth/inscription', { body: { telephone: tel, motDePasse: MDP } });
    for (let i = 0; i < 5; i++) await connexion(ctx, tel, 'faux');
    assert.equal((await connexion(ctx, tel, MDP)).status, 429);
    await base.pool.query("update tentatives_connexion set verrouille_jusqua = now() - interval '1 minute' where telephone = $1", [tel]);
    assert.equal((await connexion(ctx, tel, MDP)).status, 200, 'après expiration, la connexion est de nouveau possible');
  }));
