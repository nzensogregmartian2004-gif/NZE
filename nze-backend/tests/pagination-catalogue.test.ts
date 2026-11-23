// Pagination du catalogue : au-delà de 100 articles, tous restent accessibles par pages.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let entrepriseId: string;
let creesIds: string[] = [];
let produitsDeBase: string[] = [];

type LigneProduit = { id: string; nom: string; prixFcfa: number };

// Parcourt toutes les pages de la taille donnée, jusqu'à la première page incomplète.
async function toutesLesPages(taille: number, tri?: string): Promise<LigneProduit[]> {
  const tout: LigneProduit[] = [];
  for (let decalage = 0; ; decalage += taille) {
    const chemin = `/produits?limite=${taille}&decalage=${decalage}${tri ? `&tri=${tri}` : ''}`;
    const r = await api(ctx, 'GET', chemin);
    assert.equal(r.status, 200, `page décalage=${decalage}`);
    const deja = new Set(tout.map((p) => p.id));
    assert.ok(r.body.every((p: LigneProduit) => !deja.has(p.id)), `la page décalage=${decalage} répète des articles : décalage ignoré`);
    tout.push(...(r.body as LigneProduit[]));
    if (r.body.length < taille) break;
  }
  return tout;
}

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  const jeu = await jeuDeDonnees(ctx, admin);
  entrepriseId = jeu.entreprise.id;
  produitsDeBase = [jeu.produit.id];
  // 105 articles publiés, sans catégorie : au-delà de l'ancienne limite de 100.
  for (let i = 0; i < 105; i++) {
    const r = await api(ctx, 'POST', '/admin/produits', {
      token: admin.token,
      body: { entrepriseId, nom: `Article pagination ${String(i).padStart(3, '0')}`, prixFcfa: 1000 + i * 100 },
    });
    assert.equal(r.status, 201);
    creesIds.push(r.body.id);
  }
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('la pagination ramène tous les articles publiés, sans doublon ni oubli', async () => {
  const vus = await toutesLesPages(40);
  const ids = vus.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'aucun article ne revient deux fois');
  for (const id of [...creesIds, ...produitsDeBase]) assert.ok(ids.includes(id), `article ${id} visible`);
});

test('au-delà de 100 articles, le dernier article créé reste atteignable', async () => {
  const dernier = creesIds[creesIds.length - 1];
  const vus = await toutesLesPages(100);
  assert.ok(vus.length > 100, 'plus de 100 articles dans le catalogue');
  assert.ok(vus.some((p) => p.id === dernier), 'le 105e article est atteignable');
});

test('sans paramètre, une page contient 24 articles au plus', async () => {
  const r = await api(ctx, 'GET', '/produits');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 24);
});

test('le tri par prix reste cohérent d’une page à l’autre', async () => {
  const pages = await toutesLesPages(10, 'prix-croissant');
  for (let i = 1; i < pages.length; i++) assert.ok(pages[i - 1].prixFcfa <= pages[i].prixFcfa, 'prix non décroissants');
  assert.equal(new Set(pages.map((p) => p.id)).size, pages.length, 'aucun doublon entre pages');
});

test('une taille de page hors limites ou un décalage négatif sont refusés', async () => {
  assert.equal((await api(ctx, 'GET', '/produits?limite=0')).status, 400);
  assert.equal((await api(ctx, 'GET', '/produits?limite=101')).status, 400);
  assert.equal((await api(ctx, 'GET', '/produits?decalage=-1')).status, 400);
});
