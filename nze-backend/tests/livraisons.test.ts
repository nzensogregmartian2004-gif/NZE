// Livraisons à domicile : affectation, preuve de remise (code + signature), livraison partielle, échec,
// blocage par anomalie, réaffectation, vues par rôle et tableaux de bord.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session, produitAvecMagasin, ligneConfiee } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let livreur1: Session;
let livreur2: Session;
let client: Session;
let partenaireA: Session;
let partenaireB: Session;
let entrepriseA: string;
let entrepriseB: string;
let produit: { id: string; nom: string; entrepriseId: string };
const POSITION = { latitude: 0.43496, longitude: 9.454 };
const CLIENT_TELEPHONE = '+24174600030';

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  entrepriseA = jeu.entreprise.id;
  produit = jeu.produit;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 40, motif: 'Stock de test livraisons' } });
  entrepriseB = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Second commerçant' } })).body.id;

  livreur1 = await connecter(ctx, '+24174700011');
  livreur2 = await connecter(ctx, '+24174700012');
  for (const l of [livreur1, livreur2]) {
    assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${l.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  }
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600021', entrepriseId: entrepriseA, motDePasse: 'motdepasse-test' } });
  partenaireA = await connecter(ctx, '+24176600021');
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600022', entrepriseId: entrepriseB, motDePasse: 'motdepasse-test' } });
  partenaireB = await connecter(ctx, '+24176600022');
  client = await connecter(ctx, CLIENT_TELEPHONE);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

// Crée une commande en livraison et la paie (Mobile Money, paiement simulé réussi).
async function commandePayee(quantite: number, produitId = produit.id): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId, quantite }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600030' } });
  const v = await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token });
  assert.equal(v.body.statut, 'SUCCESS', JSON.stringify(v.body));
  return c.body.id as string;
}

async function affecter(commandeId: string, livreur: Session, motif = 'LIVRAISON_COMMANDE') {
  return api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId, livreurId: livreur.id, motif } });
}

async function ligneDe(commandeId: string): Promise<string> {
  const c = await api(ctx, 'GET', `/commandes/${commandeId}`, { token: client.token });
  return c.body.lignes[0].id as string;
}

const detail = (livraisonId: string, livreur: Session) => api(ctx, 'GET', `/livreur/livraisons/${livraisonId}`, { token: livreur.token });

let livraisonA: { id: string; lignes: { id: string; quantiteDemandee: number }[]; commandeId: string };
let livraisonB: string;
let livraisonC: string;
let livraisonE: string;

test('une commande non payée ne peut pas être confiée à un livreur', async () => {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: produit.id, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION } });
  const r = await affecter(c.body.id, livreur1);
  assert.equal(r.status, 409);
});

test('un destinataire qui n’est pas livreur est refusé', async () => {
  const commandeId = await commandePayee(1);
  const r = await affecter(commandeId, client);
  assert.equal(r.status, 400);
});

test('NZE confie une commande payée : le livreur voit les articles et les coordonnées du client', async () => {
  const commandeId = await commandePayee(2);
  const r = await affecter(commandeId, livreur1);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.reference, /^LIV-\d{4}-\d{6}$/);
  assert.equal(r.body.statut, 'ASSIGNEE');
  assert.equal(r.body.lignes[0].quantiteDemandee, 2);
  assert.ok(!('codeLivraison' in r.body), 'la réponse à l’administration ne contient pas le code');
  livraisonA = { id: r.body.id, lignes: r.body.lignes, commandeId };

  const vue = await detail(livraisonA.id, livreur1);
  assert.equal(vue.status, 200);
  assert.equal(vue.body.destination.clientTelephone, CLIENT_TELEPHONE);
  assert.equal(vue.body.destination.latitude, POSITION.latitude);
  assert.ok(!('codeLivraison' in vue.body));

  assert.equal((await detail(livraisonA.id, livreur2)).status, 403, 'un autre livreur ne voit pas la mission');
});

