// Lot 4 (audit) : le banc d'essai MyPVit refuse tout ce qui pourrait toucher la production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifierGardeSandbox } from '../src/modules/paiements/providers/mypvit/sandbox-garde.ts';

const SANDBOX = { MYPVIT_BASE_URL: 'https://sandbox.mypvit.example', SANDBOX_CONFIRME: 'oui' };

test('le banc d’essai refuse de tourner en production', () => {
  assert.match(verifierGardeSandbox({ ...SANDBOX, APP_ENV: 'production' }) ?? '', /production/);
});

test('sans adresse explicite, le banc d’essai refuse (la valeur par défaut est la production)', () => {
  assert.match(verifierGardeSandbox({ SANDBOX_CONFIRME: 'oui' }) ?? '', /MYPVIT_BASE_URL doit être renseignée/);
});

test('l’adresse de production est refusée, même écrite autrement', () => {
  assert.match(verifierGardeSandbox({ MYPVIT_BASE_URL: 'https://api.mypvit.pro', SANDBOX_CONFIRME: 'oui' }) ?? '', /production/);
  assert.match(verifierGardeSandbox({ MYPVIT_BASE_URL: 'https://API.MYPVIT.PRO/', SANDBOX_CONFIRME: 'oui' }) ?? '', /production/);
});

test('une adresse non https est refusée', () => {
  assert.match(verifierGardeSandbox({ MYPVIT_BASE_URL: 'http://sandbox.mypvit.example', SANDBOX_CONFIRME: 'oui' }) ?? '', /https/);
});

test('sans confirmation explicite, le banc d’essai refuse', () => {
  assert.match(verifierGardeSandbox({ MYPVIT_BASE_URL: 'https://sandbox.mypvit.example' }) ?? '', /SANDBOX_CONFIRME=oui/);
});

test('une adresse de test confirmée est acceptée', () => {
  assert.equal(verifierGardeSandbox({ ...SANDBOX }), null);
});

test('la relation montant / frais / total est classée sans ambiguïté', async () => {
  const { classerFrais } = await import('../src/modules/paiements/providers/mypvit/sandbox-garde.ts');
  assert.equal(classerFrais(1000, 30, 1030), 'FRAIS_EN_PLUS');
  assert.equal(classerFrais(1000, 30, 1000), 'FRAIS_INCLUS');
  assert.equal(classerFrais(1000, 30, 970), 'INDETERMINE');
  assert.equal(classerFrais(1000, 0, 1000), 'FRAIS_INCLUS');
});
