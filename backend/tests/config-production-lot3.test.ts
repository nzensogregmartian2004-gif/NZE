// Lot 3 (audit) : configuration de production. Valeurs fictives uniquement, jamais de secrets réels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppConfig } from '../src/config.ts';
import { loadMyPvitConfig } from '../src/modules/paiements/providers/mypvit/config.ts';

const MYPVIT = {
  MYPVIT_PASSWORD: 'factice', MYPVIT_AGENT: 'factice', MYPVIT_PRODUCT: 'factice', MYPVIT_CALLBACK_URL_CODE: 'factice',
  MYPVIT_CODE_SECRET: 'factice', MYPVIT_CODE_PAYMENT: 'factice', MYPVIT_CODE_LINK: 'factice', MYPVIT_CODE_STATUS: 'factice',
  MYPVIT_CODE_FEES: 'factice', MYPVIT_CODE_COUNTRIES: 'factice', MYPVIT_CODE_OPERATORS: 'factice', MYPVIT_CODE_QRCODE: 'factice',
  MYPVIT_CODE_BALANCE: 'factice', MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL: 'factice',
};
const IPS = '176.31.65.18,176.31.65.20,176.31.65.21,13.59.249.167';

test('en production, une liste vide d’IP de callbacks MyPVit est refusée', () => {
  assert.throws(() => loadMyPvitConfig({ ...MYPVIT, APP_ENV: 'production' }), /MYPVIT_WEBHOOK_ALLOWED_IPS \(obligatoire en production\)/);
});

test('en production, la liste fournie par le fondateur est acceptée et lue intégralement', () => {
  const c = loadMyPvitConfig({ ...MYPVIT, APP_ENV: 'production', MYPVIT_WEBHOOK_ALLOWED_IPS: IPS });
  assert.deepEqual(c.webhookAllowedIps, ['176.31.65.18', '176.31.65.20', '176.31.65.21', '13.59.249.167']);
});

test('hors production, une liste vide reste acceptée (développement et tests)', () => {
  assert.doesNotThrow(() => loadMyPvitConfig({ ...MYPVIT, APP_ENV: 'test' }));
});

test('une adresse IP mal formée est refusée, même hors production', () => {
  assert.throws(() => loadMyPvitConfig({ ...MYPVIT, APP_ENV: 'test', MYPVIT_WEBHOOK_ALLOWED_IPS: '176.31.65.300,13.59.249.167' }), /adresse IPv4 invalide/);
  assert.throws(() => loadMyPvitConfig({ ...MYPVIT, APP_ENV: 'test', MYPVIT_WEBHOOK_ALLOWED_IPS: 'pas-une-ip' }), /adresse IPv4 invalide/);
});

test('une configuration de production complète et cohérente est acceptée', () => {
  const config = loadAppConfig({
    APP_ENV: 'production', DATABASE_URL: 'postgres://factice', SESSION_SECRET: 'x'.repeat(40),
    OTP_PROVIDER: 'esms', TRUST_PROXY: '1',
  });
  assert.equal(config.env, 'production');
  assert.equal(config.trustProxy, 1);
});

test('en production, un secret de session trop court est refusé au démarrage', () => {
  assert.throws(() => loadAppConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://factice', SESSION_SECRET: 'trop-court', OTP_PROVIDER: 'esms', TRUST_PROXY: '1' }), /au moins 32 caractères/);
});

test('sans base de données, le démarrage est refusé, quel que soit l’environnement', () => {
  assert.throws(() => loadAppConfig({ APP_ENV: 'production', SESSION_SECRET: 'x'.repeat(40), OTP_PROVIDER: 'esms', TRUST_PROXY: '1' }), /DATABASE_URL/);
});