test('aucun code de remise n’est émis : la preuve est la signature papier, et aucune vue ne porte de code', async () => {
  const suivi = await api(ctx, 'GET', `/commandes/${livraisonA.commandeId}/livraison`, { token: client.token });
  assert.equal(suivi.status, 200);
  assert.ok(!('codeLivraison' in suivi.body), 'le client ne reçoit aucun code');
  const admin1 = await api(ctx, 'GET', `/admin/livraisons/${livraisonA.id}`, { token: admin.token });
  assert.equal(admin1.status, 200);
  assert.ok(!('codeLivraison' in admin1.body), 'l’administration ne reçoit aucun code');
  assert.ok(!('codeLivraison' in (await detail(livraisonA.id, livreur1)).body), 'le livreur ne reçoit aucun code');
  const listeA = await api(ctx, 'GET', '/partenaire/livraisons', { token: partenaireA.token });
  assert.ok(!JSON.stringify(listeA.body).includes('codeLivraison'), 'le partenaire ne reçoit aucun code');
  assert.ok(listeA.body.some((l: { id: string }) => l.id === livraisonA.id), 'le partenaire voit la livraison de ses articles');
  const listeB = await api(ctx, 'GET', '/partenaire/livraisons', { token: partenaireB.token });
  assert.ok(!listeB.body.some((l: { id: string }) => l.id === livraisonA.id), 'un autre partenaire ne la voit pas');
});

test('une signature non confirmée est refusée, sans rien clôturer', async () => {
  const demarrage = await api(ctx, 'POST', `/livreur/livraisons/${livraisonA.id}/demarrer`, { token: livreur1.token });
  assert.equal(demarrage.status, 200);
  assert.equal(demarrage.body.statut, 'EN_ROUTE');
  const lignes = [{ ligneId: livraisonA.lignes[0].id, quantiteLivree: 2 }];
  const sansSignature = await api(ctx, 'POST', `/livreur/livraisons/${livraisonA.id}/confirmer`, {
    token: livreur1.token,
    body: { signaturePapierRecue: false, lignes },
  });
  assert.equal(sansSignature.status, 400);
  assert.equal((await detail(livraisonA.id, livreur1)).body.statut, 'EN_ROUTE', 'la livraison reste en cours');
});

