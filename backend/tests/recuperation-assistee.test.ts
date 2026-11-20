// Récupération du mot de passe. Par défaut : code par SMS. Mode assisté (désactivé par défaut, activation réservée au fondateur) :
// aucun SMS ; l'administrateur principal génère un code à usage unique après avoir vérifié l'identité du client.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, MDP_TEST, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let sms: Contexte;
let assiste: Contexte;
let admin: Session;
let secondaire: Session;
let client: Session;
const TEL = '+24174980001';
let codeGenere = '';

before(async () => {
  base = await demarrerBase();
  sms = await demarrerContexte(base);
  assiste = await demarrerContexte(base, { recuperationAssistee: true });
  admin = await connecter(sms, '+24101000001');
  await promouvoir(base, '+24101000001');
  await api(sms, 'POST', '/auth/inscription', { body: { telephone: '+24101000002', motDePasse: MDP_TEST } });
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  secondaire = await connecter(sms, '+24101000002');
  client = await connecter(sms, TEL);
});
after(async () => { await sms.close(); await assiste.close(); await base.stop(); });

test('par défaut, le code de récupération est envoyé par SMS', async () => {
  const r = await api(sms, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: TEL } });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'SMS');
  assert.ok(sms.sender.codes.get(TEL), 'un SMS est envoyé');
});

test('en mode assisté, aucun SMS n’est envoyé et le client est orienté vers NZE', async () => {
  const r = await api(assiste, 'POST', '/auth/mot-de-passe/oubli', { body: { telephone: TEL } });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'ASSISTE');
  assert.equal(assiste.sender.codes.get(TEL), undefined, 'rien n’est envoyé');
});

test('le mode assisté est fermé par défaut : la génération de code répond 409', async () => {
  const r = await api(sms, 'POST', '/admin/recuperations-assistees', { token: admin.token, body: { telephone: TEL } });
  assert.equal(r.status, 409);
});

test('seul l’administrateur principal peut générer un code', async () => {
  assert.equal((await api(assiste, 'POST', '/admin/recuperations-assistees', { token: client.token, body: { telephone: TEL } })).status, 403);
  assert.equal((await api(assiste, 'POST', '/admin/recuperations-assistees', { token: secondaire.token, body: { telephone: TEL } })).status, 403);
});

test('un compte inconnu ne reçoit pas de code', async () => {
  const r = await api(assiste, 'POST', '/admin/recuperations-assistees', { token: admin.token, body: { telephone: '+24174989999' } });
  assert.equal(r.status, 404);
});

test('le code généré est à usage unique et se saisit dans le flux normal', async () => {
  const g = await api(assiste, 'POST', '/admin/recuperations-assistees', { token: admin.token, body: { telephone: TEL } });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.match(g.body.code, /^\d{6}$/);
  codeGenere = g.body.code;
  const reset = await api(assiste, 'POST', '/auth/mot-de-passe/reinitialiser', { body: { telephone: TEL, code: codeGenere, nouveauMotDePasse: 'nouveau-mot-de-passe' } });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  const connexion = await api(assiste, 'POST', '/auth/connexion', { body: { telephone: TEL, motDePasse: 'nouveau-mot-de-passe' } });
  assert.equal(connexion.status, 200, 'le nouveau mot de passe fonctionne');
  const rejeu = await api(assiste, 'POST', '/auth/mot-de-passe/reinitialiser', { body: { telephone: TEL, code: codeGenere, nouveauMotDePasse: 'autre-mot-de-passe' } });
  assert.equal(rejeu.status, 401, 'le même code ne sert pas deux fois');
});

test('le journal trace la génération, sans jamais contenir le code', async () => {
  const journal = await api(assiste, 'GET', '/admin/journal?action=RECUPERATION_ASSISTEE_CODE', { token: admin.token });
  assert.equal(journal.status, 200);
  assert.equal(journal.body.length, 1);
  assert.equal(journal.body[0].acteurId, admin.id);
  assert.ok(!JSON.stringify(journal.body).includes(codeGenere), 'le code n’apparaît pas dans le journal');
});
