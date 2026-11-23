// Historique d'un dossier de réclamation : actions journalisées, lisibles par l'administration seulement.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let reclamationId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174600180');
  const produitId = (await jeuDeDonnees(ctx, admin)).produit.id;
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId, quantite: 1 }], reception: 'RETRAIT' } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const [ligne] = await sql<{ id: string }>(ctx, 'SELECT id FROM lignes_commande WHERE commande_id = $1', [c.body.id]);
  const [user] = await sql<{ id: string }>(ctx, 'SELECT id FROM users WHERE telephone = $1', ['+24174600180']);
  const [r] = await sql<{ id: string }>(
    ctx,
    `INSERT INTO reclamations (client_id, commande_id, ligne_commande_id, produit_id, nom_article, motif, description, echeance_decision_le)
     VALUES ($1, $2, $3, $4, 'Article', 'ARTICLE_DEFECTUEUX', 'Test historique', now() + interval '72 hours') RETURNING id`,
    [user.id, c.body.id, ligne.id, produitId],
  );
  reclamationId = r.id;
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('une note interne apparaît dans l’historique du dossier, avec son auteur', async () => {
  const note = await api(ctx, 'POST', `/admin/reclamations/${reclamationId}/notes`, { token: admin.token, body: { texte: 'Client rappelé, article en vérification' } });
  assert.equal(note.status, 201, JSON.stringify(note.body));
  const histo = (await api(ctx, 'GET', `/admin/reclamations/${reclamationId}/historique`, { token: admin.token })).body as Array<{ action: string; acteurId: string | null }>;
  const entree = histo.find((h) => h.action === 'RECLAMATION_NOTE_AJOUTEE');
  assert.ok(entree, 'la note est journalisée sur le dossier');
  assert.ok(entree!.acteurId, 'l’auteur est enregistré');
});

test('l’historique est réservé à l’administration', async () => {
  assert.equal((await api(ctx, 'GET', `/admin/reclamations/${reclamationId}/historique`, { token: client.token })).status, 403);
});
