// Recherche par photo : type de l'image envoyée, et libellés dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeMimeImage } from '../src/lib/recherche-photo.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('le type envoyé au serveur est celui de la photo, JPEG par défaut', () => {
  assert.equal(typeMimeImage('image/png'), 'image/png');
  assert.equal(typeMimeImage('image/webp'), 'image/webp');
  assert.equal(typeMimeImage('image/jpeg'), 'image/jpeg');
  assert.equal(typeMimeImage(null), 'image/jpeg');
});

test('les libellés de la recherche et de l’ajout des photos existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  const cles = ['onglets.photos', 'recherche.photo.titre', 'recherche.photo.indice', 'recherche.photo.prendre', 'recherche.photo.galerie', 'recherche.photo.enCours', 'recherche.photo.aucun', 'admin.photos.titre', 'admin.photos.ajouter', 'admin.photos.ok', 'admin.photos.erreur'];
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of cles) assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
  }
});
