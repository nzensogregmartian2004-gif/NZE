// Inscription avec profil : nom, prénom, date de naissance et acceptation des conditions, enregistrés ensemble.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, demarrerBase, demarrerContexte, sql, type Contexte } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
const profil = { nom: 'Mba', prenom: 'Awa', dateNaissance: '1990-04-12', accepteConditions: true };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('l’inscription enregistre le nom, le prénom, la date de naissance et l’acceptation des conditions', async () => {
  const r = await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '+24174990501', motDePasse: 'mot-de-passe-test-1', ...profil } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.utilisateur.role, 'client');
  const [u] = await sql<{ nom: string; prenom: string; date_naissance: unknown; conditions_version: string; conditions_acceptees_le: unknown }>(
    ctx, 'select nom, prenom, date_naissance, conditions_version, conditions_acceptees_le from users where telephone = $1', ['+24174990501']);
  assert.equal(u.nom, 'Mba');
  assert.equal(u.prenom, 'Awa');
  const date = u.date_naissance instanceof Date ? u.date_naissance.toISOString().slice(0, 10) : String(u.date_naissance).slice(0, 10);
  assert.equal(date, '1990-04-12');
  assert.equal(u.conditions_version, '1.0');
  assert.ok(u.conditions_acceptees_le);
});

test('sans acceptation des conditions, le compte n’est pas créé', async () => {
  const r = await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '+24174990502', motDePasse: 'mot-de-passe-test-2', ...profil, accepteConditions: false } });
  assert.equal(r.status, 400);
  const lignes = await sql(ctx, 'select id from users where telephone = $1', ['+24174990502']);
  assert.equal(lignes.length, 0);
});

test('une date de naissance dans le futur est refusée', async () => {
  const r = await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '+24174990503', motDePasse: 'mot-de-passe-test-3', ...profil, dateNaissance: '2999-01-01' } });
  assert.equal(r.status, 400);
});

test('l’inscription sans profil reste possible', async () => {
  const r = await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '+24174990504', motDePasse: 'mot-de-passe-test-4' } });
  assert.equal(r.status, 201);
});
