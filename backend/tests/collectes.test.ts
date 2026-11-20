// Collectes et bordereaux (cahier §12) : bordereau numéroté, anomalie bloquante, visibilité par rôle, annulation et levée de blocage.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { articleBloqueLivraison } from '../src/modules/collectes/service.ts';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let livreur1: Session;
let livreur2: Session;
let partenaireA: Session;
let partenaireB: Session;
let client: Session;
let entrepriseA: string;
let entrepriseB: string;
let produitA: { id: string; nom: string };
let produitB: { id: string; nom: string };
let produitD: { id: string; nom: string };
let premierBordereau: { id: string; reference: string };
let bordereauAnomalie: { id: string; reference: string; ligneId: string };
let bordereauLivreur2: string;

const CONFORME = { quantite: 1, etat: 'Neuf, emballage d’origine', testEffectue: true, resultatTest: 'Fonctionne', controle: 'CONFORME' };
const ANOMALIE = { quantite: 1, etat: 'Boîtier fissuré', testEffectue: false, controle: 'ANOMALIE', commentaire: 'Fissure visible sur le dessus' };
const POSITION = { latitude: 0.43496, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001', 'admin_principal');
  const jeu = await jeuDeDonnees(ctx, admin);
  entrepriseA = jeu.entreprise.id;
  const etabA = (await api(ctx, 'POST', '/admin/etablissements', { token: admin.token, body: { entrepriseId: entrepriseA, nom: 'Magasin A' } })).body;
  produitA = await produitAvecMagasin(entrepriseA, etabA.id, 'Chargeur A', 5000);
  entrepriseB = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Second commerçant' } })).body.id;
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: entrepriseB, tauxBps: 1500 } });
  const etabB = (await api(ctx, 'POST', '/admin/etablissements', { token: admin.token, body: { entrepriseId: entrepriseB, nom: 'Magasin B' } })).body;
  produitB = await produitAvecMagasin(entrepriseB, etabB.id, 'Câble', 3000);
  produitD = await produitAvecMagasin(entrepriseA, etabA.id, 'Chargeur D', 4000);

  livreur1 = await connecter(ctx, '+24174700001');
  livreur2 = await connecter(ctx, '+24174700002');
  for (const l of [livreur1, livreur2]) {
    const r = await api(ctx, 'POST', `/admin/utilisateurs/${l.id}/role`, { token: admin.token, body: { role: 'livreur' } });
    assert.equal(r.status, 200);
  }
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600011', entrepriseId: entrepriseA, motDePasse: 'motdepasse-test' } });
  partenaireA = await connecter(ctx, '+24176600011');
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600012', entrepriseId: entrepriseB, motDePasse: 'motdepasse-test' } });
  partenaireB = await connecter(ctx, '+24176600012');
  client = await connecter(ctx, '+24174600020');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const creer = (token: string, body: Record<string, unknown>) => api(ctx, 'POST', '/livreur/bordereaux', { token, body });

// Produit rattaché à un magasin, avec du stock : une collecte exige un magasin renseigné.
async function produitAvecMagasin(entrepriseId: string, etablissementId: string, nom: string, prixFcfa: number): Promise<{ id: string; nom: string }> {
  const p = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId, etablissementId, nom, prixFcfa } })).body;
  await api(ctx, 'POST', `/admin/produits/${p.id}/ajustements`, { token: admin.token, body: { delta: 200, motif: 'Stock de test collectes' } });
  return { id: p.id, nom };
}

// Scénario réel : commande du client payée, livraison confiée au livreur. Seule une ligne ainsi confiée peut être collectée.
async function ligneAssignee(produit: { id: string }, livreur: Session): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600020' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token })).body.statut, 'SUCCESS');
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId: c.body.id, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  const detail = await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: client.token });
  return detail.body.lignes[0].id as string;
}

