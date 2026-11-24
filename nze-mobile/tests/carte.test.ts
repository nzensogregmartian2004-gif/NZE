// Carte de livraison : cadrage et lecture de l'itinéraire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadrageCarte, extraireTrace } from '../src/lib/carte.ts';

test('le cadre englobe tous les points, en longitude puis latitude', () => {
  const cadre = cadrageCarte([{ latitude: 0.39, longitude: 9.45 }, { latitude: 0.41, longitude: 9.47 }]);
  assert.deepEqual(cadre.ne, [9.47, 0.41]);
  assert.deepEqual(cadre.sw, [9.45, 0.39]);
});

test('un seul point ouvre un petit cadre autour de lui', () => {
  const cadre = cadrageCarte([{ latitude: 0.39, longitude: 9.45 }]);
  assert.ok(cadre.ne[0] > 9.45 && cadre.sw[0] < 9.45);
  assert.ok(cadre.ne[1] > 0.39 && cadre.sw[1] < 0.39);
});

test('la trace de l’itinéraire est lue depuis la réponse Directions', () => {
  const corps = { routes: [{ geometry: { coordinates: [[9.45, 0.39], [9.46, 0.40]] } }] };
  assert.deepEqual(extraireTrace(corps), [[9.45, 0.39], [9.46, 0.40]]);
});

test('sans itinéraire, aucune trace n’est affichée', () => {
  assert.equal(extraireTrace({ routes: [] }), null);
  assert.equal(extraireTrace(null), null);
});
