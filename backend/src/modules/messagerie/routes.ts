import { champsPage } from '../../core/pagination.ts';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { requirePermission } from '../../core/permissions.ts';
import {
  envoyerMessage, lireConversationArchivee, lireMessages, lirePreferences, listerConversations, listerConversationsArchivees,
  majPreferences, ouvrirConversation, supprimerConversation,
} from './service.ts';

const uuid = z.string().uuid();

export function messagerieRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const auth = requireAuth(db, sessionSecret);
  const admin = [auth, requireRole(...ADMIN_ROLES), requirePermission('conversations.archives.consulter')];

  r.post('/conversations', auth, async (req, res) => {
    const b = parse(z.object({ produitId: uuid.optional() }), req.body ?? {});
    res.status(201).json(await ouvrirConversation(db, getUser(res), b.produitId));
  });

  r.get('/conversations', auth, async (_req, res) => {
    res.json(await listerConversations(db, getUser(res)));
  });

  r.delete('/conversations/:id', auth, async (req, res) => {
    await supprimerConversation(db, getUser(res), parse(uuid, req.params.id));
    res.status(204).end();
  });

  r.get('/conversations/:id/messages', auth, async (req, res) => {
    const f = parse(z.object(champsPage(100)), req.query);
    res.json(await lireMessages(db, getUser(res), parse(uuid, req.params.id), f));
  });

  r.post('/conversations/:id/messages', auth, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(
      z.object({
        genre: z.enum(['TEXTE', 'PHOTO', 'VIDEO', 'VOCAL']),
        corps: z.string().max(2000).optional(),
        fichierCle: z.string().min(1).max(300).optional(),
        dureeSec: z.number().int().min(0).max(600).optional(),
      }),
      req.body,
    );
    res.status(201).json(await envoyerMessage(db, getUser(res), id, b));
  });

  r.get('/messagerie/preferences', auth, async (_req, res) => {
    res.json(await lirePreferences(db, getUser(res)));
  });

  r.patch('/messagerie/preferences', auth, async (req, res) => {
    const b = parse(z.object({ notifMessages: z.boolean() }), req.body);
    res.json(await majPreferences(db, getUser(res), b.notifMessages));
  });

  r.get('/admin/conversations/archivees', ...admin, async (req, res) => {
    const f = parse(z.object(champsPage(200)), req.query);
    res.json(await listerConversationsArchivees(db, f));
  });

  r.get('/admin/conversations/:id/messages', ...admin, async (req, res) => {
    const f = parse(z.object(champsPage(100)), req.query);
    res.json(await lireConversationArchivee(db, parse(uuid, req.params.id), f));
  });

  return r;
}
