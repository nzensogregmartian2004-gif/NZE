// Collecte et stock : une collecte validée entre en stock une seule fois, un article en anomalie n'entre qu'à la levée
// de son blocage, et une collecte validée ne s'annule pas (son stock est déjà entré).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, collecterEtValider, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, ligneConfiee, produitAvecMagasin, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let livreur: Session;
let partenaire: Session;
let client: Session;
let entreprise: string;

const CONFORME_ANOMALIE = { quantite: 1, etat: 'Boîtier fissuré', testEffectue: false, controle: 'ANOMALIE', commentaire: 'Fissure visible' };

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001', 'admin_principal');
  const jeu = await jeuDeDonnees(ctx, admin);
  entreprise = jeu.entreprise.id;
  livreur = await connecter(ctx, '+24174700001');
  const role = await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } });
  assert.equal(role.status, 200);
  await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600011', entrepriseId: entreprise, motDePasse: 'motdepasse-test' } });
  partenaire = await connecter(ctx, '+24176600011');
  client = await connecter(ctx, '+24174600020');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const stockDe = async (produitId: string) =>
  (await sql<{ disponible: number; reserve: number }>(ctx, 'select disponible, reserve from stock_niveaux where produit_id = $1', [produitId]))[0];

// Bordereau d'un article en anomalie : la ligne est bloquée tant que NZE ne lève pas le blocage.
async function bordereauAnomalie(produitId: string, ligneCommandeId: string) {
  const r = await api(ctx, 'POST', '/livreur/bordereaux', {
    token: livreur.token,
    body: { entrepriseId: entreprise, lignes: [{ produitId, ligneCommandeId, ...CONFORME_ANOMALIE }] },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body as { id: string; lignes: { id: string }[] };
}
const confirmer = (id: string) => api(ctx, 'POST', `/partenaire/bordereaux/${id}/reponse`, { token: partenaire.token, body: { confirmer: true } });
const decider = (id: string) => api(ctx, 'POST', `/admin/bordereaux/${id}/decision`, { token: admin.token, body: { valider: true } });
const lever = (ligneId: string, motif: string) =>
  api(ctx, 'POST', `/admin/bordereaux/lignes/${ligneId}/levee-blocage`, { token: admin.token, body: { motif } });

test('validation : les articles récupérés entrent en stock, une seule fois, traçables au bordereau', async () => {
  const p = await produitAvecMagasin(ctx, admin, entreprise, 'Chargeur collecte', 5000);
  const ligne = await ligneConfiee(ctx, admin, client, livreur, p.id);
  const avant = await stockDe(p.id);
  await collecterEtValider(ctx, admin, livreur, partenaire, p, ligne);
  assert.equal((await stockDe(p.id)).disponible, avant.disponible + 1, 'la collecte validée augmente le stock');
  const mouvements = await sql<{ bordereau_id: string; delta_disponible: number; type: string }>(
    ctx, "select bordereau_id, delta_disponible, type from mouvements_stock where produit_id = $1 and type = 'COLLECTE'", [p.id]);
  assert.equal(mouvements.length, 1);
  assert.equal(mouvements[0].delta_disponible, 1);
  assert.ok(mouvements[0].bordereau_id, 'le mouvement renvoie au bordereau');
  const deux = await decider(mouvements[0].bordereau_id);
  assert.equal(deux.status, 409, 'une collecte déjà validée ne se valide pas deux fois');
  assert.equal((await stockDe(p.id)).disponible, avant.disponible + 1, 'pas de double entrée');
});

test('anomalie : l’article bloqué n’entre pas en stock à la validation, il entre à la levée du blocage', async () => {
  const p = await produitAvecMagasin(ctx, admin, entreprise, 'Câble anomalie', 3000);
  const ligne = await ligneConfiee(ctx, admin, client, livreur, p.id);
  const avant = await stockDe(p.id);
  const b = await bordereauAnomalie(p.id, ligne);
  assert.equal((await confirmer(b.id)).status, 200);
  const valide = await decider(b.id);
  assert.equal(valide.body.statut, 'VALIDE');
  assert.equal((await stockDe(p.id)).disponible, avant.disponible, 'article bloqué : pas encore en stock');
  const levee = await lever(b.lignes[0].id, 'Contrôle refait, article conforme');
  assert.equal(levee.status, 200, JSON.stringify(levee.body));
  assert.equal((await stockDe(p.id)).disponible, avant.disponible + 1, 'levée après validation : entrée en stock');
  const mouvements = await sql<{ type: string }>(ctx, 'select type from mouvements_stock where produit_id = $1 and bordereau_id = $2', [p.id, b.id]);
  assert.deepEqual(mouvements.map((m) => m.type), ['COLLECTE_DEBLOCAGE']);
  const deux = await lever(b.lignes[0].id, 'Encore');
  assert.equal(deux.status, 409, 'la levée ne se fait qu’une fois');
  assert.equal((await stockDe(p.id)).disponible, avant.disponible + 1, 'pas de seconde entrée');
});

test('levée de blocage avant validation : aucune double entrée à la validation', async () => {
  const p = await produitAvecMagasin(ctx, admin, entreprise, 'Adaptateur levée', 2000);
  const ligne = await ligneConfiee(ctx, admin, client, livreur, p.id);
  const avant = await stockDe(p.id);
  const b = await bordereauAnomalie(p.id, ligne);
  assert.equal((await lever(b.lignes[0].id, 'Levée avant validation')).status, 200);
  assert.equal((await stockDe(p.id)).disponible, avant.disponible, 'pas de stock tant que la collecte n’est pas validée');
  assert.equal((await confirmer(b.id)).status, 200);
  assert.equal((await decider(b.id)).body.statut, 'VALIDE');
  assert.equal((await stockDe(p.id)).disponible, avant.disponible + 1, 'entrée une seule fois, à la validation');
  const mouvements = await sql<{ type: string }>(ctx, 'select type from mouvements_stock where produit_id = $1 and bordereau_id = $2', [p.id, b.id]);
  assert.deepEqual(mouvements.map((m) => m.type), ['COLLECTE']);
});

test('une collecte validée ne s’annule pas : ses articles sont déjà entrés en stock', async () => {
  const p = await produitAvecMagasin(ctx, admin, entreprise, 'Support annulation', 1500);
  const ligne = await ligneConfiee(ctx, admin, client, livreur, p.id);
  await collecterEtValider(ctx, admin, livreur, partenaire, p, ligne);
  const [mouvement] = await sql<{ bordereau_id: string }>(ctx, "select bordereau_id from mouvements_stock where produit_id = $1 and type = 'COLLECTE'", [p.id]);
  const avant = await stockDe(p.id);
  const r = await api(ctx, 'POST', `/admin/bordereaux/${mouvement.bordereau_id}/annulation`, { token: admin.token, body: { motif: 'Saisie en double' } });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal((await stockDe(p.id)).disponible, avant.disponible, 'le stock n’a pas bougé');
  const relu = await api(ctx, 'GET', `/bordereaux/${mouvement.bordereau_id}`, { token: admin.token });
  assert.equal(relu.body.statut, 'VALIDE');
});
