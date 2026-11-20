// Point d'entrée. Usage : node --experimental-strip-types src/server.ts (variables d'environnement requises, voir .env.example)
import { loadAppConfig } from './config.ts';
import { createDb } from './db/client.ts';
import { createApp } from './app.ts';
import { loadMyPvitConfig, MyPvitClient } from './modules/paiements/providers/mypvit/index.ts';
import { ConsoleOtpSender, EsmsOtpSender } from './modules/auth/otp-sender.ts';
import { chargerCartographie } from './modules/cartographie/index.ts';
import { log } from './core/logger.ts';
import { creerStockageR2 } from './modules/stockage/r2.ts';

const env = process.env as Record<string, string | undefined>;
const config = loadAppConfig(env);
const { db } = createDb(config.databaseUrl);
const mypvit = new MyPvitClient(loadMyPvitConfig(env));
// Contrôle des comptes MyPVit au démarrage : un compte en échec est signalé dans les journaux, sans bloquer le serveur.
mypvit.verifierConnexions().catch(() => undefined);
const sender = config.otpProvider === 'console' ? new ConsoleOtpSender() : new EsmsOtpSender();
const cartographie = chargerCartographie(env, config.env);
const redirections = {
  successCode: env.MYPVIT_REDIRECT_SUCCESS_CODE ?? 'SUCCESS123',
  failureCode: env.MYPVIT_REDIRECT_FAILURE_CODE ?? 'FAILURE123',
};
// Mentions légales : obligatoires en production, sinon les conditions publiées comporteraient des marqueurs à remplir.
if (config.env === 'production' && (!env.LEGAL_COMPANY_NAME || !env.LEGAL_COMPANY_ADDRESS || !env.LEGAL_CONTACT_EMAIL)) {
  throw new Error('LEGAL_COMPANY_NAME, LEGAL_COMPANY_ADDRESS et LEGAL_CONTACT_EMAIL sont requis en production');
}
const societe = {
  name: env.LEGAL_COMPANY_NAME ?? '[raison sociale à renseigner]',
  address: env.LEGAL_COMPANY_ADDRESS ?? '[adresse à renseigner]',
  email: env.LEGAL_CONTACT_EMAIL ?? '[e-mail à renseigner]',
};

// Photos : stockage R2 seulement si ses variables sont renseignées (sinon l'envoi de photos répond 503).
const stockage = config.r2 ? creerStockageR2(config.r2) : null;
const app = createApp({ config, db, mypvit, sender, redirections, cartographie, societe, stockage, realtime: config.realtime });
app.listen(config.port, () => log('info', 'serveur_demarre', { port: config.port, env: config.env }));
