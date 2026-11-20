// Prestataires publicitaires (D-P6) : fiche administrée par NZE, demande transmise à NZE, aucune réservation.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let autreClient: Session;
let ficheId: string;
let brouillonId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174900001');
  autreClient = await connecter(ctx, '+24174900002');
});
after(async () => { await ctx.close(); await base.stop(); });

test('NZE crée une fiche : elle est en brouillon et invisible du client', async () => {
  const r = await api(ctx, 'POST', '/admin/prestataires', {
    token: admin.token,
    body: { nomPublic: 'Studio Lumière', activite: 'Photographie', description: 'Shooting produit et événements', zone: 'Libreville' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.statut, 'BROUILLON');
  brouillonId = r.body.id;
  const liste = await api(ctx, 'GET', '/prestataires');
  assert.ok(!liste.body.some((f: { id: string }) => f.id === brouillonId), 'un brouillon n’apparaît pas');
  assert.equal((await api(ctx, 'GET', `/prestataires/${brouillonId}`)).status, 404);
});

test('une fiche publiée apparaît dans la liste et sa fiche est consultable', async () => {
  const r = await api(ctx, 'PATCH', `/admin/prestataires/${brouillonId}`, { token: admin.token, body: { statut: 'PUBLIEE' } });
  assert.equal(r.status, 200);
  ficheId = brouillonId;
  const liste = await api(ctx, 'GET', '/prestataires');
  assert.ok(liste.body.some((f: { id: string }) => f.id === ficheId));
  assert.equal((await api(ctx, 'GET', `/prestataires/${ficheId}`)).status, 200);
});

test('la vue publique ne porte aucune donnée interne ni coordonnée du prestataire', async () => {
  const f = (await api(ctx, 'GET', `/prestataires/${ficheId}`)).body;
  assert.deepEqual(Object.keys(f).sort(), ['activite', 'description', 'id', 'nomPublic', 'photoUrl', 'zone']);
  assert.equal(f.photoUrl, null, 'sans photo, pas de lien');
});

test('un client envoie une demande à NZE : enregistrée, sans réservation', async () => {
  const r = await api(ctx, 'POST', `/prestataires/${ficheId}/demandes`, {
    token: client.token,
    body: { motif: 'DEVIS', message: 'Bonjour, je voudrais un devis pour un shooting de dix articles.' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.statut, 'NOUVELLE');
  const rows = await sql<{ n: number }>(ctx, 'select count(*)::int as n from demandes_prestataire where fiche_id = $1', [ficheId]);
  assert.equal(rows[0].n, 1);
});

test('une seconde demande en cours pour la même fiche est refusée', async () => {
  const r = await api(ctx, 'POST', `/prestataires/${ficheId}/demandes`, {
    token: client.token,
    body: { motif: 'INFORMATION', message: 'Avez-vous des disponibilités le week-end ?' },
  });
  assert.equal(r.status, 409);
});

test('une demande vers une fiche non publiée est refusée', async () => {
  // Fiche distincte, restée en brouillon (la fiche de référence des autres tests est publiée).
  const brouillon = await api(ctx, 'POST', '/admin/prestataires', { token: admin.token, body: { nomPublic: 'Brouillon test', activite: 'Test' } });
  const r = await api(ctx, 'POST', `/prestataires/${brouillon.body.id}/demandes`, { token: autreClient.token, body: { motif: 'AUTRE', message: 'Bonjour, une question.' } });
  assert.equal(r.status, 404);
});

test('message trop court, motif inconnu : refusés', async () => {
  assert.equal((await api(ctx, 'POST', `/prestataires/${ficheId}/demandes`, { token: autreClient.token, body: { motif: 'DEVIS', message: 'court' } })).status, 400);
  assert.equal((await api(ctx, 'POST', `/prestataires/${ficheId}/demandes`, { token: autreClient.token, body: { motif: 'PUB', message: 'Bonjour, un message correct.' } })).status, 400);
});

test('l’administration seule gère les fiches et voit les demandes, avec le numéro du client', async () => {
  assert.equal((await api(ctx, 'GET', '/admin/prestataires', { token: client.token })).status, 403);
  assert.equal((await api(ctx, 'POST', `/prestataires/${ficheId}/demandes`, { token: admin.token, body: { motif: 'AUTRE', message: 'Message d’un administrateur.' } })).status, 403, 'un administrateur ne demande pas en client');
  const demandes = await api(ctx, 'GET', '/admin/demandes-prestataire?statut=NOUVELLE', { token: admin.token });
  assert.equal(demandes.status, 200);
  assert.equal(demandes.body.length, 1);
  assert.equal(demandes.body[0].clientTelephone, client.telephone);
  assert.equal(demandes.body[0].fichePublic, 'Studio Lumière');
});

test('NZE traite la demande : statut, note et trace au journal', async () => {
  const id = (await api(ctx, 'GET', '/admin/demandes-prestataire', { token: admin.token })).body[0].id;
  const r = await api(ctx, 'PATCH', `/admin/demandes-prestataire/${id}`, { token: admin.token, body: { statut: 'TRAITEE', note: 'Client rappelé, devis envoyé' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.statut, 'TRAITEE');
  assert.equal(r.body.noteNze, 'Client rappelé, devis envoyé');
  const journal = await api(ctx, 'GET', `/admin/journal?action=DEMANDE_PRESTATAIRE_TRAITEE&cibleId=${id}`, { token: admin.token });
  assert.equal(journal.body.length, 1);
  // Une fois traitée, le client peut envoyer une nouvelle demande pour la même fiche.
  const nouvelle = await api(ctx, 'POST', `/prestataires/${ficheId}/demandes`, { token: client.token, body: { motif: 'INFORMATION', message: 'Une nouvelle question suite à votre devis.' } });
  assert.equal(nouvelle.status, 201);
});
