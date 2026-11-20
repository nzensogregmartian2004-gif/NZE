// Répartition d'une commande payée avec livraison : chaque registre reproduit exactement ce que le client a payé.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produitId: string;
const POSITION = { latitude: 0.43496, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000095');
  await promouvoir(base, '+24101000095');
  const jeu = await jeuDeDonnees(ctx, admin);
  produitId = jeu.produit.id;
  await api(ctx, 'POST', `/admin/produits/${produitId}/ajustements`, { token: admin.token, body: { delta: 10, motif: 'Stock des tests de répartition' } });
  client = await connecter(ctx, '+24174960095');
  ctx.mypvit.state.defaultStatus = 'SUCCESS';
});
after(async () => { await ctx.close(); await base.stop(); });

test('une commande payée avec livraison est répartie exactement : articles, commission, frais de livraison et encaissement', async () => {
  const c = await api(ctx, 'POST', '/commandes', {
    token: client.token,
    body: { lignes: [{ produitId, quantite: 2 }], reception: 'LIVRAISON', livraison: POSITION },
  });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.ok(c.body.fraisLivraisonFcfa > 0, 'la livraison a un coût');
  const id = c.body.id;
  await api(ctx, 'POST', `/commandes/${id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600095' } });
  const v = await api(ctx, 'POST', `/commandes/${id}/verifier-paiement`, { token: client.token });
  assert.equal(v.body.statut, 'SUCCESS', JSON.stringify(v.body));

  const lignes = await sql<{ registre: string; categorie: string; total: number }>(ctx,
    'select registre, categorie, sum(montant_fcfa)::int as total from ecritures where commande_id = $1 group by registre, categorie', [id]);
  const total = (registre: string, categorie?: string) =>
    lignes.filter((l) => l.registre === registre && (categorie === undefined || l.categorie === categorie)).reduce((t, l) => t + l.total, 0);

  const encaisse = c.body.totalFcfa;
  assert.equal(total('CLIENT', 'ENCAISSEMENT'), encaisse, 'le registre client reproduit exactement le total payé');
  assert.equal(total('PARTENAIRE') + total('COMMISSIONS'), encaisse, 'partenaire + commissions + frais de livraison = total payé');
  assert.equal(total('COMMISSIONS', 'FRAIS_LIVRAISON'), c.body.fraisLivraisonFcfa, 'les frais de livraison sont séparés');
  assert.equal(total('PARTENAIRE', 'VENTE_NET') + total('COMMISSIONS', 'COMMISSION'), c.body.sousTotalFcfa, 'les articles sont répartis entre partenaire et commission');
});
