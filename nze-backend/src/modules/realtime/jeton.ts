// Jetons Supabase Realtime (décision D-RT-1). Signés en ES256 avec notre propre clé, importée dans les clés de signature
// du projet Supabase : la clé privée n'existe que dans Render, la clé publique est publiée par Supabase.
import { createPrivateKey, createPublicKey, createSign, createVerify, type KeyObject } from 'node:crypto';

export interface CleSupabase {
  kid: string;
  privee: KeyObject;
  publique: KeyObject;
}

export interface ConfigRealtime {
  url: string;
  cle: CleSupabase;
}

// Lit la clé au format JWK (une seule clé, avec sa partie privée). Refuse toute autre forme.
export function lireCleSupabase(json: string): CleSupabase {
  let jwk: Record<string, unknown>;
  try {
    jwk = JSON.parse(json);
  } catch {
    throw new Error('SUPABASE_SIGNING_KEY doit être un objet JSON');
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.d !== 'string' || typeof jwk.kid !== 'string') {
    throw new Error('SUPABASE_SIGNING_KEY : clé EC P-256 avec partie privée et identifiant (kid) attendue');
  }
  const privee = createPrivateKey({ key: jwk as never, format: 'jwk' });
  return { kid: jwk.kid as string, privee, publique: createPublicKey(privee) };
}

const base64url = (valeur: string | Buffer): string => Buffer.from(valeur).toString('base64url');

// Jeton de courte durée : l'application le renouvelle avant son expiration.
export function signerJetonRealtime(config: ConfigRealtime, utilisateurId: string, dureeSecondes = 600, maintenant = Date.now()) {
  const iat = Math.floor(maintenant / 1000);
  const entete = base64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: config.cle.kid }));
  const charge = base64url(JSON.stringify({
    sub: utilisateurId,
    role: 'authenticated',
    aud: 'authenticated',
    iss: `${config.url}/auth/v1`,
    iat,
    exp: iat + dureeSecondes,
  }));
  const signature = createSign('SHA256').update(`${entete}.${charge}`).sign({ key: config.cle.privee, dsaEncoding: 'ieee-p1363' });
  return { jeton: `${entete}.${charge}.${signature.toString('base64url')}`, expireDans: dureeSecondes };
}

export function verifierSignatureJeton(jeton: string, publique: KeyObject): boolean {
  const [entete, charge, signature] = jeton.split('.');
  if (!entete || !charge || !signature) return false;
  return createVerify('SHA256').update(`${entete}.${charge}`).verify({ key: publique, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
}
