// Authentification par jeton de session (en-tête Authorization: Bearer) et contrôle des rôles.
import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { sessions, users } from '../db/schema.ts';
import { forbidden, unauthorized } from './errors.ts';
import { hashToken } from './security.ts';

export type Role = 'client' | 'admin_principal' | 'admin_secondaire' | 'partenaire' | 'livreur';

export interface AuthUser {
  id: string;
  role: Role;
  entrepriseId: string | null;
}

export const getUser = (res: Response): AuthUser => {
  const user = res.locals.user as AuthUser | undefined;
  if (!user) throw unauthorized();
  return user;
};

export function requireAuth(db: Db, sessionSecret: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) throw unauthorized();
      const [row] = await db
        .select({ id: users.id, role: users.role, entrepriseId: users.entrepriseId })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, hashToken(token, sessionSecret)), gt(sessions.expiresAt, new Date())))
        .limit(1);
      if (!row) throw unauthorized('Session expirée ou invalide');
      res.locals.user = row as AuthUser;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = getUser(res);
      if (!roles.includes(user.role)) throw forbidden();
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const ADMIN_ROLES: Role[] = ['admin_principal', 'admin_secondaire'];
