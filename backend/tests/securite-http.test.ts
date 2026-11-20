// Sécurité transverse : en-têtes HTTP sur toutes les réponses, et écriture atomique du stock et de son journal.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ajusterStock } from '../src/modules/stock/service.ts';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let produitId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  produitId = (await jeuDeDonnees(ctx, admin)).produit.id;
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('chaque réponse porte les en-têtes de sécurité, y compris les erreurs', async () => {
  for (const chemin of ['/sante', '/route-inconnue']) {
    const r = await fetch(`${ctx.base}${chemin}`);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', chemin);
    assert.equal(r.headers.get('x-frame-options'), 'DENY', chemin);
    assert.equal(r.headers.get('cache-control'), 'no-store', chemin);
    assert.equal(r.headers.get('x-powered-by'), null, 'la technologie n’est pas annoncée');
  }
});

test('un ajustement de stock dont le journal échoue n’est appliqué ni au stock, ni aux mouvements', async () => {
  const stockAvant = await base.pool.query('select disponible from stock_niveaux where produit_id = $1', [produitId]);
  const mouvementsAvant = await base.pool.query('select count(*)::int as n from mouvements_stock where produit_id = $1', [produitId]);
  // Un acteur inexistant fait échouer l'écriture du journal : toute la transaction doit être annulée.
  await assert.rejects(() => ajusterStock(base.db, produitId, 5, 'Test d’atomicité', randomUUID()));
  const stockApres = await base.pool.query('select disponible from stock_niveaux where produit_id = $1', [produitId]);
  const mouvementsApres = await base.pool.query('select count(*)::int as n from mouvements_stock where produit_id = $1', [produitId]);
  assert.equal(stockApres.rows[0].disponible, stockAvant.rows[0].disponible);
  assert.equal(mouvementsApres.rows[0].n, mouvementsAvant.rows[0].n);
});

test('un ajustement valide écrit le mouvement et le journal ensemble', async () => {
  await ajusterStock(base.db, produitId, 2, 'Ajustement valide', admin.id);
  const journal = await api(ctx, 'GET', `/admin/journal?action=STOCK_AJUSTE&cibleId=${produitId}`, { token: admin.token });
  assert.ok(journal.body.some((e: { details: { motif: string } }) => e.details.motif === 'Ajustement valide'));
});
