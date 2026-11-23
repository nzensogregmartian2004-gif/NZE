// Garde-fous de configuration : la production refuse les réglages qui cachent une erreur de déploiement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppConfig } from '../src/config.ts';

const BASE = { DATABASE_URL: 'postgres://exemple', SESSION_SECRET: 'secret-de-test-plus-de-trente-deux-caracteres-ok' };

test('en production, TRUST_PROXY absent ou nul est refusé', () => {
  assert.throws(() => loadAppConfig({ ...BASE, APP_ENV: 'production', OTP_PROVIDER: 'esms' }), /TRUST_PROXY doit valoir au moins 1/);
  assert.throws(() => loadAppConfig({ ...BASE, APP_ENV: 'production', OTP_PROVIDER: 'esms', TRUST_PROXY: '0' }), /TRUST_PROXY doit valoir au moins 1/);
});

test('en production avec le proxy et un fournisseur SMS, la configuration est acceptée', () => {
  const c = loadAppConfig({ ...BASE, APP_ENV: 'production', OTP_PROVIDER: 'esms', TRUST_PROXY: '1' });
  assert.equal(c.env, 'production');
  assert.equal(c.trustProxy, 1);
});

test('en production, le codage OTP en console est refusé', () => {
  assert.throws(() => loadAppConfig({ ...BASE, APP_ENV: 'production', OTP_PROVIDER: 'console', TRUST_PROXY: '1' }), /OTP_PROVIDER=console est interdit/);
});

test('hors production, le proxy n’est pas exigé', () => {
  const c = loadAppConfig({ ...BASE, APP_ENV: 'development' });
  assert.equal(c.trustProxy, 0);
});
