// Recherche par texte de la photo : l'article dont le nom apparaît sur l'étiquette est proposé, avec la raison « texte ».
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, produitAvecMagasin, promouvoir, type Contexte, type Session } from './helpers.ts';
import { arreterLecture } from '../src/modules/catalogue/lecture-texte.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let admin: Session;
let hp: { id: string };
let samsung: { id: string };
let entrepriseId: string;

async function etiquette(texte: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="900" height="300" fill="white"/><text x="40" y="170" font-family="DejaVu Sans, Arial, sans-serif" font-size="90" font-weight="bold" fill="black">${texte}</text></svg>`;
  return (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  entrepriseId = (await jeuDeDonnees(ctx, admin)).entreprise.id;
  const entreprise = entrepriseId;
  hp = await produitAvecMagasin(ctx, admin, entreprise, 'Ordinateur HP Pavilion 15', 300000);
  samsung = await produitAvecMagasin(ctx, admin, entreprise, 'Téléphone Samsung Galaxy', 150000);
});
after(async () => {
  await arreterLecture();
  await ctx.close();
  await base.stop();
});

test('le nom lu sur la photo fait proposer l’article correspondant, avec la raison « texte »', async () => {
  const r = await api(ctx, 'POST', '/recherche/photo', { body: { image: await etiquette('HP PAVILION 15'), typeMime: 'image/png' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const trouve = r.body.find((x: { id: string }) => x.id === hp.id);
  assert.ok(trouve, JSON.stringify(r.body));
  assert.equal(trouve.raison, 'texte');
  assert.equal(r.body.some((x: { id: string }) => x.id === samsung.id), false, 'l’autre article n’est pas proposé');
});

test('un autre texte fait proposer l’autre article en premier', async () => {
  const r = await api(ctx, 'POST', '/recherche/photo', { body: { image: await etiquette('SAMSUNG GALAXY'), typeMime: 'image/png' } });
  assert.equal(r.body[0].id, samsung.id, JSON.stringify(r.body));
});

test('un article au nom générique est retrouvé par sa marque et son modèle', async () => {
  const cree = await api(ctx, 'POST', '/admin/produits', {
    token: admin.token,
    body: { entrepriseId, nom: 'Ordinateur portable', marque: 'Lenovo', modele: 'ThinkPad T14', prixFcfa: 250000, statut: 'PUBLIE' },
  });
  assert.equal(cree.status, 201, JSON.stringify(cree.body));
  const r = await api(ctx, 'POST', '/recherche/photo', { body: { image: await etiquette('LENOVO THINKPAD'), typeMime: 'image/png' } });
  assert.equal(r.status, 200);
  const trouve = r.body.find((x: { id: string }) => x.id === cree.body.id);
  assert.ok(trouve, JSON.stringify(r.body));
  assert.equal(trouve.raison, 'texte');
});

