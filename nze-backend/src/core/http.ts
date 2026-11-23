// Validation des entrées et gestion centralisée des erreurs HTTP.
import type { NextFunction, Request, Response } from 'express';
import type { z, ZodTypeAny } from 'zod';
import { AppError, badRequest } from './errors.ts';
import { log } from './logger.ts';

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.') || 'corps'} ${i.message}`).join(' ; ');
    throw badRequest(`Données invalides : ${details}`);
  }
  return result.data as z.output<S>;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ erreur: { code: err.code, message: err.message } });
    return;
  }
  // Corps JSON mal formé, renvoyé par express.json()
  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    res.status(400).json({ erreur: { code: 'VALIDATION', message: 'Corps JSON invalide' } });
    return;
  }
  log('error', 'erreur_interne', { route: req.path, method: req.method });
  res.status(500).json({ erreur: { code: 'ERREUR_INTERNE', message: 'Une erreur interne est survenue' } });
}
