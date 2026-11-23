// Paiement échelonné (amendements V3.2) : création et limites, avance, versements libres, soldé, échec et reprise,
// contrôle administratif, retards sans pénalité, et répartition exacte des encaissements entre le commerçant et NZE.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, MDP_TEST, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let secondaire: Session;
let client: Session;
let autreClient: Session;
let partenaireA: Session;
let partenaireB: Session;
let entrepriseA: string;
let entrepriseB: string;
const produits: string[] = [];
const PAIEMENT = { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600081' };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  secondaire = await connecter(ctx, '+24101000002');
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  entrepriseA = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Boutique Échelonnée' } })).body.id;
  entrepriseB = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Autre boutique' } })).body.id;
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: entrepriseA, tauxBps: 1500 } });
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: entrepriseB, tauxBps: 1500 } });
  // Six articles de 10 000 FCFA chez A (le sixième sert à tester la limite), un article chez B.
  for (let i = 0; i < 6; i++) {
    const p = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: entrepriseA, nom: `Article ${i + 1}`, prixFcfa: 10000 } })).body;
    await api(ctx, 'POST', `/admin/produits/${p.id}/ajustements`, { token: admin.token, body: { delta: 20, motif: 'Stock de test échelonnement' } });
    produits.push(p.id);
  }
  const pB = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: entrepriseB, nom: 'Article chez B', prixFcfa: 10000 } })).body;
  await api(ctx, 'POST', `/admin/produits/${pB.id}/ajustements`, { token: admin.token, body: { delta: 20, motif: 'Stock de test échelonnement' } });
  produits.push(pB.id);
  // Le drapeau par article est désactivé par défaut : la mise en place l'active pour les articles de ces tests.
  for (const id of produits) await api(ctx, 'PATCH', `/admin/produits/${id}/echelonnable`, { token: admin.token, body: { echelonnable: true, dureeMois: 3 } });
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600081', entrepriseId: entrepriseA, motDePasse: MDP_TEST } });
  partenaireA = await connecter(ctx, '+24176600081');
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600082', entrepriseId: entrepriseB, motDePasse: MDP_TEST } });
  partenaireB = await connecter(ctx, '+24176600082');
  client = await connecter(ctx, '+24174600081');
  autreClient = await connecter(ctx, '+24174600082');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

// Une commande en retrait (sans frais de livraison) : le total est alors exactement la somme des articles.
async function panier(lignes: { produitId: string; quantite: number }[], token = client.token) {
  const r = await api(ctx, 'POST', '/commandes', { token, body: { lignes, reception: 'RETRAIT' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body as { id: string; reference: string };
}
const plan = (commandeId: string, mensualite: number, token = client.token) =>
  api(ctx, 'POST', `/commandes/${commandeId}/echelonnement`, { token, body: { mensualiteFcfa: mensualite } });
const dbSomme = async (requete: string, params: unknown[]) => Number((await base.pool.query(requete, params)).rows[0].total);

let planPrincipal: { id: string };
let commandePrincipale: string;

test('le paiement échelonné est désactivé par défaut ; seul l’administrateur principal peut l’activer', async () => {
  const etat = await api(ctx, 'GET', '/admin/reglages/echelonnement', { token: admin.token });
  assert.equal(etat.body.actif, false, 'la fonction reste inactive jusqu’aux validations juridiques et de trésorerie');
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: secondaire.token, body: { actif: true } })).status, 403);
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: true } })).body.actif, true);
  assert.equal((await api(ctx, 'GET', '/echelonnement/etat', { token: client.token })).body.actif, true);
});

test('un article peut être réglé en échelonné : avance de 40 %, puis mensualités sur 3 mois au plus', async () => {
  const c = await panier([{ produitId: produits[0], quantite: 1 }]);
  commandePrincipale = c.id;
  const r = await plan(c.id, 2000);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.statut, 'PROPOSE');
  assert.equal(r.body.totalFcfa, 10000);
  assert.equal(r.body.avanceFcfa, 4000, 'avance : 40 % du total');
  assert.equal(r.body.resteFcfa, 6000);
  assert.equal(r.body.mensualiteFcfa, 2000);
  planPrincipal = { id: r.body.id };
});