test('la confirmation complète clôt la livraison, efface l’état actif et journalise la remise', async () => {
  const lignes = [{ ligneId: livraisonA.lignes[0].id, quantiteLivree: 2 }];
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${livraisonA.id}/confirmer`, {
    token: livreur1.token,
    body: { signaturePapierRecue: true, lignes, latitude: POSITION.latitude, longitude: POSITION.longitude, commentaire: 'Remis au client' },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.statut, 'LIVREE');
  assert.equal(ok.body.signaturePapierRecue, true);
  assert.equal(ok.body.lignes[0].statutLigne, 'LIVREE');
  const suivi = await api(ctx, 'GET', `/commandes/${livraisonA.commandeId}/livraison`, { token: client.token });
  assert.equal(suivi.body.statutActif, null);
  const journal = await api(ctx, 'GET', `/admin/journal?action=LIVRAISON_CONFIRMEE&cibleId=${livraisonA.id}`, { token: admin.token });
  assert.equal(journal.body.length, 1);
  assert.equal(journal.body[0].acteurId, livreur1.id);
  const deuxieme = await api(ctx, 'POST', `/livreur/livraisons/${livraisonA.id}/confirmer`, { token: livreur1.token, body: { signaturePapierRecue: true, lignes } });
  assert.equal(deuxieme.status, 409, 'une livraison clôturée ne se confirme pas deux fois');
});

test('une livraison partielle ouvre une seconde livraison limitée aux articles restants', async () => {
  const commandeId = await commandePayee(3);
  const r = await affecter(commandeId, livreur1);
  assert.equal(r.status, 201);
  livraisonB = r.body.id;
  await api(ctx, 'POST', `/livreur/livraisons/${livraisonB}/demarrer`, { token: livreur1.token });
  const vue = await detail(livraisonB, livreur1);
  const partielle = await api(ctx, 'POST', `/livreur/livraisons/${livraisonB}/confirmer`, {
    token: livreur1.token,
    body: { signaturePapierRecue: true, lignes: [{ ligneId: vue.body.lignes[0].id, quantiteLivree: 1 }] },
  });
  assert.equal(partielle.status, 200, JSON.stringify(partielle.body));
  assert.equal(partielle.body.statut, 'PARTIELLE');
  assert.equal(partielle.body.lignes[0].statutLigne, 'PARTIELLE');

  assert.equal((await affecter(commandeId, livreur2)).status, 409, 'pas de nouvelle livraison complète');
  const seconde = await affecter(commandeId, livreur2, 'SECONDE_LIVRAISON');
  assert.equal(seconde.status, 201, JSON.stringify(seconde.body));
  assert.equal(seconde.body.motif, 'SECONDE_LIVRAISON');
  assert.equal(seconde.body.lignes[0].quantiteDemandee, 2, 'seulement les 2 articles restants');
});

test('un échec de livraison clôt la tentative et permet une nouvelle tentative, pas une seconde livraison', async () => {
  const commandeId = await commandePayee(1);
  const r = await affecter(commandeId, livreur1);
  livraisonC = r.body.id;
  await api(ctx, 'POST', `/livreur/livraisons/${livraisonC}/demarrer`, { token: livreur1.token });
  const echec = await api(ctx, 'POST', `/livreur/livraisons/${livraisonC}/echec`, { token: livreur1.token, body: { motif: 'CLIENT_ABSENT', commentaire: 'Personne au portail' } });
  assert.equal(echec.status, 200);
  assert.equal(echec.body.statut, 'ECHEC');
  assert.equal(echec.body.motifEchec, 'CLIENT_ABSENT');

  const suivi = await api(ctx, 'GET', `/commandes/${commandeId}/livraison`, { token: client.token });
  assert.ok(!('codeLivraison' in suivi.body), 'aucun code n’est exposé');

  const nouvelle = await affecter(commandeId, livreur2, 'NOUVELLE_TENTATIVE');
  assert.equal(nouvelle.status, 201, JSON.stringify(nouvelle.body));
  assert.equal(nouvelle.body.lignes[0].quantiteDemandee, 1);
  assert.equal((await affecter(commandeId, livreur2, 'SECONDE_LIVRAISON')).status, 409);
});

test('une anomalie de qualité bloque l’article : ni affectation, ni clôture, jusqu’à la levée', async () => {
  const p = await produitAvecMagasin(ctx, admin, entrepriseA, 'Adaptateur secteur', 4000);
  // Une collecte ne porte que sur une ligne déjà confiée au livreur : la première affectation précède le constat.
  const commandeUn = await commandePayee(1, p.id);
  const premiere = await affecter(commandeUn, livreur1);
  assert.equal(premiere.status, 201, JSON.stringify(premiere.body));
  const anomalie = await api(ctx, 'POST', '/livreur/bordereaux', {
    token: livreur1.token,
    body: { entrepriseId: entrepriseA, lignes: [{ produitId: p.id, ligneCommandeId: await ligneDe(commandeUn), quantite: 1, etat: 'Fiche cassée', testEffectue: false, controle: 'ANOMALIE' }] },
  });
  assert.equal(anomalie.status, 201, JSON.stringify(anomalie.body));

  // L'article est bloqué : une nouvelle affectation est refusée.
  const commandeDeux = await commandePayee(1, p.id);
  const bloque = await affecter(commandeDeux, livreur1);
  assert.equal(bloque.status, 409);
  assert.match(bloque.body.erreur.message, /anomalie de qualité/);

  const levee = await api(ctx, 'POST', `/admin/bordereaux/lignes/${anomalie.body.lignes[0].id}/levee-blocage`, {
    token: admin.token,
    body: { motif: 'Défaut mineur, article vérifié' },
  });
  assert.equal(levee.status, 200);
  const r = await affecter(commandeDeux, livreur1);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const livraison = r.body.id;
  await api(ctx, 'POST', `/livreur/livraisons/${livraison}/demarrer`, { token: livreur1.token });
  const vue = await detail(livraison, livreur1);

  // Une nouvelle anomalie survient pendant la livraison : la clôture est refusée.
  const nouvelleAnomalie = await api(ctx, 'POST', '/livreur/bordereaux', {
    token: livreur1.token,
    body: { entrepriseId: entrepriseA, lignes: [{ produitId: p.id, ligneCommandeId: await ligneDe(commandeDeux), quantite: 1, etat: 'Connecteur oxydé', testEffectue: false, controle: 'ANOMALIE' }] },
  });
  assert.equal(nouvelleAnomalie.status, 201, JSON.stringify(nouvelleAnomalie.body));
  const refus = await api(ctx, 'POST', `/livreur/livraisons/${livraison}/confirmer`, {
    token: livreur1.token,
    body: { signaturePapierRecue: true, lignes: [{ ligneId: vue.body.lignes[0].id, quantiteLivree: 1 }] },
  });
  assert.equal(refus.status, 409);

  await api(ctx, 'POST', `/admin/bordereaux/lignes/${nouvelleAnomalie.body.lignes[0].id}/levee-blocage`, { token: admin.token, body: { motif: 'Vérifié au magasin' } });
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${livraison}/confirmer`, {
    token: livreur1.token,
    body: { signaturePapierRecue: true, lignes: [{ ligneId: vue.body.lignes[0].id, quantiteLivree: 1 }] },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.statut, 'LIVREE');
});

