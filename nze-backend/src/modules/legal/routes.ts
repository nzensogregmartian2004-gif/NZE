// Conditions d'utilisation et politique de confidentialité : lecture publique, acceptation pour le compte connecté.
// Seule la dernière acceptation est conservée sur le compte (version et date).
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { getUser, requireAuth } from '../../core/auth.ts';
import { users } from '../../db/schema.ts';
import { buildLegalDocuments, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, type CompanyInfo, type Lang } from './legal.content.ts';

const langueDe = (valeur: unknown): Lang => (valeur === 'en' ? 'en' : 'fr');

export function legalRouter(db: Db, sessionSecret: string, societe: CompanyInfo) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);

  // Public, y compris en maintenance : un utilisateur doit toujours pouvoir lire les conditions.
  r.get('/legal', (req, res) => {
    const langue = langueDe(req.query.lang);
    const documents = buildLegalDocuments(societe)[langue];
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      version: LEGAL_VERSION,
      effectiveDate: LEGAL_EFFECTIVE_DATE,
      language: langue,
      documents: documents.map(({ slug, title }) => ({ slug, title })),
    });
  });

  r.get('/legal/:slug', (req, res) => {
    const langue = langueDe(req.query.lang);
    const document = buildLegalDocuments(societe)[langue].find((item) => item.slug === req.params.slug);
    if (!document) {
      res.status(404).json({ erreur: { code: 'INTROUVABLE', message: 'Document introuvable' } });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ version: LEGAL_VERSION, effectiveDate: LEGAL_EFFECTIVE_DATE, language: langue, ...document });
  });

  r.post('/legal/accept', connecte, async (_req, res) => {
    const utilisateur = getUser(res);
    await db.update(users)
      .set({ conditionsVersion: LEGAL_VERSION, conditionsAccepteesLe: new Date() })
      .where(eq(users.id, utilisateur.id));
    res.json({ conditionsVersion: LEGAL_VERSION, conditionsAcceptees: true });
  });

  return r;
}