test('les règles sont appliquées : mensualité minimale, 5 articles au plus, un seul commerçant, articles échelonnables', async () => {
  const basse = await panier([{ produitId: produits[1], quantite: 1 }]);
  assert.equal((await plan(basse.id, 1999)).status, 400, 'mensualité sous le minimum (reste / 3)');

  const six = await panier(produits.slice(0, 6).map((p) => ({ produitId: p, quantite: 1 })));
  const refus6 = await plan(six.id, 99999);
  assert.equal(refus6.status, 400);
  assert.match(refus6.body.erreur.message, /maximum 5 articles/);

  const melange = await panier([{ produitId: produits[0], quantite: 1 }, { produitId: produits[6], quantite: 1 }]);
  const refusMelange = await plan(melange.id, 2000);
  assert.equal(refusMelange.status, 400);
  assert.match(refusMelange.body.erreur.message, /un seul commerçant/);

  await api(ctx, 'PATCH', `/admin/produits/${produits[2]}/echelonnable`, { token: admin.token, body: { echelonnable: false } });
  const nonEch = await panier([{ produitId: produits[2], quantite: 1 }]);
  assert.equal((await plan(nonEch.id, 2000)).status, 400, 'un article marqué non échelonnable est refusé');
  await api(ctx, 'PATCH', `/admin/produits/${produits[2]}/echelonnable`, { token: admin.token, body: { echelonnable: true, dureeMois: 3 } });
});

test('l’avance valide la commande : articles vendus, plan actif, répartition exacte, commerçant prévenu', async () => {
  const av = await api(ctx, 'POST', `/echelonnements/${planPrincipal.id}/avance`, { token: client.token, body: PAIEMENT });
  assert.equal(av.status, 201, JSON.stringify(av.body));
  const v = await api(ctx, 'GET', `/echelonnements/${planPrincipal.id}/verifier-paiement`, { token: client.token });
  assert.equal(v.body.plan.statut, 'ACTIF', JSON.stringify(v.body));
  // Avance de 4 000 sur 10 000 avec 15 % de commission : commerçant 3 400, NZE 600.
  const cmd = await base.pool.query("select statut from commandes where id = $1", [commandePrincipale]);
  assert.equal(cmd.rows[0].statut, 'PAYEE');
  assert.equal(await dbSomme("select coalesce(sum(montant_fcfa),0)::int as total from ecritures where commande_id = $1 and categorie = 'VENTE_NET'", [commandePrincipale]), 3400);
  assert.equal(await dbSomme("select coalesce(sum(montant_fcfa),0)::int as total from ecritures where commande_id = $1 and categorie = 'COMMISSION'", [commandePrincipale]), 600);
  const notifClient = await api(ctx, 'GET', '/notifications?limite=100', { token: client.token });
  assert.ok(notifClient.body.some((n: { type: string }) => n.type === 'ECHELONNEMENT_ACTIF'), 'le client est prévenu du démarrage');
  const notifCommercant = await api(ctx, 'GET', '/notifications?limite=100', { token: partenaireA.token });
  assert.ok(notifCommercant.body.some((n: { type: string }) => n.type === 'ECHELONNEMENT_ACTIF'), 'le commerçant est prévenu');
});

