// Photos des fiches prestataires (D-P6-M5) : envoi par l'administration, lien signé côté client, remplacement, refus.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, jeuDeDonnees, promouvoir, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let sansStockage: Contexte;
let admin: Session;
let client: Session;
let ficheId: string;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]).toString('base64');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]).toString('base64');

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  sansStockage = await demarrerContexte(base, { sansStockage: true });
  admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001');
  await jeuDeDonnees(ctx, admin);
  client = await connecter(ctx, '+24174990001');
  const f = await api(ctx, 'POST', '/admin/prestataires', { token: admin.token, body: { nomPublic: 'Studio Photo', activite: 'Photographie' } });
  ficheId = f.body.id;
  await api(ctx, 'PATCH', `/admin/prestataires/${ficheId}`, { token: admin.token, body: { statut: 'PUBLIEE' } });
});
after(async () => { await ctx.close(); await sansStockage.close(); await base.stop(); });

test('l’administration envoie une photo : elle est stockée et un lien signé est renvoyé', async () => {
  const r = await api(ctx, 'POST', `/admin/prestataires/${ficheId}/photo`, { token: admin.token, body: { contenu: JPEG, typeMime: 'image/jpeg' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.photoUrl, /^https:\/\/fichiers\.test\/fiches-prestataires\//);
  assert.equal(ctx.stockage!.objets.size, 1);
  const [cle] = [...ctx.stockage!.objets.keys()];
  assert.match(cle, new RegExp(`^fiches-prestataires/${ficheId}/`));
});

test('le client voit le lien de la photo, sans jamais recevoir la clé de stockage', async () => {
  const liste = await api(ctx, 'GET', '/prestataires');
  const fiche = liste.body.find((f: { id: string }) => f.id === ficheId);
  assert.ok(fiche.photoUrl, 'un lien est présent');
  assert.ok(!('photoCle' in fiche), 'la clé de stockage n’est pas un champ exposé');
  assert.equal((await api(ctx, 'GET', `/prestataires/${ficheId}`)).body.photoUrl, fiche.photoUrl);
});

test('un nouvel envoi remplace la photo et supprime l’ancienne', async () => {
  const avant = [...ctx.stockage!.objets.keys()];
  const r = await api(ctx, 'POST', `/admin/prestataires/${ficheId}/photo`, { token: admin.token, body: { contenu: PNG, typeMime: 'image/png' } });
  assert.equal(r.status, 200);
  assert.equal(ctx.stockage!.objets.size, 1, 'une seule photo subsiste');
  assert.ok(!ctx.stockage!.objets.has(avant[0]), 'l’ancienne photo est supprimée');
  const [nouvelle] = [...ctx.stockage!.objets.values()];
  assert.equal(nouvelle.typeMime, 'image/png');
});

test('un contenu qui n’est pas une image est refusé et rien n’est stocké', async () => {
  const avant = ctx.stockage!.objets.size;
  const texte = Buffer.from('<script>alert(1)</script>').toString('base64');
  const r = await api(ctx, 'POST', `/admin/prestataires/${ficheId}/photo`, { token: admin.token, body: { contenu: texte, typeMime: 'image/png' } });
  assert.equal(r.status, 400);
  assert.equal(ctx.stockage!.objets.size, avant);
});

test('un client ne peut pas envoyer de photo', async () => {
  const r = await api(ctx, 'POST', `/admin/prestataires/${ficheId}/photo`, { token: client.token, body: { contenu: JPEG, typeMime: 'image/jpeg' } });
  assert.equal(r.status, 403);
});

test('sans stockage configuré, l’envoi répond 503 clairement', async () => {
  const r = await api(sansStockage, 'POST', `/admin/prestataires/${ficheId}/photo`, { token: admin.token, body: { contenu: JPEG, typeMime: 'image/jpeg' } });
  assert.equal(r.status, 503);
  assert.equal(r.body.erreur.code, 'STOCKAGE_NON_CONFIGURE');
});
