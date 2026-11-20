// Rappels et alertes par mois : trois jours avant, jour J, lendemain si non soldé (une fois par mois et par type),
// et notification à chaque pénalité ajoutée.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';
import { relancerEcheances } from '../src/modules/echelonnement/service.ts';
import { appliquerPenalites } from '../src/modules/echelonnement/echeances.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produit: { id: string };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  client = await connecter(ctx, '+24174980001');
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: true } })).status, 200);
  produit = await produitAvecMagasin(ctx, admin, entreprise, 'Article relances', 10000);
  assert.equal((await api(ctx, 'PATCH', `/admin/produits/${produit.id}/echelonnable`, { token: admin.token, body: { echelonnable: true, dureeMois: 3 } })).status, 200);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

// Plan actif sur 3 mois : renvoie l'identifiant de l'article et les mois (identifiant, numéro).
async function planActif(): Promise<{ echeancierId: string; mois: { id: string; numero: number }[] }> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'RETRAIT' } });
  const plan = await api(ctx, 'POST', `/commandes/${c.body.id}/echelonnement`, { token: client.token, body: {} });
  assert.equal(plan.status, 201, JSON.stringify(plan.body));
  const av = await api(ctx, 'POST', `/echelonnements/${plan.body.id}/avance`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074980001' } });
  assert.equal(av.status, 201, JSON.stringify(av.body));
  const [t] = await sql<{ r: string }>(ctx, 'select reference_marchand as r from transactions where id = $1', [av.body.transactionId]);
  ctx.mypvit.state.statusOverride.set(t.r, { status: 'SUCCESS' });
  await api(ctx, 'GET', `/echelonnements/${plan.body.id}/verifier-paiement`, { token: client.token });
  const [a] = await sql<{ id: string }>(ctx, 'select id from echeanciers_articles where plan_id = $1', [plan.body.id]);
  const mois = await sql<{ id: string; numero: number }>(ctx, 'select id, numero from echeances_mois where echeancier_id = $1 order by numero', [a.id]);
  return { echeancierId: a.id, mois };
}

// Fixe la date limite d'un mois par rapport à maintenant (intervalle SQL).
async function datesLimite(moisId: string, intervalle: string) {
  await sql(ctx, `update echeances_mois set date_limite = now() + interval '${intervalle}' where id = $1`, [moisId]);
}

// Types de notification reçus par le client, pour une cible donnée.
async function notifs(cibleId: string): Promise<string[]> {
  return (await sql<{ type: string }>(ctx, 'select type from notifications where destinataire_id = $1 and cible_id = $2', [client.id, cibleId])).map((r) => r.type);
}

test('trois jours avant la date limite : un rappel, une seule fois, sans rappel pour les autres mois', async () => {
  const { mois } = await planActif();
  await datesLimite(mois[0].id, '2 days');
  await relancerEcheances(base.db, new Date());
  assert.deepEqual(await notifs(mois[0].id), ['ECHEANCE_RAPPEL']);
  await relancerEcheances(base.db, new Date());
  assert.deepEqual(await notifs(mois[0].id), ['ECHEANCE_RAPPEL'], 'pas de rappel en double');
  assert.deepEqual(await notifs(mois[1].id), [], 'un mois lointain n’est pas rappelé');
});

test('le jour même de la date limite : une alerte, puis le lendemain si le mois n’est pas soldé', async () => {
  const { mois } = await planActif();
  await datesLimite(mois[0].id, '0 days');
  await relancerEcheances(base.db, new Date());
  assert.deepEqual(await notifs(mois[0].id), ['ECHEANCE_DU_JOUR']);
  await datesLimite(mois[0].id, '-1 days');
  await relancerEcheances(base.db, new Date());
  assert.deepEqual(await notifs(mois[0].id), ['ECHEANCE_DU_JOUR', 'ECHEANCE_RETARD']);
});

test('un mois déjà soldé ne déclenche aucun rappel', async () => {
  const { mois } = await planActif();
  await sql(ctx, 'update echeances_mois set montant_paye_fcfa = montant_du_fcfa where id = $1', [mois[0].id]);
  await datesLimite(mois[0].id, '-2 days');
  await relancerEcheances(base.db, new Date());
  assert.deepEqual(await notifs(mois[0].id), []);
});

test('chaque pénalité ajoutée est notifiée au client', async () => {
  const { echeancierId, mois } = await planActif();
  const derniere = (await sql<{ d: Date }>(ctx, 'select date_limite as d from echeances_mois where id = $1', [mois[2].id]))[0].d;
  await appliquerPenalites(base.db, new Date(new Date(derniere).getTime() + 62 * 24 * 3600 * 1000));
  const penalites = await sql<{ id: string }>(ctx, 'select id from penalites_echeancier where echeancier_id = $1 order by mois_retard', [echeancierId]);
  assert.equal(penalites.length, 2);
  for (const p of penalites) assert.deepEqual(await notifs(p.id), ['PENALITE_APPLIQUEE']);
});
