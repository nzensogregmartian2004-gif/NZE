// Retrait par carte : désactivé tant que MyPVit n'a pas confirmé ses versements vers carte.
// NZE ne demande ni ne stocke aucune donnée de carte : la base accepte une ligne carte sans numéro, et refuse une ligne mobile sans numéro.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, MDP_TEST, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let partenaire: Session;
let entreprise: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600091', entrepriseId: entreprise, motDePasse: MDP_TEST } });
  partenaire = await connecter(ctx, '+24176600091');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const nombreDemandes = async () => (await base.pool.query('select id from demandes_retrait')).rows.length;

test('retrait par carte refusé tant que MyPVit n’a pas confirmé ses versements vers carte', async () => {
  const avant = await nombreDemandes();
  const r = await api(ctx, 'POST', '/partenaire/retraits', { token: partenaire.token, body: { montantFcfa: 1000, operateur: 'CARTE', nomBeneficiaire: 'Partenaire Test' } });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(await nombreDemandes(), avant, 'aucune demande créée');
});

test('aucune donnée de carte n’est acceptée ; un retrait mobile exige son numéro', async () => {
  const avecNumero = await api(ctx, 'POST', '/partenaire/retraits', { token: partenaire.token, body: { montantFcfa: 1000, operateur: 'CARTE', numero: '41111111', nomBeneficiaire: 'Partenaire Test' } });
  assert.equal(avecNumero.status, 400, 'un numéro n’est pas attendu pour une carte');
  const sansNumero = await api(ctx, 'POST', '/partenaire/retraits', { token: partenaire.token, body: { montantFcfa: 1000, operateur: 'AIRTEL_MONEY', nomBeneficiaire: 'Partenaire Test' } });
  assert.equal(sansNumero.status, 400, 'un numéro est requis pour Airtel Money');
});

test('la base accepte une ligne carte sans numéro, et refuse une ligne mobile sans numéro', async () => {
  await base.pool.query(
    "insert into demandes_retrait (entreprise_id, demandeur_id, montant_fcfa, operateur, numero, nom_beneficiaire) values ($1, $2, 1000, 'CARTE', null, 'Test carte')",
    [entreprise, partenaire.id],
  );
  await assert.rejects(base.pool.query(
    "insert into demandes_retrait (entreprise_id, demandeur_id, montant_fcfa, operateur, numero, nom_beneficiaire) values ($1, $2, 1000, 'MOOV_MONEY', null, 'Test mobile')",
    [entreprise, partenaire.id],
  ));
});
