import { pushRouter } from './modules/push/routes.ts';
import { suiviPartenaireRouter } from './modules/suivi-partenaire/routes.ts';
// Assemblage de l'application HTTP. Les dépendances sont injectées : base, client MyPVit, envoi OTP.
import express from 'express';
import type { AppConfig } from './config.ts';
import type { Db } from './db/client.ts';
import type { MyPvitClient } from './modules/paiements/providers/mypvit/index.ts';
import type { OtpSender } from './modules/auth/otp-sender.ts';
import { errorHandler } from './core/http.ts';
import { authRouter } from './modules/auth/routes.ts';
import { catalogueRouter } from './modules/catalogue/routes.ts';
import { stockRouter } from './modules/stock/routes.ts';
import { adminRouter } from './modules/admin/routes.ts';
import { commandesRouter } from './modules/commandes/routes.ts';
import { paiementsRouter } from './modules/paiements/routes.ts';
import { messagerieRouter } from './modules/messagerie/routes.ts';
import { parametresRouter } from './modules/parametres/routes.ts';
import { financeRouter } from './modules/finance/routes.ts';
import { auditRouter } from './modules/audit/routes.ts';
import { collectesRouter } from './modules/collectes/routes.ts';
import { livraisonsRouter } from './modules/livraisons/routes.ts';
import { notificationsRouter } from './modules/notifications/routes.ts';
import type { Cartographie } from './modules/cartographie/index.ts';
import { parcoursRouter } from './modules/parcours/routes.ts';
import { reclamationsRouter } from './modules/reclamations/routes.ts';
import { litigesPartenaireRouter } from './modules/litiges-partenaire/routes.ts';
import { echelonnementRouter } from './modules/echelonnement/routes.ts';
import { legalRouter } from './modules/legal/routes.ts';
import { publiciteRouter } from './modules/publicite/routes.ts';
import type { CompanyInfo } from './modules/legal/legal.content.ts';
import type { Stockage } from './modules/stockage/r2.ts';
import { realtimeRouter } from './modules/realtime/routes.ts';
import type { ConfigRealtime } from './modules/realtime/jeton.ts';

export interface AppDeps {
  config: Pick<AppConfig, 'sessionSecret'> & Partial<Pick<AppConfig, 'trustProxy' | 'recuperationAssistee'>>;
  db: Db;
  mypvit: MyPvitClient;
  cartographie: Cartographie;
  sender: OtpSender;
  redirections: { successCode: string; failureCode: string };
  societe?: CompanyInfo;
  stockage?: Stockage | null;
  realtime?: ConfigRealtime | null;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  // Derrière un reverse proxy, req.ip doit venir de l'en-tête transmis par le proxy (nombre de relais, configurable).
  app.set('trust proxy', deps.config.trustProxy ?? 0);
  // En-têtes de sécurité sur toutes les réponses. Les réponses de l'API ne sont jamais mises en cache.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // Photos de fiches : une limite plus grande, pour cette seule route (le reste de l'API reste à 256 ko).
  app.use(/^\/admin\/prestataires\/[^/]+\/photo$/, express.json({ limit: '4500kb' }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/sante', (_req, res) => {
    res.json({ statut: 'OK' });
  });

  const secret = deps.config.sessionSecret;
  const societe: CompanyInfo = deps.societe ?? {
    name: '[raison sociale à renseigner]',
    address: '[adresse à renseigner]',
    email: '[e-mail à renseigner]',
  };
  app.use(legalRouter(deps.db, secret, societe));
  const paiement = { db: deps.db, mypvit: deps.mypvit, redirections: deps.redirections, cartographie: deps.cartographie };
  app.use(authRouter({ db: deps.db, sessionSecret: secret, sender: deps.sender, recuperationAssistee: deps.config.recuperationAssistee ?? false }));
  app.use(catalogueRouter(deps.db, secret));
  app.use(publiciteRouter(deps.db, secret, deps.stockage ?? null));
  app.use(realtimeRouter(deps.db, secret, deps.realtime ?? null));
  app.use(stockRouter(deps.db, secret));
  app.use(adminRouter(deps.db, secret));
  app.use(commandesRouter({ ...paiement, sessionSecret: secret }));
  app.use(echelonnementRouter(paiement, secret));
  app.use(paiementsRouter(paiement));
  app.use(messagerieRouter(deps.db, secret));
  app.use(parametresRouter(deps.db, secret));
  app.use(financeRouter(deps.db, secret, deps.mypvit));
  app.use(collectesRouter(deps.db, secret));
  app.use(livraisonsRouter(deps.db, secret));
  app.use(auditRouter(deps.db, secret));
  app.use(notificationsRouter(deps.db, secret));
  app.use(pushRouter(deps.db, secret));
  app.use(reclamationsRouter(deps.db, secret));
  app.use(litigesPartenaireRouter(deps.db, secret));

  app.use(parcoursRouter(deps.db, secret, deps.cartographie));

  app.use(suiviPartenaireRouter(deps.db, secret));

  app.use((_req, res) => {
    res.status(404).json({ erreur: { code: 'INTROUVABLE', message: 'Route inconnue' } });
  });
  app.use(errorHandler);
  return app;
}
