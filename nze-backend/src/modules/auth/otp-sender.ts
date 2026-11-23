// Envoi des codes OTP. Le fournisseur SMS est branché ici.
import { AppError } from '../../core/errors.ts';
import { log } from '../../core/logger.ts';

export interface OtpSender {
  send(telephone: string, code: string): Promise<void>;
}

// Développement uniquement : affiche le code dans la console. Interdit en production (voir config.ts).
export class ConsoleOtpSender implements OtpSender {
  async send(telephone: string, code: string): Promise<void> {
    log('info', 'otp_dev_console', { telephone });
    process.stdout.write(`[DEV] Code OTP pour ${telephone} : ${code}\n`);
  }
}

// eSMS Afrique : l'API n'a pas encore été fournie. Tant que ce n'est pas branché, l'envoi échoue proprement.
export class EsmsOtpSender implements OtpSender {
  async send(): Promise<void> {
    throw new AppError(503, 'SMS_NON_CONFIGURE', "L'envoi de SMS n'est pas encore configuré (eSMS Afrique)");
  }
}
