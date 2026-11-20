// Outils cryptographiques : jetons de session, codes OTP, empreintes. Jamais de valeur en clair stockée.
import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (mdp: string, sel: Buffer, longueur: number) => Promise<Buffer>;

export const newToken = (): string => randomBytes(32).toString('base64url');
export const newOtp = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const hashToken = (token: string, secret: string): string => createHmac('sha256', secret).update(token).digest('hex');
export const hashOtp = (code: string, phone: string, secret: string): string =>
  createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

// Mot de passe : scrypt avec sel aléatoire. Format stocké : « scrypt$sel$empreinte ».
export async function hashMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(16);
  const empreinte = await scrypt(motDePasse, sel, 64);
  return `scrypt$${sel.toString('base64')}$${empreinte.toString('base64')}`;
}

export async function verifierMotDePasse(motDePasse: string, stocke: string | null): Promise<boolean> {
  if (!stocke) return false;
  const [algo, sel, empreinte] = stocke.split('$');
  if (algo !== 'scrypt' || !sel || !empreinte) return false;
  const calcul = await scrypt(motDePasse, Buffer.from(sel, 'base64'), 64);
  const attendu = Buffer.from(empreinte, 'base64');
  return attendu.length === calcul.length && timingSafeEqual(attendu, calcul);
}
