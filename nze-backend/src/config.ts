// Configuration de l'application. Toutes les valeurs viennent de l'environnement.
import { z } from 'zod';
import { lireCleSupabase, type ConfigRealtime } from './modules/realtime/jeton.ts';

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL requis'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET doit faire au moins 32 caractères'),
  OTP_PROVIDER: z.enum(['console', 'esms']).default('console'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  // Récupération assistée du mot de passe (sans SMS). Désactivée par défaut : activation réservée à une décision du fondateur.
  RECUPERATION_ASSISTEE: z.enum(['true', 'false']).default('false'),
});

export interface ConfigR2 {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
}

const R2_OBLIGATOIRES = ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const;

// Stockage R2 : absent si aucune variable n'est renseignée ; sinon toutes les variables obligatoires doivent l'être.
function lireR2(raw: Record<string, string | undefined>): ConfigR2 | null {
  if ([...R2_OBLIGATOIRES, 'R2_ENDPOINT'].every((v) => !raw[v])) return null;
  const manquantes = R2_OBLIGATOIRES.filter((v) => !raw[v]);
  if (manquantes.length > 0) throw new Error(`Stockage R2 incomplet : manque ${manquantes.join(', ')}`);
  const accountId = raw.R2_ACCOUNT_ID as string;
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error('R2_ACCOUNT_ID doit faire 32 caractères hexadécimaux');
  const bucket = raw.R2_BUCKET as string;
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('R2_BUCKET : nom de seau invalide');
  return {
    accountId,
    bucket,
    accessKeyId: raw.R2_ACCESS_KEY_ID as string,
    secretAccessKey: raw.R2_SECRET_ACCESS_KEY as string,
    endpoint: raw.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

// Temps réel Supabase : absent si SUPABASE_SIGNING_KEY n'est pas renseignée. L'URL du projet est nécessaire avec la clé.
function lireRealtime(raw: Record<string, string | undefined>): ConfigRealtime | null {
  if (!raw.SUPABASE_SIGNING_KEY && !raw.SUPABASE_URL) return null;
  if (!raw.SUPABASE_SIGNING_KEY) throw new Error('SUPABASE_SIGNING_KEY manquante (SUPABASE_URL est renseignée)');
  if (!raw.SUPABASE_URL || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(raw.SUPABASE_URL)) {
    throw new Error('SUPABASE_URL doit être de la forme https://<référence>.supabase.co');
  }
  return { url: raw.SUPABASE_URL, cle: lireCleSupabase(raw.SUPABASE_SIGNING_KEY) };
}

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  otpProvider: 'console' | 'esms';
  trustProxy: number;
  recuperationAssistee: boolean;
  r2: ConfigR2 | null;
  realtime: ConfigRealtime | null;
}

export function loadAppConfig(raw: Record<string, string | undefined>): AppConfig {
  const e = envSchema.parse(raw);
  if (e.OTP_PROVIDER === 'console' && e.APP_ENV === 'production') {
    throw new Error('OTP_PROVIDER=console est interdit en production');
  }
  // En production, l'API est derrière le proxy de Render : sans TRUST_PROXY, l'IP vue par le serveur est celle du proxy,
  // et le filtrage IP des webhooks MyPVit refuserait tous les appels sans message clair.
  if (e.APP_ENV === 'production' && e.TRUST_PROXY < 1) {
    throw new Error('TRUST_PROXY doit valoir au moins 1 en production (hébergement derrière le proxy Render)');
  }
  return {
    env: e.APP_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    sessionSecret: e.SESSION_SECRET,
    otpProvider: e.OTP_PROVIDER,
    trustProxy: e.TRUST_PROXY,
    recuperationAssistee: e.RECUPERATION_ASSISTEE === 'true',
    r2: lireR2(raw),
    realtime: lireRealtime(raw),
  };
}
