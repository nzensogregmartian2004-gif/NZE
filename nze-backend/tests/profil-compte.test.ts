// Profil du compte : nom, prénom et date de naissance renvoyés, et modifiables pour le nom et le prénom.
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

test('le profil renvoie le nom, le prénom et la date de naissance, puis suit leurs modifications', async () => {
  const inscrit = await api(ctx, 'POST', '/auth/inscription', {
    body: { telephone: '+24174990801', motDePasse: 'mot-de-passe-test-8', prenom: 'Awa', nom: 'Mba', dateNaissance: '1990-04-12', accepteConditions: true },
  });
  assert.equal(inscrit.status, 201, JSON.stringify(inscrit.body));
  const token = inscrit.body.token;

  const profil = await api(ctx, 'GET', '/profil', { token });
  assert.equal(profil.body.prenom, 'Awa');
  assert.equal(profil.body.nom, 'Mba');
  assert.equal(String(profil.body.dateNaissance).slice(0, 10), '1990-04-12');
  assert.equal(profil.body.nomAffiche, 'Awa Mba');

  const modifie = await api(ctx, 'PATCH', '/profil', { token, body: { prenom: 'Awa-Lou' } });
  assert.equal(modifie.status, 200);
  assert.equal(modifie.body.prenom, 'Awa-Lou');
  assert.equal(modifie.body.nomAffiche, 'Awa-Lou Mba', 'le nom affiché suit le prénom');
});
