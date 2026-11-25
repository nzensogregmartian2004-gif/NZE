// Photos des articles : adresse de la photo construite à partir de l'adresse de l'API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlPhotoProduit } from '../src/lib/photos.ts';

test('l’adresse de la photo d’un article suit l’adresse de l’API', () => {
  assert.equal(urlPhotoProduit('https://api.exemple.gb', 'abc-123'), 'https://api.exemple.gb/produits/abc-123/photo');
});
