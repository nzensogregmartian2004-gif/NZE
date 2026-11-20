// Stockage R2 : configuration, sécurité des images, clés de stockage, liens signés. Aucun appel réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppConfig } from '../src/config.ts';
import { cleImage, creerStockageR2, TAILLE_MAX_IMAGE, verifierImage } from '../src/modules/stockage/r2.ts';

const BASE = { APP_ENV: 'test', DATABASE_URL: 'postgres://x', SESSION_SECRET: 'x'.repeat(40) };
const R2 = { R2_ACCOUNT_ID: 'c09718a99675dda06ffd5a4c566dc0c0', R2_BUCKET: 'nze', R2_ACCESS_KEY_ID: 'cle-acces-factice', R2_SECRET_ACCESS_KEY: 'secret-factice-123' };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary');

test('sans aucune variable R2, le stockage est désactivé (pas d’erreur)', () => {
  assert.equal(loadAppConfig({ ...BASE }).r2, null);
});

test('des variables R2 partielles refusent le démarrage, sans révéler de secret', () => {
  const sansSecret = { ...BASE, ...R2, R2_SECRET_ACCESS_KEY: undefined };
  assert.throws(() => loadAppConfig(sansSecret), /manque R2_SECRET_ACCESS_KEY/);
  assert.throws(() => loadAppConfig({ ...BASE, R2_ENDPOINT: 'https://exemple.test' }), /manque/);
});

test('une configuration complète dérive le point de terminaison du compte', () => {
  const r2 = loadAppConfig({ ...BASE, ...R2 }).r2;
  assert.equal(r2?.bucket, 'nze');
  assert.equal(r2?.endpoint, 'https://c09718a99675dda06ffd5a4c566dc0c0.r2.cloudflarestorage.com');
});

test('un identifiant de compte ou un nom de seau mal formé est refusé', () => {
  assert.throws(() => loadAppConfig({ ...BASE, ...R2, R2_ACCOUNT_ID: 'pas-un-identifiant' }), /32 caractères/);
  assert.throws(() => loadAppConfig({ ...BASE, ...R2, R2_BUCKET: 'Nze_Medias' }), /nom de seau invalide/);
});

test('une image est acceptée seulement si son contenu correspond au type annoncé', () => {
  verifierImage(JPEG, 'image/jpeg');
  verifierImage(PNG, 'image/png');
  verifierImage(WEBP, 'image/webp');
  assert.throws(() => verifierImage(Buffer.from('<script>alert(1)</script>'), 'image/png'), /ne correspond pas/);
  assert.throws(() => verifierImage(JPEG, 'image/gif'), /non accepté/);
  assert.throws(() => verifierImage(Buffer.alloc(0), 'image/jpeg'), /vide/);
  assert.throws(() => verifierImage(Buffer.alloc(TAILLE_MAX_IMAGE + 1, 0xff), 'image/jpeg'), /trop volumineuse/);
});

test('la clé de stockage est générée par le serveur, dans le dossier prévu, avec une extension sûre', () => {
  const id = '0f1e2d3c-4b5a-4968-8777-665544332211';
  assert.match(cleImage('fiches-prestataires', id, 'image/jpeg'), /^fiches-prestataires\/0f1e2d3c-4b5a-4968-8777-665544332211\/[0-9a-f-]{36}\.jpg$/);
  assert.throws(() => cleImage('fiches-prestataires', '../../etc', 'image/jpeg'), /invalide/);
  assert.throws(() => cleImage('fiches-prestataires', id, 'image/svg+xml'), /non accepté/);
});

test('un lien signé pointe vers le seau R2, avec signature et durée d’une heure', async () => {
  const config = loadAppConfig({ ...BASE, ...R2 }).r2;
  assert.ok(config);
  const stockage = creerStockageR2(config);
  const url = new URL(await stockage.urlSignee('fiches-prestataires/x/y.jpg'));
  assert.equal(url.host, 'c09718a99675dda06ffd5a4c566dc0c0.r2.cloudflarestorage.com');
  assert.equal(url.pathname, '/nze/fiches-prestataires/x/y.jpg');
  assert.ok(url.searchParams.get('X-Amz-Signature'), 'le lien porte une signature');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '3600');
});
