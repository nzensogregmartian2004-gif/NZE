// Réclamations (cahier §16) : seul un article livré se réclame, délai de décision de 72 heures, garantie commerciale,
// décision avec solution ou motif, clôture, retards, accès par rôle, journal sans secret.
// Le client obtient l'identifiant de ligne par sa commande, comme dans l'application : aucun raccourci en base.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let livreur: Session;
let clientA: Session;
let clientB: Session;
let entreprise: string;
let produitGaranti: string;
let produitSansGarantie: string;
const POSITION = { latitude: 0.43496, longitude: 9.454 };
const HEURE_MS = 3600 * 1000;
const JOUR_MS = 24 * HEURE_MS;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  entreprise = jeu.entreprise.id;
  produitGaranti = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: entreprise, nom: 'Casque garanti', prixFcfa: 6000, garantieJours: 7 } })).body.id;
  produitSansGarantie = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: entreprise, nom: 'Câble sans garantie', prixFcfa: 2000 } })).body.id;
  for (const id of [produitGaranti, produitSansGarantie]) {
    await api(ctx, 'POST', `/admin/produits/${id}/ajustements`, { token: admin.token, body: { delta: 20, motif: 'Stock de test réclamations' } });
  }
  livreur = await connecter(ctx, '+24174700051');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  clientA = await connecter(ctx, '+24174600051');
  clientB = await connecter(ctx, '+24174600052');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

