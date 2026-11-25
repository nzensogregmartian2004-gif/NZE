// Photos d'articles et recherche par photo : l'article dont la photo ressemble est retrouvé en premier.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { arreterLecture } from '../src/modules/catalogue/lecture-texte.ts';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let client: Session;
let produitA: { id: string };
let produitB: { id: string };

// Motif déterministe : deux graines donnent deux images bien différentes.
async function motif(graine: number, eclaircissement = 0): Promise<string> {
  const w = 64, h = 64;
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const v = (x * 37 + y * 11 * graine) % 256;
      raw[i] = Math.min(255, v + eclaircissement);
      raw[i + 1] = (v * 3 + graine) % 256;
      raw[i + 2] = (x * y + graine) % 256;
    }
  }
  const jpeg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
  return jpeg.toString('base64');
}

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  client = await connecter(ctx, '+24174990901');
  const entreprise = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  produitA = await produitAvecMagasin(ctx, admin, entreprise, 'Ordinateur motif A', 300000);
  produitB = await produitAvecMagasin(ctx, admin, entreprise, 'Ordinateur motif B', 150000);
});
after(async () => {
  await arreterLecture();
  await ctx.close();
  await base.stop();
});

test('l’administration envoie une photo d’article, et la recherche retrouve cet article en premier', async () => {
  assert.equal((await api(ctx, 'POST', `/admin/produits/${produitA.id}/photo`, { token: admin.token, body: { image: await motif(1), typeMime: 'image/jpeg' } })).status, 201);
  assert.equal((await api(ctx, 'POST', `/admin/produits/${produitB.id}/photo`, { token: admin.token, body: { image: await motif(7), typeMime: 'image/jpeg' } })).status, 201);

  // Photo prise dans une autre lumière : même article, empreinte proche.
  const recherche = await api(ctx, 'POST', '/recherche/photo', { body: { image: await motif(1, 6), typeMime: 'image/jpeg' } });
  assert.equal(recherche.status, 200, JSON.stringify(recherche.body));
  assert.equal(recherche.body[0].id, produitA.id, JSON.stringify(recherche.body));
  assert.ok(recherche.body[0].distance <= 12);
  assert.equal(recherche.body.some((r: { id: string }) => r.id === produitB.id), false, 'l’autre article n’est pas proposé');
});

test('une photo sans rapport renvoie d’abord l’article correspondant, avec le lien signé de sa photo', async () => {
  const recherche = await api(ctx, 'POST', '/recherche/photo', { body: { image: await motif(7), typeMime: 'image/jpeg' } });
  assert.equal(recherche.body[0].id, produitB.id);
  assert.ok(recherche.body[0].photoUrl, 'le résultat contient le lien signé de la photo');
});

test('un client ne peut pas envoyer de photo d’article, et un contenu qui n’est pas une image est refusé', async () => {
  assert.equal((await api(ctx, 'POST', `/admin/produits/${produitA.id}/photo`, { token: client.token, body: { image: await motif(2), typeMime: 'image/jpeg' } })).status, 403);
  const texte = Buffer.from('ceci n’est pas une image').toString('base64');
  assert.equal((await api(ctx, 'POST', `/admin/produits/${produitA.id}/photo`, { token: admin.token, body: { image: texte, typeMime: 'image/jpeg' } })).status, 400);
});

test('la liste des articles indique quels articles ont une photo', async () => {
  const r = await api(ctx, 'GET', '/produits?limite=50');
  assert.equal(r.status, 200);
  const a = r.body.find((p: { id: string }) => p.id === produitA.id);
  assert.equal(a.aPhoto, true);
});