test('une collecte conforme produit un bordereau numéroté, consultable par le livreur', async () => {
  const r = await creer(livreur1.token, { entrepriseId: entrepriseA, lignes: [{ produitId: produitA.id, ligneCommandeId: await ligneAssignee(produitA, livreur1), ...CONFORME }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.statut, 'ATTENTE_PARTENAIRE');
  assert.match(r.body.reference, /^BDR-\d{4}-\d{6}$/);
  assert.equal(r.body.lignes[0].nomArticle, produitA.nom, 'le nom de l’article est figé dans le bordereau');
  assert.equal(r.body.lignes[0].bloqueLivraison, false);
  premierBordereau = { id: r.body.id, reference: r.body.reference };

  const lu = await api(ctx, 'GET', `/bordereaux/${r.body.id}`, { token: livreur1.token });
  assert.equal(lu.status, 200);
  assert.equal(lu.body.id, r.body.id);
});

test('la remise est confirmée par le commerçant puis validée par l’administrateur principal', async () => {
  const confirmation = await api(ctx, 'POST', `/partenaire/bordereaux/${premierBordereau.id}/reponse`, { token: partenaireA.token, body: { confirmer: true } });
  assert.equal(confirmation.status, 200);
  assert.equal(confirmation.body.statut, 'ATTENTE_VALIDATION_NZE');
  assert.ok(confirmation.body.partenaireConfirmeLe);

  const validation = await api(ctx, 'POST', `/admin/bordereaux/${premierBordereau.id}/decision`, { token: admin.token, body: { valider: true } });
  assert.equal(validation.status, 200);
  assert.equal(validation.body.statut, 'VALIDE');
  assert.equal(validation.body.validePar, admin.id);

  const doubleValidation = await api(ctx, 'POST', `/admin/bordereaux/${premierBordereau.id}/decision`, { token: admin.token, body: { valider: true } });
  assert.equal(doubleValidation.status, 409);
});

test('une anomalie de qualité met le bordereau en anomalie et bloque l’article', async () => {
  const r = await creer(livreur1.token, { entrepriseId: entrepriseA, commentaire: 'Collecte du matin', lignes: [{ produitId: produitA.id, ligneCommandeId: await ligneAssignee(produitA, livreur1), ...ANOMALIE }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.statut, 'ATTENTE_PARTENAIRE', 'le contrôle qualité est indépendant de la confirmation de remise');
  assert.equal(r.body.lignes[0].bloqueLivraison, true);
  assert.notEqual(r.body.reference, premierBordereau.reference, 'chaque bordereau a une référence propre');
  bordereauAnomalie = { id: r.body.id, reference: r.body.reference, ligneId: r.body.lignes[0].id };
  assert.equal(await articleBloqueLivraison(base.db, produitA.id), true);
  assert.equal(await articleBloqueLivraison(base.db, produitB.id), false, 'un autre article n’est pas bloqué');
});

test('un article d’une autre entreprise est refusé', async () => {
  const r = await creer(livreur1.token, { entrepriseId: entrepriseA, lignes: [{ produitId: produitB.id, ligneCommandeId: await ligneAssignee(produitB, livreur1), ...CONFORME }] });
  assert.equal(r.status, 400);
});

test('une ligne de commande qui ne correspond pas à l’article est refusée', async () => {
  const r = await creer(livreur1.token, {
    entrepriseId: entrepriseA,
    lignes: [{ produitId: produitD.id, ligneCommandeId: '00000000-0000-4000-8000-000000000000', ...CONFORME }],
  });
  assert.equal(r.status, 400);
});

test('un bordereau sans article est refusé', async () => {
  const r = await creer(livreur1.token, { entrepriseId: entrepriseA, lignes: [] });
  assert.equal(r.status, 400);
});

test('seul un livreur crée une collecte : le client est refusé', async () => {
  const r = await creer(client.token, { entrepriseId: entrepriseA, lignes: [{ produitId: produitD.id, ligneCommandeId: await ligneAssignee(produitD, livreur1), ...CONFORME }] });
  assert.equal(r.status, 403);
});

test('le partenaire ne voit que les bordereaux de son entreprise', async () => {
  const b = await creer(livreur2.token, { entrepriseId: entrepriseB, lignes: [{ produitId: produitB.id, ligneCommandeId: await ligneAssignee(produitB, livreur2), ...CONFORME }] });
  assert.equal(b.status, 201);
  bordereauLivreur2 = b.body.id;

  const liste = await api(ctx, 'GET', '/partenaire/bordereaux', { token: partenaireA.token });
  assert.equal(liste.status, 200);
  assert.ok(liste.body.length >= 2);
  assert.ok(liste.body.every((x: { entrepriseId: string }) => x.entrepriseId === entrepriseA));

  assert.equal((await api(ctx, 'GET', `/bordereaux/${bordereauLivreur2}`, { token: partenaireA.token })).status, 403);
  assert.equal((await api(ctx, 'GET', `/bordereaux/${bordereauAnomalie.id}`, { token: partenaireA.token })).status, 200);
  assert.equal((await api(ctx, 'GET', `/bordereaux/${bordereauAnomalie.id}`, { token: partenaireB.token })).status, 403);
});

test('un livreur ne voit que ses propres collectes', async () => {
  const liste = await api(ctx, 'GET', '/livreur/bordereaux', { token: livreur2.token });
  assert.equal(liste.status, 200);
  assert.ok(liste.body.some((x: { id: string }) => x.id === bordereauLivreur2));
  assert.ok(!liste.body.some((x: { id: string }) => x.id === bordereauAnomalie.id));
  assert.equal((await api(ctx, 'GET', `/bordereaux/${bordereauAnomalie.id}`, { token: livreur2.token })).status, 403);
});

test('le client ne consulte aucun bordereau', async () => {
  assert.equal((await api(ctx, 'GET', `/bordereaux/${bordereauAnomalie.id}`, { token: client.token })).status, 403);
  assert.equal((await api(ctx, 'GET', '/partenaire/bordereaux', { token: client.token })).status, 403);
});

test('l’administration voit tous les bordereaux, filtre par statut et liste les blocages', async () => {
  const enAttente = await api(ctx, 'GET', '/admin/bordereaux?statut=ATTENTE_PARTENAIRE', { token: admin.token });
  assert.equal(enAttente.status, 200);
  assert.ok(enAttente.body.length >= 1);
  assert.ok(enAttente.body.every((x: { statut: string }) => x.statut === 'ATTENTE_PARTENAIRE'));

  const blocages = await api(ctx, 'GET', '/admin/blocages-livraison', { token: admin.token });
  assert.equal(blocages.status, 200);
  assert.ok(blocages.body.some((x: { ligneId: string }) => x.ligneId === bordereauAnomalie.ligneId));
});

test('la levée d’un blocage exige un motif, puis est journalisée et ne se fait qu’une fois', async () => {
  const sansMotif = await api(ctx, 'POST', `/admin/bordereaux/lignes/${bordereauAnomalie.ligneId}/levee-blocage`, { token: admin.token, body: { motif: 'ok' } });
  assert.equal(sansMotif.status, 400);

  const levee = await api(ctx, 'POST', `/admin/bordereaux/lignes/${bordereauAnomalie.ligneId}/levee-blocage`, {
    token: admin.token,
    body: { motif: 'Fissure cosmétique, article fonctionnel après test' },
  });
  assert.equal(levee.status, 200);
  assert.equal(await articleBloqueLivraison(base.db, produitD.id), false);

  const deuxieme = await api(ctx, 'POST', `/admin/bordereaux/lignes/${bordereauAnomalie.ligneId}/levee-blocage`, {
    token: admin.token,
    body: { motif: 'Deuxième tentative' },
  });
  assert.equal(deuxieme.status, 409);

  const journal = await api(ctx, 'GET', `/admin/journal?action=BLOCAGE_LEVE&cibleId=${bordereauAnomalie.ligneId}`, { token: admin.token });
  assert.equal(journal.body.length, 1);
  assert.equal(journal.body[0].acteurId, admin.id);
});

test('l’annulation garde le bordereau consultable et ne se fait qu’une fois', async () => {
  const r = await api(ctx, 'POST', `/admin/bordereaux/${bordereauAnomalie.id}/annulation`, { token: admin.token, body: { motif: 'Saisie en double' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.statut, 'ANNULE');

  const relu = await api(ctx, 'GET', `/bordereaux/${bordereauAnomalie.id}`, { token: admin.token });
  assert.equal(relu.status, 200, 'le bordereau annulé reste consultable');
  assert.equal(relu.body.statut, 'ANNULE');
  assert.equal(relu.body.lignes.length, 1);

  const deux = await api(ctx, 'POST', `/admin/bordereaux/${bordereauAnomalie.id}/annulation`, { token: admin.token, body: { motif: 'Encore' } });
  assert.equal(deux.status, 409);
});