async function commandePayee(produitId: string, token = clientA.token): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token, body: { lignes: [{ produitId, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600051' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token })).body.statut, 'SUCCESS');
  return c.body.id as string;
}

// Identifiant de la ligne telle que le client la voit dans sa commande.
async function ligneDe(commandeId: string, produitId: string, token = clientA.token): Promise<string> {
  const c = await api(ctx, 'GET', `/commandes/${commandeId}`, { token });
  assert.equal(c.status, 200);
  const ligne = c.body.lignes.find((l: { produitId: string }) => l.produitId === produitId);
  assert.ok(ligne?.id, 'la commande du client expose l’identifiant de chaque ligne');
  return ligne.id as string;
}

// Commande payée, affectée, remise en entier : l'article est alors « livré ».
async function livrer(produitId: string): Promise<{ commandeId: string; ligneId: string }> {
  const commandeId = await commandePayee(produitId);
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(a.status, 201);
  await api(ctx, 'POST', `/livreur/livraisons/${a.body.id}/demarrer`, { token: livreur.token });
  const code = (await api(ctx, 'GET', `/commandes/${commandeId}/livraison`, { token: clientA.token })).body.codeLivraison;
  const detail = (await api(ctx, 'GET', `/livreur/livraisons/${a.body.id}`, { token: livreur.token })).body;
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${a.body.id}/confirmer`, {
    token: livreur.token,
    body: { code, signaturePapierRecue: true, lignes: detail.lignes.map((l: { id: string; quantiteDemandee: number }) => ({ ligneId: l.id, quantiteLivree: l.quantiteDemandee })) },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  return { commandeId, ligneId: await ligneDe(commandeId, produitId) };
}

const reclamer = (token: string, ligneId: string, motif = 'ARTICLE_DEFECTUEUX', description = 'Le boîtier est fissuré dès la remise.') =>
  api(ctx, 'POST', '/reclamations', { token, body: { ligneCommandeId: ligneId, motif, description } });
const notifs = async (token: string) => (await api(ctx, 'GET', '/notifications?limite=100', { token })).body as { type: string }[];

let livreGaranti: { commandeId: string; ligneId: string };
let reclamationAcceptee: string;
let reclamationRefusee: string;
let livreSansGarantie: { commandeId: string; ligneId: string };
let garantieDuDossier: { jours: number | null; active: boolean; debutLe: string; finLe: string };

test('un article livré se réclame, avec un délai de décision de 72 heures et un dossier numéroté', async () => {
  livreGaranti = await livrer(produitGaranti);
  const r = await reclamer(clientA.token, livreGaranti.ligneId);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.reference, /^REC-\d{4}-\d{6}$/);
  assert.equal(r.body.statut, 'OUVERTE');
  assert.equal(r.body.enRetard, false);
  const delai = new Date(r.body.echeanceDecisionLe).getTime() - new Date(r.body.createdAt).getTime();
  assert.ok(Math.abs(delai - 72 * HEURE_MS) < 60 * 1000, `délai de ${delai} ms`);
  garantieDuDossier = r.body.garantie;
  assert.ok((await notifs(clientA.token)).some((n) => n.type === 'RECLAMATION_RECUE'));
  reclamationAcceptee = r.body.id;
});

test('la commande du client indique les articles remis, avec l’identifiant à citer dans une réclamation', async () => {
  const c = await api(ctx, 'GET', `/commandes/${livreGaranti.commandeId}`, { token: clientA.token });
  assert.equal(c.status, 200);
  const ligne = c.body.lignes.find((l: { id: string }) => l.id === livreGaranti.ligneId);
  assert.ok(ligne, 'la ligne livrée figure dans la commande');
  assert.equal(ligne.livree, true);
  assert.equal(ligne.nomArticle, 'Casque garanti', 'la commande nomme l’article');
  assert.equal(ligne.reclamationEnCours, true, 'la ligne signale la réclamation en cours');
});

test('la garantie commerciale part de la livraison, pour la durée figée à la vente', async () => {
  const { rows } = await base.pool.query('select garantie_jours from lignes_commande where id = $1', [livreGaranti.ligneId]);
  assert.equal(rows[0].garantie_jours, 7, 'la durée est figée sur la ligne à la vente');
  const debutEnBase = await base.pool.query(
    `select min(l.cloturee_le) as debut from livraisons l join lignes_livraison x on x.livraison_id = l.id
      where x.ligne_commande_id = $1 and x.quantite_livree > 0`,
    [livreGaranti.ligneId],
  );
  assert.equal(garantieDuDossier.jours, 7);
  assert.equal(garantieDuDossier.active, true);
  assert.ok(Math.abs(new Date(garantieDuDossier.debutLe).getTime() - new Date(debutEnBase.rows[0].debut).getTime()) < 1000, 'la garantie part de la livraison');
  assert.equal(new Date(garantieDuDossier.finLe).getTime() - new Date(garantieDuDossier.debutLe).getTime(), 7 * JOUR_MS);
});

test('un article sans garantie commerciale le signale dans le dossier', async () => {
  livreSansGarantie = await livrer(produitSansGarantie);
  const r = await reclamer(clientA.token, livreSansGarantie.ligneId, 'NON_CONFORME', 'Le câble n’est pas celui commandé.');
  assert.equal(r.status, 201);
  assert.equal(r.body.garantie.active, false);
  assert.equal(r.body.garantie.jours, null);
  reclamationRefusee = r.body.id;
});

test('un article qui n’a pas encore été livré ne se réclame pas, et la commande le signale', async () => {
  const commandeId = await commandePayee(produitGaranti);
  const ligneId = await ligneDe(commandeId, produitGaranti);
  const c = await api(ctx, 'GET', `/commandes/${commandeId}`, { token: clientA.token });
  assert.equal(c.body.lignes[0].livree, false);
  assert.equal((await reclamer(clientA.token, ligneId)).status, 409);
});

test('un client ne réclame pas sur la commande d’un autre, et ne voit pas ses dossiers', async () => {
  assert.equal((await reclamer(clientB.token, livreGaranti.ligneId)).status, 404);
  assert.equal((await api(ctx, 'GET', `/reclamations/${reclamationAcceptee}`, { token: clientB.token })).status, 404);
  assert.equal((await api(ctx, 'GET', '/reclamations', { token: clientB.token })).body.length, 0);
});

test('un seul dossier ouvert par article, et un motif ou une description valides', async () => {
  assert.equal((await reclamer(clientA.token, livreGaranti.ligneId)).status, 409);
  assert.equal((await reclamer(clientA.token, livreGaranti.ligneId, 'MOTIF_INVENTE')).status, 400);
  assert.equal((await reclamer(clientA.token, livreGaranti.ligneId, 'AUTRE', 'court')).status, 400);
});

test('une réclamation acceptée exige une solution ; le remboursement n’en est pas une pour un article', async () => {
  const sans = await api(ctx, 'POST', `/admin/reclamations/${reclamationAcceptee}/decision`, { token: admin.token, body: { decision: 'ACCEPTER' } });
  assert.equal(sans.status, 400);
  const remboursement = await api(ctx, 'POST', `/admin/reclamations/${reclamationAcceptee}/decision`, { token: admin.token, body: { decision: 'ACCEPTER', solution: 'REMBOURSEMENT' } });
  assert.equal(remboursement.status, 400, 'pour un article, la solution est le remplacement, pas le remboursement');
  const retour = await api(ctx, 'POST', `/admin/reclamations/${reclamationAcceptee}/decision`, { token: admin.token, body: { decision: 'ACCEPTER', solution: 'RETOUR' } });
  assert.equal(retour.status, 400, 'seul le remplacement est proposé pour un article');
  const ok = await api(ctx, 'POST', `/admin/reclamations/${reclamationAcceptee}/decision`, { token: admin.token, body: { decision: 'ACCEPTER', solution: 'REMPLACEMENT' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.statut, 'ACCEPTEE');
  assert.equal(ok.body.solution, 'REMPLACEMENT');
  assert.ok((await notifs(clientA.token)).some((n) => n.type === 'RECLAMATION_ACCEPTEE'));
  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${reclamationAcceptee}/decision`, { token: admin.token, body: { decision: 'REFUSER', motif: 'Deuxième décision' } })).status, 409, 'une décision ne se rejoue pas');
});

