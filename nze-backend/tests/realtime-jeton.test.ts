// Jetons Realtime (D-RT-1) : signature ES256 vérifiable par la clé publique, revendications, rejets, route.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { loadAppConfig } from '../src/config.ts';
import { lireCleSupabase, signerJetonRealtime, verifierSignatureJeton } from '../src/modules/realtime/jeton.ts';
import { api, connecter, demarrerBase, demarrerContexte, type Contexte, type Session } from './helpers.ts';

const BASE = { APP_ENV: 'test', DATABASE_URL: 'postgres://x', SESSION_SECRET: 'x'.repeat(40) };

function cleDeTest() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { jwk: { ...privateKey.export({ format: 'jwk' }), kid: 'cle-unitaire' }, cle: lireCleSupabase(JSON.stringify({ ...privateKey.export({ format: 'jwk' }), kid: 'cle-unitaire' })) };
}

test('le jeton est signé en ES256 et vérifiable avec la seule clé publique', () => {
  const { cle } = cleDeTest();
  const { jeton } = signerJetonRealtime({ url: 'https://projet.supabase.co', cle }, 'utilisateur-1');
  assert.equal(verifierSignatureJeton(jeton, cle.publique), true);
  const entete = JSON.parse(Buffer.from(jeton.split('.')[0], 'base64url').toString());
  assert.equal(entete.alg, 'ES256');
  assert.equal(entete.kid, 'cle-unitaire');
});

test('les revendications identifient l’utilisateur et sa durée de validité', () => {
  const { cle } = cleDeTest();
  const maintenant = Date.now();
  const { jeton, expireDans } = signerJetonRealtime({ url: 'https://projet.supabase.co', cle }, 'utilisateur-42', 600, maintenant);
  const charge = JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString());
  assert.equal(charge.sub, 'utilisateur-42');
  assert.equal(charge.role, 'authenticated');
  assert.equal(charge.aud, 'authenticated');
  assert.equal(charge.iss, 'https://projet.supabase.co/auth/v1');
  assert.equal(charge.exp - charge.iat, 600);
  assert.equal(expireDans, 600);
});

test('une charge modifiée ou un jeton signé par une autre clé est rejeté', () => {
  const { cle } = cleDeTest();
  const autre = cleDeTest();
  const { jeton } = signerJetonRealtime({ url: 'https://projet.supabase.co', cle }, 'utilisateur-1');
  const [entete, , signature] = jeton.split('.');
  const charge2 = Buffer.from(JSON.stringify({ sub: 'quelqu-un-d-autre', role: 'authenticated', exp: 9999999999 })).toString('base64url');
  assert.equal(verifierSignatureJeton(`${entete}.${charge2}.${signature}`, cle.publique), false, 'charge altérée');
  assert.equal(verifierSignatureJeton(jeton, autre.cle.publique), false, 'autre clé');
});

test('une clé refusée si elle n’est pas une clé EC P-256 avec partie privée', () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => lireCleSupabase(JSON.stringify({ ...rsa.privateKey.export({ format: 'jwk' }), kid: 'x' })), /EC P-256/);
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publique = privateKey.export({ format: 'jwk' });
  const { d, ...sansPrivee } = publique as Record<string, string>;
  assert.throws(() => lireCleSupabase(JSON.stringify({ ...sansPrivee, kid: 'x' })), /EC P-256/);
  assert.throws(() => lireCleSupabase('pas du json'), /JSON/);
});

test('sans clé Supabase, le temps réel est désactivé et la configuration est explicite', () => {
  assert.equal(loadAppConfig({ ...BASE }).realtime, null);
  assert.throws(() => loadAppConfig({ ...BASE, SUPABASE_URL: 'https://projet.supabase.co' }), /SUPABASE_SIGNING_KEY manquante/);
  assert.throws(() => loadAppConfig({ ...BASE, SUPABASE_SIGNING_KEY: '{}' }), /SUPABASE_URL/);
  assert.throws(() => loadAppConfig({ ...BASE, SUPABASE_URL: 'http://pas-https.example', SUPABASE_SIGNING_KEY: '{}' }), /SUPABASE_URL/);
});

let base: Awaited<ReturnType<typeof demarrerBase>>;
let inactif: Contexte;
let actif: Contexte;
let client: Session;
before(async () => {
  base = await demarrerBase();
  inactif = await demarrerContexte(base);
  actif = await demarrerContexte(base, { realtime: true });
  client = await connecter(inactif, '+24174995001');
});
after(async () => { await inactif.close(); await actif.close(); await base.stop(); });

test('la route refuse sans jeton de session, et répond 503 tant que la clé n’est pas configurée', async () => {
  assert.equal((await api(inactif, 'GET', '/realtime/jeton')).status, 401);
  const r = await api(inactif, 'GET', '/realtime/jeton', { token: client.token });
  assert.equal(r.status, 503);
  assert.equal(r.body.erreur.code, 'REALTIME_NON_CONFIGURE');
});

test('une fois configurée, la route délivre un jeton à l’utilisateur connecté, sans rien d’autre', async () => {
  const r = await api(actif, 'GET', '/realtime/jeton', { token: client.token });
  assert.equal(r.status, 200);
  assert.equal(typeof r.body.jeton, 'string');
  assert.equal(r.body.url, 'https://projet-test.supabase.co');
  const charge = JSON.parse(Buffer.from(r.body.jeton.split('.')[1], 'base64url').toString());
  assert.equal(charge.sub, client.id, 'le jeton porte l’identifiant de l’utilisateur connecté');
  assert.ok(!('motDePasse' in charge) && !('token' in charge));
});

test('une configuration complète avec l’URL du projet et une clé valide active le temps réel', () => {
  const { jwk } = cleDeTest();
  const config = loadAppConfig({ ...BASE, SUPABASE_URL: 'https://smqhqbcvcbpeimtoajoy.supabase.co', SUPABASE_SIGNING_KEY: JSON.stringify(jwk) }).realtime;
  assert.equal(config?.url, 'https://smqhqbcvcbpeimtoajoy.supabase.co');
  assert.equal(config?.cle.kid, 'cle-unitaire');
});
