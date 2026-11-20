// Litige entre NZE et un partenaire (cahier §16.2) : dossier séparé du dossier client, administration seulement.
// Le litige ne se confond pas avec la réclamation liée, et ne prévient jamais le partenaire ni le client.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let clientA: Session;
let livreur: Session;
let partenaire: Session;
let entrepriseA: string;
let entrepriseB: string;
let produitA: string;
const POSITION = { latitude: 0.43496, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  admin = await connecter(ctx, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  entrepriseA = jeu.entreprise.id;
  produitA = jeu.produit.id;
  entrepriseB = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Autre boutique' } })).body.id;
  clientA = await connecter(ctx, '+24174600071');
  livreur = await connecter(ctx, '+24174700071');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  partenaire = await connecter(ctx, '+24174800071');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${partenaire.id}/role`, { token: admin.token, body: { role: 'partenaire' } })).status, 200);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

// Réclamation réelle sur un article de la boutique A, après livraison.
async function reclamationSurArticleA(): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token: clientA.token, body: { lignes: [{ produitId: produitA, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: clientA.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600071' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: clientA.token })).body.statut, 'SUCCESS');
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId: c.body.id, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  await api(ctx, 'POST', `/livreur/livraisons/${a.body.id}/demarrer`, { token: livreur.token });
  const code = (await api(ctx, 'GET', `/commandes/${c.body.id}/livraison`, { token: clientA.token })).body.codeLivraison;
  const detail = (await api(ctx, 'GET', `/livreur/livraisons/${a.body.id}`, { token: livreur.token })).body;
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${a.body.id}/confirmer`, {
    token: livreur.token,
    body: { code, signaturePapierRecue: true, lignes: detail.lignes.map((l: { id: string; quantiteDemandee: number }) => ({ ligneId: l.id, quantiteLivree: l.quantiteDemandee })) },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const ligne = (await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: clientA.token })).body.lignes[0];
  const r = await api(ctx, 'POST', '/reclamations', { token: clientA.token, body: { ligneCommandeId: ligne.id, motif: 'ARTICLE_DEFECTUEUX', description: 'Le câble ne charge plus.' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id as string;
}

let reclamation: string;
let litigeSeul: string;
let litigeLie: string;

test('un litige s’ouvre contre un partenaire, avec ou sans réclamation liée', async () => {
  const seul = await api(ctx, 'POST', '/admin/litiges-partenaire', {
    token: admin.token,
    body: { entrepriseId: entrepriseA, motif: 'Stock annoncé non conforme', description: 'Trois articles annoncés en stock étaient absents à la collecte.' },
  });
  assert.equal(seul.status, 201, JSON.stringify(seul.body));
  assert.match(seul.body.reference, /^LIT-\d{4}-\d{6}$/);
  assert.equal(seul.body.statut, 'OUVERT');
  litigeSeul = seul.body.id;

  reclamation = await reclamationSurArticleA();
  const lie = await api(ctx, 'POST', '/admin/litiges-partenaire', {
    token: admin.token,
    body: { entrepriseId: entrepriseA, reclamationId: reclamation, motif: 'Défaut de fabrication', description: 'Le fournisseur doit reprendre le lot défectueux.' },
  });
  assert.equal(lie.status, 201, JSON.stringify(lie.body));
  assert.equal(lie.body.reclamationId, reclamation);
  litigeLie = lie.body.id;
});

test('une réclamation liée doit concerner ce partenaire', async () => {
  const mauvais = await api(ctx, 'POST', '/admin/litiges-partenaire', {
    token: admin.token,
    body: { entrepriseId: entrepriseB, reclamationId: reclamation, motif: 'Mauvais partenaire', description: 'Ce dossier ne concerne pas cette boutique.' },
  });
  assert.equal(mauvais.status, 400, 'un litige ne se rattache pas au mauvais partenaire');
});

test('le partenaire et le client n’accèdent pas aux litiges, et ne reçoivent aucune notification à leur sujet', async () => {
  for (const [session, nom] of [[clientA, 'client'], [partenaire, 'partenaire'], [livreur, 'livreur']] as const) {
    assert.equal((await api(ctx, 'GET', '/admin/litiges-partenaire', { token: session.token })).status, 403, `${nom} : liste refusée`);
    assert.equal((await api(ctx, 'GET', `/admin/litiges-partenaire/${litigeSeul}`, { token: session.token })).status, 403, `${nom} : fiche refusée`);
    assert.equal((await api(ctx, 'POST', '/admin/litiges-partenaire', { token: session.token, body: { entrepriseId: entrepriseA, motif: 'Tentative', description: 'Tentative d’ouverture par un autre rôle.' } })).status, 403, `${nom} : ouverture refusée`);
  }
  const notifsPartenaire = (await api(ctx, 'GET', '/notifications?limite=100', { token: partenaire.token })).body as { cibleType: string | null }[];
  assert.ok(!notifsPartenaire.some((n) => n.cibleType === 'litige_partenaire'), 'le partenaire n’est pas prévenu du litige');
  const notifsClient = (await api(ctx, 'GET', '/notifications?limite=100', { token: clientA.token })).body as { cibleType: string | null }[];
  assert.ok(!notifsClient.some((n) => n.cibleType === 'litige_partenaire'), 'le client n’est pas prévenu du litige');
});

test('la réclamation liée garde son statut : le litige ne décide rien pour le client', async () => {
  const r = await api(ctx, 'GET', `/reclamations/${reclamation}`, { token: clientA.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.statut, 'OUVERTE');
  assert.ok(!('litige' in r.body) && !('reclamationId' in r.body), 'le client ne voit pas le litige');
});

test('la liste se filtre par partenaire et par statut, réservée à l’administration', async () => {
  const parPartenaire = await api(ctx, 'GET', `/admin/litiges-partenaire?entrepriseId=${entrepriseA}`, { token: admin.token });
  assert.equal(parPartenaire.status, 200);
  assert.ok(parPartenaire.body.length >= 2);
  assert.ok(parPartenaire.body.every((l: { entrepriseId: string }) => l.entrepriseId === entrepriseA));
  const ouverts = await api(ctx, 'GET', '/admin/litiges-partenaire?statut=OUVERT', { token: admin.token });
  assert.ok(ouverts.body.every((l: { statut: string }) => l.statut === 'OUVERT'));
});

test('le responsable et la priorité se modifient ; une clôture exige une issue et n’a lieu qu’une fois', async () => {
  const responsable = await api(ctx, 'PATCH', `/admin/litiges-partenaire/${litigeLie}`, { token: admin.token, body: { responsableId: admin.id, priorite: 'HAUTE' } });
  assert.equal(responsable.status, 200, JSON.stringify(responsable.body));
  assert.equal(responsable.body.priorite, 'HAUTE');
  assert.equal((await api(ctx, 'PATCH', `/admin/litiges-partenaire/${litigeLie}`, { token: admin.token, body: { responsableId: partenaire.id } })).status, 400, 'le responsable doit être un administrateur');

  assert.equal((await api(ctx, 'POST', `/admin/litiges-partenaire/${litigeLie}/cloture`, { token: admin.token, body: { issue: 'ok' } })).status, 400);
  const cloture = await api(ctx, 'POST', `/admin/litiges-partenaire/${litigeLie}/cloture`, { token: admin.token, body: { issue: 'Lot repris par le fournisseur, avoir émis.' } });
  assert.equal(cloture.status, 200, JSON.stringify(cloture.body));
  assert.equal(cloture.body.statut, 'CLOS');
  assert.equal(cloture.body.issue, 'Lot repris par le fournisseur, avoir émis.');
  assert.ok(cloture.body.clotureLe);

  assert.equal((await api(ctx, 'POST', `/admin/litiges-partenaire/${litigeLie}/cloture`, { token: admin.token, body: { issue: 'Seconde clôture' } })).status, 409);
  assert.equal((await api(ctx, 'PATCH', `/admin/litiges-partenaire/${litigeLie}`, { token: admin.token, body: { priorite: 'BASSE' } })).status, 409);

  const journal = await api(ctx, 'GET', '/admin/journal?action=LITIGE_CLOS', { token: admin.token });
  assert.ok(journal.body.some((e: { cibleId: string }) => e.cibleId === litigeLie), 'la clôture est journalisée');
  assert.ok(!JSON.stringify(journal.body).includes('Lot repris'), 'l’issue n’est pas recopiée dans le journal');
});
