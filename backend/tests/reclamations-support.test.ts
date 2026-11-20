// Responsable, priorité et notes internes des réclamations (cahier §17.2), et alerte automatique des dossiers en retard.
// Tout ce qui est interne reste à l'administration. La base n'est modifiée que pour faire passer le délai de 72 heures.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { alerterDossiersEnRetard } from '../src/modules/reclamations/service.ts';
import { api, connecter, demarrerBase, demarrerContexte, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let secondaire: Session;
let livreur: Session;
let clientA: Session;
let produit: string;
const POSITION = { latitude: 0.43496, longitude: 9.454 };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  admin = await connecter(ctx, '+24101000001');
  secondaire = await connecter(ctx, '+24101000002');
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  secondaire = await connecter(ctx, '+24101000002');
  const entreprise = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Support test' } })).body;
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: entreprise.id, tauxBps: 1500 } });
  await api(ctx, 'POST', '/admin/livraison/point-fixe', { token: admin.token, body: { libelle: 'Point NZE', latitude: 0.39, longitude: 9.454 } });
  await api(ctx, 'POST', '/admin/livraison/tarif', { token: admin.token, body: { fcfaParKm: 300, minimumFcfa: 500 } });
  produit = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: entreprise.id, nom: 'Souris test', prixFcfa: 3000, garantieJours: 7 } })).body.id;
  await api(ctx, 'POST', `/admin/produits/${produit}/ajustements`, { token: admin.token, body: { delta: 30, motif: 'Stock de test support' } });
  livreur = await connecter(ctx, '+24174700061');
  assert.equal((await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } })).status, 200);
  clientA = await connecter(ctx, '+24174600061');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

async function commandePayee(): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token: clientA.token, body: { lignes: [{ produitId: produit, quantite: 1 }], reception: 'LIVRAISON', livraison: POSITION } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: clientA.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero: '074600061' } });
  assert.equal((await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: clientA.token })).body.statut, 'SUCCESS');
  return c.body.id as string;
}

