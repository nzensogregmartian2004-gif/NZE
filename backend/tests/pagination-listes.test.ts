// Pagination des listes : chaque liste se parcourt par pages, sans doublon ni oubli, et les bornes sont refusées.
// Les messages se paginent depuis la fin : la première page contient les plus récents, dans l'ordre chronologique.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let conversationId: string;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  for (let i = 0; i < 4; i++) {
    await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId: jeu.entreprise.id, nom: `Article liste ${i}`, prixFcfa: 1000 + i } });
  }
  client = await connecter(ctx, '+24174960001');
  for (let i = 0; i < 5; i++) {
    const r = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId: jeu.produit.id, quantite: 1 }], reception: 'RETRAIT' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }
  const c = await api(ctx, 'POST', '/conversations', { token: client.token, body: {} });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  conversationId = c.body.id;
  for (let i = 1; i <= 7; i++) {
    const m = await api(ctx, 'POST', `/conversations/${conversationId}/messages`, { token: client.token, body: { genre: 'TEXTE', corps: `message ${i}` } });
    assert.equal(m.status, 201, JSON.stringify(m.body));
  }
});
after(async () => { await ctx.close(); await base.stop(); });

// Parcourt toutes les pages de taille donnée, jusqu'à la première page incomplète.
async function parcourir(chemin: string, taille: number, token?: string): Promise<Array<Record<string, unknown>>> {
  const tout: Array<Record<string, unknown>> = [];
  for (let decalage = 0; ; decalage += taille) {
    const sep = chemin.includes('?') ? '&' : '?';
    const r = await api(ctx, 'GET', `${chemin}${sep}limite=${taille}&decalage=${decalage}`, { token });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    tout.push(...r.body);
    if (r.body.length < taille) break;
  }
  return tout;
}

test('les commandes du client se parcourent par pages, sans doublon ni oubli', async () => {
  const tout = await parcourir('/commandes', 2, client.token);
  assert.equal(tout.length, 5);
  assert.equal(new Set(tout.map((c) => c.id)).size, 5);
});

test('les produits de l’administration se parcourent par pages, sans doublon', async () => {
  const tout = await parcourir('/admin/produits', 2, admin.token);
  assert.ok(tout.length >= 5, 'tous les articles sont atteignables');
  assert.equal(new Set(tout.map((p) => p.id)).size, tout.length);
});

test('le journal d’audit se parcourt par pages disjointes', async () => {
  const premiere = await api(ctx, 'GET', '/admin/journal?limite=2&decalage=0', { token: admin.token });
  const seconde = await api(ctx, 'GET', '/admin/journal?limite=2&decalage=2', { token: admin.token });
  assert.equal(premiere.status, 200);
  assert.equal(seconde.status, 200);
  const ids = new Set(premiere.body.map((e: { id: string }) => e.id));
  assert.ok(seconde.body.every((e: { id: string }) => !ids.has(e.id)), 'aucune entrée répétée d’une page à l’autre');
});

test('les messages : la première page contient les plus récents, dans l’ordre chronologique', async () => {
  const corps = async (chemin: string) => (await api(ctx, 'GET', chemin, { token: client.token })).body.map((m: { corps: string }) => m.corps);
  assert.deepEqual(await corps(`/conversations/${conversationId}/messages?limite=3`), ['message 5', 'message 6', 'message 7']);
  assert.deepEqual(await corps(`/conversations/${conversationId}/messages?limite=3&decalage=3`), ['message 2', 'message 3', 'message 4']);
  assert.deepEqual(await corps(`/conversations/${conversationId}/messages?limite=3&decalage=6`), ['message 1']);
  assert.equal((await corps(`/conversations/${conversationId}/messages`)).length, 7, 'sans paramètre, tous les messages tiennent dans la page par défaut');
});

test('une taille de page hors bornes ou un décalage négatif sont refusés', async () => {
  assert.equal((await api(ctx, 'GET', '/commandes?limite=0', { token: client.token })).status, 400);
  assert.equal((await api(ctx, 'GET', '/commandes?limite=201', { token: client.token })).status, 400);
  assert.equal((await api(ctx, 'GET', '/admin/produits?limite=201', { token: admin.token })).status, 400);
  assert.equal((await api(ctx, 'GET', '/commandes?decalage=-1', { token: client.token })).status, 400);
});
