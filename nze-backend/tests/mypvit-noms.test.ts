// Les valeurs MyPVit sont acceptées sous les noms NZE ou sous les noms alternatifs de l'autre application.
// Agent et produit ont des valeurs par défaut, remplaçables par MYPVIT_AGENT et MYPVIT_PRODUCT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMyPvitConfig } from '../src/modules/paiements/providers/mypvit/config.ts';

const valeursAutreApplication = {
  APP_ENV: 'development',
  MYPVIT_BASE_URL: 'https://exemple.invalide',
  MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL: 'compte-airtel',
  MYPVIT_CALLBACK_URL_CODE: 'callback',
  MYPVIT_RECEPTION_URL_CODE: 'reception',
  MYPVIT_API_PASSWORD: 'mot-de-passe',
  MYPVIT_URLCODE_RENEW_SECRET: 'code-secret',
  MYPVIT_URLCODE_REST: 'code-paiement',
  MYPVIT_URLCODE_LINK: 'code-lien',
  MYPVIT_URLCODE_STATUS: 'code-statut',
  MYPVIT_URLCODE_GET_FEES: 'code-frais',
  MYPVIT_URLCODE_GET_COUNTRIES: 'code-pays',
  MYPVIT_URLCODE_GET_OPERATORS: 'code-operateurs',
  MYPVIT_URLCODE_QR_CODE: 'code-qr',
  MYPVIT_URLCODE_BALANCE: 'code-solde',
};

test('sans agent ni produit, les valeurs de l’application qui fonctionne sont reprises', () => {
  const cfg = loadMyPvitConfig(valeursAutreApplication);
  assert.equal(cfg.agent, 'AIFI-APP');
  assert.equal(cfg.product, 'AIFI');
});

test('les valeurs sous les noms de l’autre application sont reprises', () => {
  const cfg = loadMyPvitConfig(valeursAutreApplication);
  assert.equal(cfg.password, 'mot-de-passe');
  assert.equal(cfg.codes.payment, 'code-paiement');
  assert.equal(cfg.codes.secret, 'code-secret');
  assert.equal(cfg.codes.balance, 'code-solde');
});

test('MYPVIT_AGENT et MYPVIT_PRODUCT renseignés remplacent les valeurs par défaut', () => {
  const cfg = loadMyPvitConfig({ ...valeursAutreApplication, MYPVIT_AGENT: 'NZE-APP', MYPVIT_PRODUCT: 'NZE' });
  assert.equal(cfg.agent, 'NZE-APP');
  assert.equal(cfg.product, 'NZE');
});

test('un nom NZE déjà renseigné est prioritaire sur le nom alternatif', () => {
  const cfg = loadMyPvitConfig({ ...valeursAutreApplication, MYPVIT_PASSWORD: 'nouveau' });
  assert.equal(cfg.password, 'nouveau');
});