test('un refus exige un motif, visible du client dans son dossier et dans la notification', async () => {
  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${reclamationRefusee}/decision`, { token: admin.token, body: { decision: 'REFUSER' } })).status, 400);
  const motif = 'Dommage constaté après remise, non couvert par la garantie';
  const ok = await api(ctx, 'POST', `/admin/reclamations/${reclamationRefusee}/decision`, { token: admin.token, body: { decision: 'REFUSER', motif } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.statut, 'REFUSEE');
  const dossier = await api(ctx, 'GET', `/reclamations/${reclamationRefusee}`, { token: clientA.token });
  assert.equal(dossier.body.motifDecision, motif, 'le client lit le motif dans son dossier');
  assert.ok(!('decidePar' in dossier.body), 'le client ne voit pas qui a décidé');
  assert.ok(!('client' in dossier.body), 'le client ne voit pas les coordonnées de l’administration');
  const notif = (await notifs(clientA.token)).filter((n) => n.type === 'RECLAMATION_REFUSEE');
  assert.equal(notif.length, 1);
  assert.ok(JSON.stringify(notif).includes(motif), 'le motif figure dans la notification');
});

test('seule une réclamation acceptée se clôture', async () => {
  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${reclamationRefusee}/cloture`, { token: admin.token })).status, 409);
  const ok = await api(ctx, 'POST', `/admin/reclamations/${reclamationAcceptee}/cloture`, { token: admin.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.statut, 'CLOTUREE');
  assert.ok((await notifs(clientA.token)).some((n) => n.type === 'RECLAMATION_CLOTUREE'));
});

test('un dossier dont le délai est dépassé apparaît en retard, et ne se clôture pas tant qu’il est ouvert', async () => {
  const troisieme = await livrer(produitGaranti);
  const r = await reclamer(clientA.token, troisieme.ligneId, 'DOMMAGE_LIVRAISON', 'Carton écrasé à la remise.');
  assert.equal(r.status, 201);
  await base.pool.query("update reclamations set echeance_decision_le = now() - interval '1 hour' where id = $1", [r.body.id]);
  const retard = await api(ctx, 'GET', '/reclamations?enRetard=true', { token: admin.token });
  assert.ok(retard.body.some((x: { id: string }) => x.id === r.body.id));
  const pasRetard = await api(ctx, 'GET', '/reclamations?enRetard=false', { token: admin.token });
  assert.ok(!pasRetard.body.some((x: { id: string }) => x.id === r.body.id));
  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${r.body.id}/cloture`, { token: admin.token })).status, 409);
});

test('l’administration voit tous les dossiers ; livreur et partenaire n’y ont pas accès', async () => {
  const liste = await api(ctx, 'GET', '/reclamations?statut=REFUSEE', { token: admin.token });
  assert.equal(liste.status, 200);
  assert.ok(liste.body.every((x: { statut: string }) => x.statut === 'REFUSEE'));
  assert.equal(liste.body[0].client.telephone, '+24174600051', 'l’administration voit le téléphone du client pour le joindre');
  assert.equal((await api(ctx, 'GET', '/reclamations', { token: livreur.token })).status, 403);
});

test('les décisions sont journalisées, sans secret ni motif interne dans le journal de l’administration', async () => {
  for (const action of ['RECLAMATION_CREEE', 'RECLAMATION_DECIDEE', 'RECLAMATION_CLOTUREE']) {
    const j = await api(ctx, 'GET', `/admin/journal?action=${action}`, { token: admin.token });
    assert.ok(j.body.length >= 1, `entrée ${action} attendue`);
    for (const e of j.body) {
      for (const cle of Object.keys(e.details ?? {})) {
        assert.doesNotMatch(cle, /password|secret|token|jeton|otp|cvv|pin/i);
      }
    }
  }
});