test('la réaffectation transfère l’accès : l’ancien livreur ne voit plus la mission', async () => {
  const commandeId = await commandePayee(1);
  const r = await affecter(commandeId, livreur1);
  livraisonE = r.body.id;
  const re = await api(ctx, 'POST', `/admin/livraisons/${livraisonE}/reassigner`, { token: admin.token, body: { livreurId: livreur2.id } });
  assert.equal(re.status, 200);
  assert.equal(re.body.livreurId, livreur2.id);
  assert.equal((await detail(livraisonE, livreur1)).status, 403);
  assert.equal((await detail(livraisonE, livreur2)).status, 200);
  assert.equal((await api(ctx, 'POST', `/livreur/livraisons/${livraisonE}/demarrer`, { token: livreur1.token })).status, 403);

  const journal = await api(ctx, 'GET', `/admin/journal?action=LIVRAISON_REASSIGNEE&cibleId=${livraisonE}`, { token: admin.token });
  assert.equal(journal.body.length, 1);
  assert.equal(await api(ctx, 'POST', `/admin/livraisons/${livraisonA.id}/reassigner`, { token: admin.token, body: { livreurId: livreur2.id } }).then((x) => x.status), 409, 'une livraison clôturée ne se réaffecte pas');
});

test('les tableaux de bord reflètent l’activité, chacun dans sa seule portée', async () => {
  const tl1 = await api(ctx, 'GET', '/livreur/tableau-de-bord', { token: livreur1.token });
  assert.equal(tl1.status, 200);
  assert.ok(tl1.body.livreesMois >= 2, 'livraisons clôturées ce mois');
  assert.ok(tl1.body.partiellesMois >= 1);
  assert.ok(tl1.body.echecsMois >= 1);

  const ta = await api(ctx, 'GET', '/admin/tableau-de-bord', { token: admin.token });
  assert.equal(ta.status, 200);
  assert.ok(ta.body.parStatut.LIVREE >= 2);
  assert.equal(ta.body.blocagesOuverts, 0, 'toutes les anomalies de test ont été levées');
  assert.ok(ta.body.parLivreur.some((x: { livreurId: string }) => x.livreurId === livreur1.id));

  const pa = await api(ctx, 'GET', '/partenaire/tableau-de-bord', { token: partenaireA.token });
  assert.ok(pa.body.lignesParStatut.LIVREE >= 1);
  const pb = await api(ctx, 'GET', '/partenaire/tableau-de-bord', { token: partenaireB.token });
  assert.equal(pb.body.livraisonsActives, 0);
  assert.equal(pb.body.lignesParStatut.LIVREE, 0, 'le partenaire B ne voit pas les articles de A');

  assert.equal((await api(ctx, 'GET', '/admin/tableau-de-bord', { token: client.token })).status, 403);
  assert.equal((await api(ctx, 'GET', '/livreur/tableau-de-bord', { token: partenaireA.token })).status, 403);
});

