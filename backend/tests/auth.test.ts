// Authentification par téléphone et mot de passe. Le code SMS ne sert qu'au renouvellement.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, MDP_TEST, type Contexte } from './helpers.ts';
import { creerAdministrateur } from '../src/modules/auth/service.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
before(async () => { base = await demarrerBase(); ctx = await demarrerContexte(base); });
after(async () => { await ctx.close(); await base.stop(); });

test('inscription sans code SMS : compte client créé, session ouverte', async () => {
  const r = await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '+24174000001', motDePasse: MDP_TEST, nomAffiche: 'Awa', langue: 'ar' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.utilisateur.role, 'client');
  assert.ok(r.body.token);
  assert.equal((await api(ctx, 'GET', '/profil', { token: r.body.token })).body.langue, 'ar', 'la langue du téléphone est conservée à l’inscription');
  assert.equal(ctx.sender.codes.has('+24174000001'), false, 'aucun code envoyé à l’inscription');
});

test('un numéro déjà inscrit ne peut pas être réinscrit', async () => {
  assert.equal((await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '+24174000001', motDePasse: 'autre-mot-de-passe' } })).status, 409);
});

test('connexion : bon mot de passe ouvre une session ; mauvais mot de passe et numéro inconnu : même réponse', async () => {
  const ok = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24174000001', motDePasse: MDP_TEST } });
  assert.equal(ok.status, 200);
  assert.equal((await api(ctx, 'GET', '/auth/moi', { token: ok.body.token })).body.utilisateur.role, 'client');
  const ko = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24174000001', motDePasse: 'mauvais-mot-de-passe' } });
  const inconnu = await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24174999999', motDePasse: MDP_TEST } });
  assert.equal(ko.status, 401);
  assert.equal(ko.body.erreur.message, 'Téléphone ou mot de passe incorrect');
  assert.equal(inconnu.body.erreur.message, 'Téléphone ou mot de passe incorrect');
});

test('jeton absent ou inventé : accès refusé', async () => {
  assert.equal((await api(ctx, 'GET', '/auth/moi')).status, 401);
  assert.equal((await api(ctx, 'GET', '/auth/moi', { token: 'jeton-invente' })).status, 401);
});

test('mot de passe oublié : code SMS, nouveau mot de passe, anciennes sessions fermées', async () => {
  const session = await connecter(ctx, '+24174000001');
  assert.equal((await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: '+24174000001' } })).status, 200);
  const code = ctx.sender.codes.get('+24174000001') as string;
  assert.equal((await api(ctx, 'POST', '/auth/mot-de-passe/reinitialiser', { body: { telephone: '+24174000001', code, nouveauMotDePasse: 'nouveau-mot-de-passe' } })).status, 200);
  assert.equal((await api(ctx, 'GET', '/auth/moi', { token: session.token })).status, 401);
  assert.equal((await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24174000001', motDePasse: MDP_TEST } })).status, 401);
  assert.equal((await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24174000001', motDePasse: 'nouveau-mot-de-passe' } })).status, 200);
});

test('réinitialisation : code erroné refusé, bloqué après 5 tentatives', async () => {
  await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: '+24174000001' } });
  for (let i = 0; i < 5; i++) {
    assert.equal((await api(ctx, 'POST', '/auth/mot-de-passe/reinitialiser', { body: { telephone: '+24174000001', code: '000000', nouveauMotDePasse: 'encore-un-mot-de-passe' } })).status, 401);
  }
  assert.equal((await api(ctx, 'POST', '/auth/mot-de-passe/reinitialiser', { body: { telephone: '+24174000001', code: '000000', nouveauMotDePasse: 'encore-un-mot-de-passe' } })).status, 403);
});

test('mot de passe oublié pour un numéro inconnu : réponse identique, aucun SMS', async () => {
  assert.equal((await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: '+24174888888' } })).status, 200);
  assert.equal(ctx.sender.codes.has('+24174888888'), false);
});

test('changement de mot de passe : ancien mot de passe exigé', async () => {
  const s = await connecter(ctx, '+24174000002');
  assert.equal((await api(ctx, 'POST', '/auth/mot-de-passe/changer', { token: s.token, body: { ancien: 'pas-le-bon', nouveau: 'troisieme-mot-de-passe' } })).status, 401);
  assert.equal((await api(ctx, 'POST', '/auth/mot-de-passe/changer', { token: s.token, body: { ancien: MDP_TEST, nouveau: 'troisieme-mot-de-passe' } })).status, 200);
  assert.equal((await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24174000002', motDePasse: 'troisieme-mot-de-passe' } })).status, 200);
});

test('mot de passe trop court ou numéro mal formé : refusés', async () => {
  assert.equal((await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '+24174000003', motDePasse: 'court' } })).status, 400);
  assert.equal((await api(ctx, 'POST', '/auth/inscription', { body: { telephone: '074111111', motDePasse: MDP_TEST } })).status, 400);
});

test('administrateur créé hors connexion : définit son mot de passe par réinitialisation, puis se connecte avec son rôle', async () => {
  await creerAdministrateur(base.db, '+24101000009', 'admin_principal');
  assert.equal((await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24101000009', motDePasse: MDP_TEST } })).status, 401, 'pas encore de mot de passe');
  await api(ctx, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: '+24101000009' } });
  const code = ctx.sender.codes.get('+24101000009') as string;
  await api(ctx, 'POST', '/auth/mot-de-passe/reinitialiser', { body: { telephone: '+24101000009', code, nouveauMotDePasse: MDP_TEST } });
  assert.equal((await api(ctx, 'POST', '/auth/connexion', { body: { telephone: '+24101000009', motDePasse: MDP_TEST } })).body.utilisateur.role, 'admin_principal');
});