// Article livré par le parcours réel (affectation, démarrage, confirmation) ; renvoie l'identifiant de ligne tel que le client le voit.
async function livrer(): Promise<string> {
  const commandeId = await commandePayee();
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  await api(ctx, 'POST', `/livreur/livraisons/${a.body.id}/demarrer`, { token: livreur.token });
  const code = (await api(ctx, 'GET', `/commandes/${commandeId}/livraison`, { token: clientA.token })).body.codeLivraison;
  const detail = (await api(ctx, 'GET', `/livreur/livraisons/${a.body.id}`, { token: livreur.token })).body;
  const ok = await api(ctx, 'POST', `/livreur/livraisons/${a.body.id}/confirmer`, {
    token: livreur.token,
    body: { code, signaturePapierRecue: true, lignes: detail.lignes.map((l: { id: string; quantiteDemandee: number }) => ({ ligneId: l.id, quantiteLivree: l.quantiteDemandee })) },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const c = await api(ctx, 'GET', `/commandes/${commandeId}`, { token: clientA.token });
  return c.body.lignes[0].id as string;
}

const reclamer = (ligneId: string, description = 'Le boîtier est fissuré dès la remise.') =>
  api(ctx, 'POST', '/reclamations', { token: clientA.token, body: { ligneCommandeId: ligneId, motif: 'ARTICLE_DEFECTUEUX', description } });
const modifier = (id: string, body: unknown, token = admin.token) => api(ctx, 'PATCH', `/admin/reclamations/${id}`, { token, body });
const notifs = async (token: string) => (await api(ctx, 'GET', '/notifications?limite=100', { token })).body as { type: string; cibleId: string | null }[];

let dossier: string;
let dossierCloture: string;
let dossierUrgent: string;
let dossierSansResponsable: string;
let dossierAvecResponsable: string;
let dossierAcceptable: string;

test('un dossier reçoit un responsable administrateur et une priorité, que le client ne voit jamais', async () => {
  dossier = (await reclamer(await livrer())).body.id;
  const p = await modifier(dossier, { responsableId: secondaire.id, priorite: 'HAUTE' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.responsable.id, secondaire.id);
  assert.equal(p.body.priorite, 'HAUTE');

  const vue = await api(ctx, 'GET', `/reclamations/${dossier}`, { token: clientA.token });
  assert.equal(vue.status, 200);
  for (const cle of ['responsable', 'priorite', 'notes', 'client']) {
    assert.ok(!(cle in vue.body), `le client ne voit pas « ${cle} »`);
  }
  const liste = await api(ctx, 'GET', '/reclamations', { token: clientA.token });
  assert.ok(liste.body.every((x: object) => !('priorite' in x) && !('responsable' in x)), 'la liste du client ne contient aucune donnée interne');
});

test('le responsable doit être un administrateur, la priorité doit être connue, et une mise à jour vide est refusée', async () => {
  assert.equal((await modifier(dossier, { responsableId: clientA.id })).status, 400, 'un client ne peut pas être responsable');
  assert.equal((await modifier(dossier, { priorite: 'CRITIQUE' })).status, 400);
  assert.equal((await modifier(dossier, {})).status, 400);
  assert.equal((await modifier(dossier, { responsableId: 'pas-un-identifiant' })).status, 400);
  assert.equal((await modifier(dossier, { priorite: 'URGENTE' }, clientA.token)).status, 403, 'le client ne peut pas modifier un dossier');
});

test('le responsable se retire sans toucher à la priorité', async () => {
  const r = await modifier(dossier, { responsableId: null });
  assert.equal(r.status, 200);
  assert.equal(r.body.responsable, null);
  assert.equal(r.body.priorite, 'HAUTE', 'la priorité reste celle qui était enregistrée');
});

test('une note interne est visible de toute l’administration, jamais du client, et son texte n’entre pas dans le journal', async () => {
  const texte = 'Client à rappeler avant la seconde livraison, préfère le matin';
  const note = await api(ctx, 'POST', `/admin/reclamations/${dossier}/notes`, { token: admin.token, body: { texte } });
  assert.equal(note.status, 201, JSON.stringify(note.body));
  assert.equal(note.body.texte, texte);
  assert.equal(note.body.auteur.id, admin.id);

  const detail = await api(ctx, 'GET', `/reclamations/${dossier}`, { token: secondaire.token });
  assert.equal(detail.body.notes.length, 1, 'le second administrateur voit la note');
  assert.equal(detail.body.notes[0].texte, texte);

  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${dossier}/notes`, { token: admin.token, body: { texte: '   ' } })).status, 400);
  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${dossier}/notes`, { token: clientA.token, body: { texte } })).status, 403);

  const vueClient = await api(ctx, 'GET', `/reclamations/${dossier}`, { token: clientA.token });
  assert.ok(!('notes' in vueClient.body), 'le client ne voit pas les notes internes');

  const journal = await api(ctx, 'GET', '/admin/journal?action=RECLAMATION_NOTE_AJOUTEE', { token: admin.token });
  assert.ok(journal.body.length >= 1, 'l’ajout de la note est journalisé');
  assert.ok(!JSON.stringify(journal.body).includes(texte), 'le texte de la note n’est pas recopié dans le journal');
});

