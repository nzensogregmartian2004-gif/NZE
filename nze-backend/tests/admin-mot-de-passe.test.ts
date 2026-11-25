// Commande de définition du mot de passe administrateur : connexion réelle, refus des comptes non administrateurs.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, type Contexte } from './helpers.ts';
import { definirMotDePasseAdmin } from '../src/modules/auth/admin-mot-de-passe.ts';

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

test('le compte administrateur se connecte avec le mot de passe défini', async () => {
  assert.equal(await definirMotDePasseAdmin(base.db, '+24101000002', 'mot-de-passe-admin-1'), 'cree');
  const r = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24101000002', motDePasse: 'mot-de-passe-admin-1' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.utilisateur.role, 'admin_principal');
});

test('le mot de passe d’un administrateur existant est remplacé, son rôle est conservé', async () => {
  assert.equal(await definirMotDePasseAdmin(base.db, '+24101000002', 'nouveau-mot-de-passe-2'), 'mis_a_jour');
  const ancien = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24101000002', motDePasse: 'mot-de-passe-admin-1' } });
  assert.notEqual(ancien.status, 200, 'l’ancien mot de passe n’est plus accepté');
  const nouveau = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24101000002', motDePasse: 'nouveau-mot-de-passe-2' } });
  assert.equal(nouveau.status, 200);
  assert.equal(nouveau.body.utilisateur.role, 'admin_principal');
});

test('un compte qui n’est pas administrateur n’est jamais modifié', async () => {
  await connecter(ctx, '+24174999001');
  await assert.rejects(() => definirMotDePasseAdmin(base.db, '+24174999001', 'mot-de-passe-test-99'), /pas administrateur/);
});

test('un mot de passe trop court est refusé', async () => {
  await assert.rejects(() => definirMotDePasseAdmin(base.db, '+24101000003', 'court'), /au moins 10/);
});