test('un versement libre se règle à tout moment, et ne peut pas dépasser le reste', async () => {
  assert.equal((await api(ctx, 'POST', `/echelonnements/${planPrincipal.id}/versements`, { token: client.token, body: { montantFcfa: 7000, ...PAIEMENT } })).status, 400, 'au-delà du reste (6 000)');
  const vers = await api(ctx, 'POST', `/echelonnements/${planPrincipal.id}/versements`, { token: client.token, body: { montantFcfa: 2500, ...PAIEMENT } });
  assert.equal(vers.status, 201, JSON.stringify(vers.body));
  // Un seul paiement en cours à la fois sur un plan.
  assert.equal((await api(ctx, 'POST', `/echelonnements/${planPrincipal.id}/versements`, { token: client.token, body: { montantFcfa: 1000, ...PAIEMENT } })).status, 409);
  await api(ctx, 'GET', `/echelonnements/${planPrincipal.id}/verifier-paiement`, { token: client.token });
  const apres = await api(ctx, 'GET', `/echelonnements/${planPrincipal.id}`, { token: client.token });
  assert.equal(apres.body.payeFcfa, 6500);
  assert.equal(apres.body.restantFcfa, 3500);
});

test('le commerçant voit ce qui lui revient, au centime près, à chaque encaissement', async () => {
  // Cumul encaissé : 6 500 sur 10 000. Commerçant : floor(6 500 × 85 %) = 5 525.
  const d = await api(ctx, 'GET', '/partenaire/echelonnements', { token: partenaireA.token });
  const ligne = d.body.find((x: { id: string }) => x.id === planPrincipal.id);
  assert.ok(ligne, 'le plan figure dans le suivi du commerçant');
  assert.equal(ligne.commercantEncaisseFcfa, 5525);
  assert.equal(ligne.commercantAVerserFcfa, 8500 - 5525);
  assert.equal(ligne.totalFcfa, 10000);
  // Le commerçant B ne voit rien de ce plan.
  const autre = await api(ctx, 'GET', '/partenaire/echelonnements', { token: partenaireB.token });
  assert.ok(!autre.body.some((x: { id: string }) => x.id === planPrincipal.id));
});

test('quand le reste est réglé, le plan est soldé et l’intégralité du total est répartie', async () => {
  const dernier = await api(ctx, 'POST', `/echelonnements/${planPrincipal.id}/versements`, { token: client.token, body: { montantFcfa: 3500, ...PAIEMENT } });
  assert.equal(dernier.status, 201);
  await api(ctx, 'GET', `/echelonnements/${planPrincipal.id}/verifier-paiement`, { token: client.token });
  const fin = await api(ctx, 'GET', `/echelonnements/${planPrincipal.id}`, { token: client.token });
  assert.equal(fin.body.statut, 'SOLDE');
  assert.equal(fin.body.restantFcfa, 0);
  // Total des écritures de la commande = total exact : aucun centime perdu ni créé.
  assert.equal(await dbSomme("select coalesce(sum(montant_fcfa),0)::int as total from ecritures where commande_id = $1", [commandePrincipale]), 10000);
  assert.equal(await dbSomme("select coalesce(sum(montant_fcfa),0)::int as total from ecritures where commande_id = $1 and categorie = 'VENTE_NET'", [commandePrincipale]), 8500);
});

test('un paiement qui échoue ne fait rien perdre : le plan reste proposé, le client est prévenu, il peut réessayer', async () => {
  const c = await panier([{ produitId: produits[3], quantite: 1 }]);
  const p = (await plan(c.id, 2000)).body;
  const av = await api(ctx, 'POST', `/echelonnements/${p.id}/avance`, { token: client.token, body: PAIEMENT });
  const ref = (await base.pool.query('select reference_marchand from transactions where id = $1', [av.body.transactionId])).rows[0].reference_marchand;
  ctx.mypvit.state.statusOverride.set(ref, { status: 'FAILED' });
  await api(ctx, 'GET', `/echelonnements/${p.id}/verifier-paiement`, { token: client.token });
  const apres = await api(ctx, 'GET', `/echelonnements/${p.id}`, { token: client.token });
  assert.equal(apres.body.statut, 'PROPOSE', 'le plan n’est pas activé par un paiement échoué');
  assert.ok((await api(ctx, 'GET', '/notifications?limite=100', { token: client.token })).body.some((n: { type: string }) => n.type === 'PAIEMENT_ECHOUE'));
  ctx.mypvit.state.statusOverride.delete(ref);
  const reprise = await api(ctx, 'POST', `/echelonnements/${p.id}/avance`, { token: client.token, body: PAIEMENT });
  assert.equal(reprise.status, 201, 'une nouvelle tentative est possible');
});