test('un dossier clôturé ne se réassigne plus ; une note peut toujours être ajoutée', async () => {
  dossierCloture = (await reclamer(await livrer())).body.id;
  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${dossierCloture}/decision`, { token: admin.token, body: { decision: 'ACCEPTER', solution: 'REMPLACEMENT' } })).status, 200);
  assert.equal((await api(ctx, 'POST', `/admin/reclamations/${dossierCloture}/cloture`, { token: admin.token })).status, 200);
  assert.equal((await modifier(dossierCloture, { priorite: 'BASSE' })).status, 409);
});

test('la liste de l’administration se filtre par priorité et par responsable', async () => {
  dossierUrgent = (await reclamer(await livrer())).body.id;
  const u = await modifier(dossierUrgent, { responsableId: secondaire.id, priorite: 'URGENTE' });
  assert.equal(u.status, 200);

  const parPriorite = await api(ctx, 'GET', '/reclamations?priorite=URGENTE', { token: admin.token });
  assert.equal(parPriorite.status, 200);
  assert.ok(parPriorite.body.length >= 1 && parPriorite.body.every((x: { priorite: string }) => x.priorite === 'URGENTE'));
  assert.ok(parPriorite.body.some((x: { id: string }) => x.id === dossierUrgent));

  const parResponsable = await api(ctx, 'GET', `/reclamations?responsableId=${secondaire.id}`, { token: admin.token });
  assert.ok(parResponsable.body.some((x: { id: string }) => x.id === dossierUrgent));
  assert.ok(parResponsable.body.every((x: { responsable: { id: string } | null }) => x.responsable?.id === secondaire.id));
});

test('un dossier en retard reçoit une seule alerte : au responsable s’il existe, sinon aux administrateurs', async () => {
  dossierSansResponsable = (await reclamer(await livrer())).body.id;
  dossierAvecResponsable = (await reclamer(await livrer())).body.id;
  assert.equal((await modifier(dossierAvecResponsable, { responsableId: secondaire.id })).status, 200);
  await base.pool.query("update reclamations set echeance_decision_le = now() - interval '1 hour' where id = any($1::uuid[])", [[dossierSansResponsable, dossierAvecResponsable]]);

  const retard = await api(ctx, 'GET', '/reclamations?enRetard=true', { token: admin.token });
  assert.ok(retard.body.some((x: { id: string }) => x.id === dossierSansResponsable));
  assert.ok(!retard.body.some((x: { id: string }) => x.id === dossier), 'un dossier dans les délais n’est pas en retard');

  const premier = await alerterDossiersEnRetard(base.db);
  assert.ok(premier.dossiers >= 2, `au moins deux alertes attendues, reçu ${premier.dossiers}`);

  const alertesAdmin = (await notifs(admin.token)).filter((n) => n.type === 'RECLAMATION_EN_RETARD');
  const alertesSecondaire = (await notifs(secondaire.token)).filter((n) => n.type === 'RECLAMATION_EN_RETARD');
  assert.equal(alertesAdmin.filter((n) => n.cibleId === dossierSansResponsable).length, 1, 'sans responsable : l’administrateur principal est alerté');
  assert.equal(alertesSecondaire.filter((n) => n.cibleId === dossierSansResponsable).length, 1, 'sans responsable : l’administrateur secondaire est alerté');
  assert.equal(alertesSecondaire.filter((n) => n.cibleId === dossierAvecResponsable).length, 1, 'avec responsable : le responsable est alerté');
  assert.equal(alertesAdmin.filter((n) => n.cibleId === dossierAvecResponsable).length, 0, 'avec responsable : les autres administrateurs ne le sont pas');

  const deuxieme = await alerterDossiersEnRetard(base.db);
  assert.equal(deuxieme.dossiers, 0, 'une seconde exécution n’envoie rien de plus');
  const alertesApres = (await notifs(admin.token)).filter((n) => n.type === 'RECLAMATION_EN_RETARD' && n.cibleId === dossierSansResponsable);
  assert.equal(alertesApres.length, 1);

  const journal = await api(ctx, 'GET', '/admin/journal?action=RECLAMATION_EN_RETARD', { token: admin.token });
  const entree = journal.body.find((e: { cibleId: string }) => e.cibleId === dossierSansResponsable);
  assert.ok(entree, 'l’alerte est journalisée');
  assert.equal(entree.acteurId, null, 'l’alerte automatique n’a pas d’auteur humain');
});

test('un dossier dont le délai n’est pas dépassé n’est jamais alerté', async () => {
  dossierAcceptable = (await reclamer(await livrer())).body.id;
  await alerterDossiersEnRetard(base.db);
  const alertes = (await notifs(admin.token)).filter((n) => n.type === 'RECLAMATION_EN_RETARD' && n.cibleId === dossierAcceptable);
  assert.equal(alertes.length, 0);
});
