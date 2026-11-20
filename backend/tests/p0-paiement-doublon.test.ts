// P0 financier : un callback MyPVit reçu plusieurs fois ne répartit ni ne compte deux fois.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produitId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000091');
  await promouvoir(base, '+24101000091');
  const jeu = await jeuDeDonnees(ctx, admin);
  produitId = jeu.produit.id;
  await api(ctx, 'POST', `/admin/produits/${produitId}/ajustements`, { token: admin.token, body: { delta: 10, motif: 'Stock des tests de paiement' } });
  client = await connecter(ctx, '+24174960091');
});
after(async () => { await ctx.close(); await base.stop(); });

async function commander(): Promise<string> {
  const r = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId, quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id;
}
async function payer(id: string): Promise<void> {
  const r = await api(ctx, 'POST', `/commandes/${id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600091' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
}
async function referenceDe(id: string): Promise<string> {
  const rows = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where commande_id = $1 order by created_at desc limit 1', [id]);
  return rows[0].r;
}
async function nombreEcritures(id: string): Promise<number> {
  return (await sql<{ n: number }>(ctx, 'select count(*)::int as n from ecritures where commande_id = $1', [id]))[0].n;
}
async function statutDe(id: string): Promise<string> {
  return (await api(ctx, 'GET', `/commandes/${id}`, { token: client.token })).body.statut;
}

test('un callback reçu deux fois : une seule répartition, la commande payée une fois', async () => {
  const id = await commander();
  await payer(id);
  const ref = await referenceDe(id);
  assert.equal(await nombreEcritures(id), 0, 'rien n’est réparti avant le paiement confirmé');
  assert.equal((await api(ctx, 'POST', '/paiements/callback', { body: { merchant_reference_id: ref } })).status, 200);
  assert.equal((await api(ctx, 'POST', '/paiements/callback', { body: { merchant_reference_id: ref } })).status, 200);
  assert.equal(await statutDe(id), 'PAYEE');
  const apres = await nombreEcritures(id);
  assert.ok(apres > 0, 'la répartition est faite');
  await api(ctx, 'POST', '/paiements/callback', { body: { merchant_reference_id: ref } });
  assert.equal(await nombreEcritures(id), apres, 'un nouvel appel ne répartit rien de plus');
});

test('une écriture comptable incohérente ne perd pas le paiement reçu : transaction réussie, commande en attente, alerte tracée',
  async () => {
    const id = await commander();
    await payer(id);
    const ref = await referenceDe(id);
    // Incohérence volontaire : le total ne correspond plus à la répartition.
    await sql(ctx, 'update commandes set total_fcfa = total_fcfa + 500 where id = $1', [id]);
    await api(ctx, 'POST', '/paiements/callback', { body: { merchant_reference_id: ref } });
    const t = await sql<{ statut: string }>(ctx, 'select statut from transactions where reference_marchand = $1', [ref]);
    assert.equal(t[0].statut, 'SUCCESS', 'le paiement reçu est enregistré');
    const journal = await api(ctx, 'GET', '/admin/journal?action=PAIEMENT_ECRITURE_ECHEC', { token: admin.token });
    assert.ok(journal.body.length >= 1, 'une alerte est tracée pour l’administration');
    assert.equal(await statutDe(id), 'EN_ATTENTE_PAIEMENT', 'la commande n’est pas marquée payée sans répartition');
  });
