// Journal d'audit : connexions, changements de droits, paramètres et actions financières sont tracés.
// Le journal ne contient jamais de secret, chaque entrée est liée à son auteur, et seul l'administrateur principal le lit.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { journaliser } from '../src/modules/audit/service.ts';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let principal: Session;
let secondaire: Session;
let client: Session;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  principal = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001', 'admin_principal');
  secondaire = await connecter(ctx, '+24101000002');
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  client = await connecter(ctx, '+24174600010');
  await jeuDeDonnees(ctx, principal);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

type Entree = { id: string; action: string; cibleType: string; cibleId: string | null; acteurId: string | null; details: Record<string, unknown> | null };

const journal = async (query: string) => {
  const r = await api(ctx, 'GET', `/admin/journal${query}`, { token: principal.token });
  assert.equal(r.status, 200);
  return r.body as Entree[];
};

test('la connexion est journalisée avec son auteur', async () => {
  await api(ctx, 'POST', '/auth/connexion', { body: { telephone: client.telephone, motDePasse: 'motdepasse-test' } });
  const entrees = await journal(`?action=CONNEXION&cibleId=${client.id}`);
  assert.ok(entrees.length >= 1, 'une entrée de connexion attendue');
  assert.equal(entrees[0].acteurId, client.id);
});

test('un changement de rôle est journalisé avec l’ancien et le nouveau rôle', async () => {
  const cible = await connecter(ctx, '+24174600011');
  const r = await api(ctx, 'POST', `/admin/utilisateurs/${cible.id}/role`, { token: principal.token, body: { role: 'livreur' } });
  assert.equal(r.status, 200);
  const [entree] = await journal(`?action=ROLE_MODIFIE&cibleId=${cible.id}`);
  assert.equal(entree.acteurId, principal.id);
  assert.deepEqual(entree.details, { ancienRole: 'client', nouveauRole: 'livreur' });
});

test('les paramètres financiers et le catalogue sont journalisés', async () => {
  for (const action of ['COMMISSION_DEFINIE', 'POINT_FIXE_DEFINI', 'TARIF_DEFINI', 'PRODUIT_CREE', 'STOCK_AJUSTE']) {
    const entrees = await journal(`?action=${action}`);
    assert.ok(entrees.length >= 1, `entrée ${action} attendue`);
  }
});

test('le journal ne contient aucune clé de type secret', async () => {
  const entrees = await journal('?limite=200');
  assert.ok(entrees.length > 0);
  for (const e of entrees) {
    for (const cle of Object.keys(e.details ?? {})) {
      assert.doesNotMatch(cle, /password|secret|token|jeton|otp|cvv|pin/i, `clé suspecte dans ${e.action}`);
    }
  }
});

test('l’écriture d’une clé de type secret est refusée à la source', async () => {
  await assert.rejects(
    () => journaliser(base.db, { acteurId: null, action: 'TEST', cibleType: 'test', cibleId: null, details: { mot_de_passe: 'x' } }),
    /Clé interdite dans le journal d'audit/,
  );
});

test('seul l’administrateur principal lit le journal', async () => {
  const secondaireRefuse = await api(ctx, 'GET', '/admin/journal', { token: secondaire.token });
  assert.equal(secondaireRefuse.status, 403);
  const clientRefuse = await api(ctx, 'GET', '/admin/journal', { token: client.token });
  assert.equal(clientRefuse.status, 403);
});