test('l’administration voit le plan complet, avec le client identifié, et peut l’annuler avec un motif', async () => {
  const synthese = await api(ctx, 'GET', '/admin/echelonnements/synthese', { token: admin.token });
  assert.equal(synthese.status, 200);
  assert.ok(synthese.body.actifs >= 0 && synthese.body.soldes >= 1);
  const detail = await api(ctx, 'GET', `/admin/echelonnements/${planPrincipal.id}`, { token: admin.token });
  assert.equal(detail.body.client.telephone, '+24174600081');
  assert.ok(detail.body.versementsDetail.length >= 3);
  assert.equal((await api(ctx, 'POST', `/admin/echelonnements/${planPrincipal.id}/annulation`, { token: admin.token, body: { motif: 'ok' } })).status, 400);
  assert.equal((await api(ctx, 'POST', `/admin/echelonnements/${planPrincipal.id}/annulation`, { token: admin.token, body: { motif: 'Plan soldé avant annulation' } })).status, 409, 'un plan soldé ne s’annule pas');
});

test('un plan en retard génère une relance sans pénalité, une seule fois par jour', async () => {
  const c = await panier([{ produitId: produits[4], quantite: 1 }]);
  const p = (await plan(c.id, 2000)).body;
  await api(ctx, 'POST', `/echelonnements/${p.id}/avance`, { token: client.token, body: PAIEMENT });
  await api(ctx, 'GET', `/echelonnements/${p.id}/verifier-paiement`, { token: client.token });
  // On recule le début du plan de deux mois : les mensualités sont dues, rien n'a été versé.
  await base.pool.query("update plans_echelonnes set date_debut = now() - interval '65 days' where id = $1", [p.id]);
  await base.pool.query("update echeances_mois set date_limite = date_limite - interval '65 days' where echeancier_id in (select id from echeanciers_articles where plan_id = $1)", [p.id]);
  const relance = await api(ctx, 'POST', '/admin/echelonnements/relances', { token: admin.token });
  assert.ok(relance.body.echeancesEnRetard >= 1);
  const deuxieme = await api(ctx, 'POST', '/admin/echelonnements/relances', { token: admin.token });
  assert.equal(deuxieme.body.echeancesEnRetard, 0, 'pas de relance en double le même jour');
  const liste = await api(ctx, 'GET', '/admin/echelonnements?enRetard=true', { token: admin.token });
  assert.ok(liste.body.some((x: { id: string }) => x.id === p.id));
  const notifs = await api(ctx, 'GET', '/notifications?limite=100', { token: client.token });
  assert.ok(notifs.body.some((n: { type: string }) => n.type === 'ECHEANCE_RETARD'), 'retard notifié par mois');
});

test('l’administration suspend le paiement échelonné : plus de nouveau plan, et le commerçant voit sa réserve', async () => {
  assert.equal((await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: false } })).status, 200);
  assert.equal((await api(ctx, 'GET', '/echelonnement/etat', { token: client.token })).body.actif, false);
  const c = await panier([{ produitId: produits[5], quantite: 1 }]);
  const refus = await plan(c.id, 2000);
  assert.equal(refus.status, 409);
  assert.equal(refus.body.erreur.code, 'ECHELONNEMENT_DESACTIVE');
  await api(ctx, 'PUT', '/admin/reglages/echelonnement', { token: admin.token, body: { actif: true } });
  assert.equal((await plan(c.id, 2000)).status, 201, 'réactivé, le plan se crée');
});

test('chaque client ne voit que ses plans', async () => {
  assert.equal((await api(ctx, 'GET', `/echelonnements/${planPrincipal.id}`, { token: autreClient.token })).status, 404);
  const liste = await api(ctx, 'GET', '/echelonnements', { token: autreClient.token });
  assert.equal(liste.body.length, 0);
});

