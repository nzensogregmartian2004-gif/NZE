// Étape B (suite) : identité et responsable de l'entreprise, accord commercial versionné, états du stock, trois registres.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let jeu: { entreprise: { id: string }; produit: { id: string } };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174600130');
  jeu = await jeuDeDonnees(ctx, admin);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

async function payer(produitId: string, numero: string): Promise<{ commandeId: string; paiement: number; statut: string }> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId, quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const p = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'MOOV_MONEY', numero } });
  const v = await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token });
  return { commandeId: c.body.id, paiement: p.status, statut: v.body.statut };
}

test('l’identité et le responsable de l’entreprise sont enregistrés', async () => {
  const r = await api(ctx, 'PATCH', `/admin/entreprises/${jeu.entreprise.id}`, {
    token: admin.token,
    body: { nomOfficiel: 'Boutique Test SARL', responsableNom: 'Awa Mba', responsableRole: 'Gérante', email: 'contact@boutique.test' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.nomOfficiel, 'Boutique Test SARL');
  assert.equal(r.body.responsableNom, 'Awa Mba');
  assert.equal(r.body.email, 'contact@boutique.test');
});

test('l’identité se modifie réservé aux administrateurs, et l’e-mail est vérifié', async () => {
  assert.equal((await api(ctx, 'PATCH', `/admin/entreprises/${jeu.entreprise.id}`, { token: client.token, body: { nomOfficiel: 'X Y' } })).status, 403);
  assert.equal((await api(ctx, 'PATCH', `/admin/entreprises/${jeu.entreprise.id}`, { token: admin.token, body: { email: 'pas-un-mail' } })).status, 400);
});

test('un nouvel accord ferme le précédent à sa date d’entrée en vigueur, avec sa durée et ses conditions', async () => {
  const e = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Accord Test' } })).body;
  const premier = await api(ctx, 'POST', '/admin/commissions', {
    token: admin.token,
    body: { entrepriseId: e.id, tauxBps: 1000, effetDebut: '2026-01-01T00:00:00.000Z', dureeMois: 12, conditions: 'Commission négociée', documentUrl: 'https://example.test/accord.pdf' },
  });
  assert.equal(premier.status, 201, JSON.stringify(premier.body));
  const second = await api(ctx, 'POST', '/admin/commissions', {
    token: admin.token, body: { entrepriseId: e.id, tauxBps: 1200, effetDebut: '2026-06-01T00:00:00.000Z' },
  });
  assert.equal(second.status, 201, JSON.stringify(second.body));
  const regles = await sql<{ taux_bps: number; date_fin: Date | null; duree_mois: number | null; conditions: string | null }>(
    ctx, 'SELECT taux_bps, date_fin, duree_mois, conditions FROM commissions_regles WHERE entreprise_id = $1 ORDER BY effet_debut', [e.id],
  );
  assert.equal(regles[0].taux_bps, 1000);
  assert.equal(new Date(regles[0].date_fin!).toISOString().slice(0, 10), '2026-06-01');
  assert.equal(regles[0].duree_mois, 12);
  assert.equal(regles[0].conditions, 'Commission négociée');
  assert.equal(regles[1].date_fin, null, 'l’accord en vigueur reste ouvert');
});

test('un article INDISPONIBLE ne se vend pas ; le retour à DISPONIBLE rétablit la vente, chaque changement est tracé', async () => {
  const produit = jeu.produit.id;
  assert.equal((await api(ctx, 'PATCH', `/admin/produits/${produit}/etat-stock`, { token: admin.token, body: { etat: 'DISPONIBLE' } })).status, 409, 'déjà disponible');
  const bloque = await api(ctx, 'PATCH', `/admin/produits/${produit}/etat-stock`, { token: admin.token, body: { etat: 'INDISPONIBLE', motif: 'Rupture fournisseur' } });
  assert.equal(bloque.status, 200, JSON.stringify(bloque.body));
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit, quantite: 1 }], reception: 'RETRAIT' } });
  const refus = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'MOOV_MONEY', numero: '077500010' } });
  assert.equal(refus.status, 409, JSON.stringify(refus.body));
  assert.equal((await api(ctx, 'PATCH', `/admin/produits/${produit}/etat-stock`, { token: admin.token, body: { etat: 'DISPONIBLE' } })).status, 200);
  const accepte = await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'MOOV_MONEY', numero: '077500010' } });
  assert.notEqual(accepte.status, 409, JSON.stringify(accepte.body));
  const tracés = await sql<{ n: number }>(ctx, "SELECT count(*)::int AS n FROM mouvements_stock WHERE produit_id = $1 AND type = 'ETAT'", [produit]);
  assert.equal(tracés[0].n, 2);
});

test('une vente alimente trois registres : CLIENT (encaissement), COMMISSIONS et PARTENAIRE (la somme égale le total)', async () => {
  const { commandeId, statut } = await payer(jeu.produit.id, '077500020');
  assert.equal(statut, 'SUCCESS');
  const ecr = await sql<{ registre: string; categorie: string; montant_fcfa: number }>(ctx, 'SELECT registre, categorie, montant_fcfa FROM ecritures WHERE commande_id = $1', [commandeId]);
  const total = (await sql<{ total_fcfa: number }>(ctx, 'SELECT total_fcfa FROM commandes WHERE id = $1', [commandeId]))[0].total_fcfa;
  const somme = (reg: string) => ecr.filter((e) => e.registre === reg).reduce((t, e) => t + e.montant_fcfa, 0);
  assert.equal(somme('CLIENT'), total);
  assert.equal(somme('COMMISSIONS') + somme('PARTENAIRE'), total);
  assert.ok(ecr.every((e) => (e.categorie === 'ENCAISSEMENT') === (e.registre === 'CLIENT')));
});
