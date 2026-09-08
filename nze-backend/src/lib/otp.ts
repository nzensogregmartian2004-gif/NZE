import { env } from "../config/env.js";

export function generateOtpCode(): string {
  const max = 10 ** env.OTP_CODE_LENGTH;
  const code = Math.floor(Math.random() * max)
    .toString()
    .padStart(env.OTP_CODE_LENGTH, "0");
  return code;
}

export function otpExpiryDate(): Date {
  return new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);
}

/**
 * Envoi du SMS contenant le code OTP.
 *
 * ⚠️ STUB — aucun provider SMS n'est branché pour l'instant.
 * En développement, le code est simplement loggé.
 * À remplacer par un vrai provider (ex. agrégateur SMS local Gabon/CEMAC)
 * avant la mise en production.
 */
export async function sendOtpSms(telephone: string, code: string): Promise<void> {
  if (env.NODE_ENV !== "production") {
    console.log(`📩 [OTP DEV] Code pour ${telephone} : ${code}`);
    return;
  }
  throw new Error("Aucun provider SMS configuré pour l'envoi d'OTP en production.");
}