test('l’avance réserve l’article pendant le paiement, le libère si elle échoue, le vend une seule fois si elle réussit', async () => {
  const pid = produits[4];
  const stockDe = async () => (await base.pool.query('select disponible, reserve from stock_niveaux where produit_id = $1', [pid])).rows[0] as { disponible: number; reserve: number };
  const refDe = async (transactionId: string) =>
    (await base.pool.query('select reference_marchand from transactions where id = $1', [transactionId])).rows[0].reference_marchand as string;
  const avant = await stockDe();
  const c = await panier([{ produitId: pid, quantite: 1 }]);
  const p = (await plan(c.id, 2000)).body;

  const premiere = await api(ctx, 'POST', `/echelonnements/${p.id}/avance`, { token: client.token, body: PAIEMENT });
  assert.equal(premiere.status, 201, JSON.stringify(premiere.body));
  assert.equal((await stockDe()).reserve, avant.reserve + 1, 'l’avance en cours réserve l’article');
  ctx.mypvit.state.statusOverride.set(await refDe(premiere.body.transactionId), { status: 'FAILED' });
  await api(ctx, 'GET', `/echelonnements/${p.id}/verifier-paiement`, { token: client.token });
  assert.deepEqual(await stockDe(), avant, 'échec : la réservation est libérée, rien n’est vendu');

  const reprise = await api(ctx, 'POST', `/echelonnements/${p.id}/avance`, { token: client.token, body: PAIEMENT });
  assert.equal(reprise.status, 201, 'une nouvelle tentative est possible');
  ctx.mypvit.state.statusOverride.set(await refDe(reprise.body.transactionId), { status: 'SUCCESS' });
  const v = await api(ctx, 'GET', `/echelonnements/${p.id}/verifier-paiement`, { token: client.token });
  assert.equal(v.body.plan.statut, 'ACTIF', JSON.stringify(v.body));
  const apres = await stockDe();
  assert.equal(apres.disponible, avant.disponible - 1, 'l’avance validée vend l’article une seule fois');
  assert.equal(apres.reserve, avant.reserve, 'la réservation est devenue une vente');
});

test('un article neuf n’est pas échelonnable tant que l’administrateur ne l’active pas', async () => {
  const p = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: entrepriseA, nom: 'Article neuf', prixFcfa: 5000 } })).body;
  const { rows } = await base.pool.query('select echelonnable from produits where id = $1', [p.id]);
  assert.equal(rows[0].echelonnable, false);
});

test('réglages de l’offre : valeurs initiales 40 % et 3 mois ; seul l’administrateur principal les change ; le plan suit le réglage', async () => {
  const url = '/admin/reglages/echelonnement/parametres';
  const initial = await api(ctx, 'GET', url, { token: admin.token });
  assert.deepEqual(initial.body, { avancePourcent: 40, dureeMaxMois: 3 });
  const refus = await api(ctx, 'PUT', url, { token: secondaire.token, body: { avancePourcent: 30, dureeMaxMois: 3 } });
  assert.equal(refus.status, 403, 'l’administrateur secondaire ne peut pas changer l’offre');
  const hors = await api(ctx, 'PUT', url, { token: admin.token, body: { avancePourcent: 5, dureeMaxMois: 3 } });
  assert.equal(hors.status, 400);
  const ok = await api(ctx, 'PUT', url, { token: admin.token, body: { avancePourcent: 30, dureeMaxMois: 3 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const c = await panier([{ produitId: produits[5], quantite: 1 }]);
  const created = await plan(c.id, 3000);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { avanceFcfa, resteFcfa } = created.body;
  assert.equal(avanceFcfa, Math.ceil(((avanceFcfa + resteFcfa) * 30) / 100), 'l’avance suit le réglage de 30 %');
  await api(ctx, 'PUT', url, { token: admin.token, body: { avancePourcent: 40, dureeMaxMois: 3 } });
});