test('le client ne voit que ses propres commandes, et aucun code ne fuit dans le journal', async () => {
  const autre = await connecter(ctx, '+24174600031');
  const suiviAutre = await api(ctx, 'GET', `/commandes/${livraisonA.commandeId}/livraison`, { token: autre.token });
  assert.equal(suiviAutre.status, 404);

  const journal = await api(ctx, 'GET', '/admin/journal?limite=200', { token: admin.token });
  assert.equal(journal.status, 200);
  assert.ok(!JSON.stringify(journal.body).includes('codeLivraison'), 'aucun code de remise ne figure dans le journal');
});

test('les tableaux de bord égalent le recalcul depuis les listes brutes (agrégats en base)', async () => {
  // Référence : même période que le serveur (mois en heure du Gabon, UTC+1), recalculée ici depuis les livraisons listées.
  const DECALAGE = 60 * 60 * 1000;
  const debutMois = (d: Date) => { const l = new Date(d.getTime() + DECALAGE); return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - DECALAGE); };
  const mois = debutMois(new Date());
  const dansLeMois = (l: { clotureeLe: string | null }) => !!l.clotureeLe && new Date(l.clotureeLe) >= mois;
  type Ligne = { statut: string; clotureeLe: string | null; livreurId?: string };

  const liste = (await api(ctx, 'GET', '/admin/livraisons?limite=200', { token: admin.token })).body as Ligne[];
  const ta = await api(ctx, 'GET', '/admin/tableau-de-bord', { token: admin.token });
  assert.equal(ta.status, 200);

  const attendu: Record<string, number> = { ASSIGNEE: 0, EN_ROUTE: 0, ARRIVE: 0, LIVREE: 0, PARTIELLE: 0, ECHEC: 0 };
  for (const l of liste) attendu[l.statut] = (attendu[l.statut] ?? 0) + 1;
  assert.deepEqual(ta.body.parStatut, attendu);
  assert.equal(ta.body.aReprendre, liste.filter((l) => (l.statut === 'ECHEC' || l.statut === 'PARTIELLE') && dansLeMois(l)).length);
  assert.equal(ta.body.parLivreur.length, new Set(liste.map((l) => l.livreurId)).size, 'tous les livreurs ayant une livraison sont listés');
  for (const x of ta.body.parLivreur as Array<{ livreurId: string; livreesMois: number; partiellesMois: number; echecsMois: number }>) {
    const mes = liste.filter((l) => l.livreurId === x.livreurId && dansLeMois(l));
    assert.equal(x.livreesMois, mes.filter((l) => l.statut === 'LIVREE').length, 'livrées ce mois');
    assert.equal(x.partiellesMois, mes.filter((l) => l.statut === 'PARTIELLE').length, 'partielles ce mois');
    assert.equal(x.echecsMois, mes.filter((l) => l.statut === 'ECHEC').length, 'échecs ce mois');
  }

  const tl = await api(ctx, 'GET', '/livreur/tableau-de-bord', { token: livreur1.token });
  const mesLivraisons = (await api(ctx, 'GET', '/livreur/livraisons?limite=200', { token: livreur1.token })).body as Ligne[];
  assert.equal(tl.body.aFaire, mesLivraisons.filter((l) => l.statut === 'ASSIGNEE').length);
  assert.equal(tl.body.enCours, mesLivraisons.filter((l) => l.statut === 'EN_ROUTE' || l.statut === 'ARRIVE').length);
  assert.equal(tl.body.livreesAujourdhui >= 0, true);
  assert.equal(tl.body.livreesMois, mesLivraisons.filter((l) => l.statut === 'LIVREE' && dansLeMois(l)).length);
  assert.equal(tl.body.partiellesMois, mesLivraisons.filter((l) => l.statut === 'PARTIELLE' && dansLeMois(l)).length);
  assert.equal(tl.body.echecsMois, mesLivraisons.filter((l) => l.statut === 'ECHEC' && dansLeMois(l)).length);
});
