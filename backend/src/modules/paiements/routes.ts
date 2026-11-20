import { Router } from 'express';
import type { Request } from 'express';
import type { PaiementDeps } from './service.ts';
import { traiterCallback } from './service.ts';
import { creerLimite } from '../../core/limite.ts';
import { log } from '../../core/logger.ts';

// Adresse réelle de l'appelant. Le serveur fait confiance au proxy de Render (TRUST_PROXY=1), jamais à un en-tête envoyé par le client.
function ipAppelant(req: Request): string {
  return (req.ip ?? '').replace(/^::ffff:/, '');
}

export function paiementsRouter(deps: PaiementDeps) {
  const r = Router();

  // Callback MyPVit. Si une liste d'IP est configurée, les autres appels sont refusés.
  // Sans liste, le callback est accepté, mais il ne décide jamais seul : le statut est toujours vérifié auprès de MyPVit.
  const limite = creerLimite({ max: 60, fenetreMs: 60_000 });
  r.post('/paiements/callback', limite, async (req, res) => {
    const ips = deps.mypvit.webhookAllowedIps();
    if (ips.length > 0 && !ips.includes(ipAppelant(req))) {
      log('warn', 'callback_ip_refusee', { ip: ipAppelant(req) });
      res.status(403).json({ error: 'IP non autorisée' });
      return;
    }
    res.json(await traiterCallback(deps, req.body));
  });

  // Réception de la clé secrète par webhook, pour les comptes qui l'exigent. Cette route écrit une clé : la liste d'IP est obligatoire.
  // La clé n'est jamais journalisée.
  const limiteCle = creerLimite({ max: 20, fenetreMs: 60_000 });
  r.post('/paiements/mypvit/secret', limiteCle, (req, res) => {
    const ips = deps.mypvit.webhookAllowedIps();
    if (ips.length === 0) {
      log('error', 'reception_cle_desactivee', {});
      res.status(403).json({ error: 'Réception de clé désactivée : liste IP non configurée' });
      return;
    }
    if (!ips.includes(ipAppelant(req))) {
      log('warn', 'reception_cle_ip_refusee', { ip: ipAppelant(req) });
      res.status(403).json({ error: 'IP non autorisée' });
      return;
    }
    const corps = (req.body ?? {}) as Record<string, unknown>;
    const secret = [corps.secret, corps.token, corps.key].find((v): v is string => typeof v === 'string' && v.length > 0);
    const compte = [corps.operation_account_code, corps.operationAccountCode].find((v): v is string => typeof v === 'string' && v.length > 0) ?? null;
    const expiresIn = Number(corps.expires_in ?? corps.expiresIn ?? 3000);
    if (!secret) {
      log('warn', 'reception_cle_sans_secret', {});
      res.status(400).json({ error: 'Clé absente du message' });
      return;
    }
    const acceptee = deps.mypvit.deliverSecret(secret, Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3000, compte);
    log('info', 'reception_cle', { acceptee, compte_connu: compte !== null });
    res.json({ acceptee });
  });

  return r;
}
