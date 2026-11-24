// Suivi client : fraîcheur de la position, seuil de recalcul de l'itinéraire, libellés présents dans les quatre langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fraicheurPosition } from '../src/lib/suivi-livraison.ts';
import { doitRecalculerTrace, ecartMetres } from '../src/lib/carte.ts';
import { dictionnaire } from '../src/i18n/dictionnaire.ts';

test('une position transmise il y a moins de 2 minutes est récente, plus ancienne elle est signalée', () => {
  const maintenant = new Date('2026-11-24T10:00:00Z');
  assert.deepEqual(fraicheurPosition('2026-11-24T09:59:30Z', maintenant), { etat: 'RECENTE', minutes: 1 });
  assert.deepEqual(fraicheurPosition('2026-11-24T09:50:00Z', maintenant), { etat: 'ANCIENNE', minutes: 10 });
  assert.deepEqual(fraicheurPosition(null, maintenant), { etat: 'INCONNUE', minutes: 0 });
});

test('la distance entre deux points est proche de la réalité (Libreville, environ 1 km)', () => {
  const d = ecartMetres({ latitude: 0.39, longitude: 9.45 }, { latitude: 0.39, longitude: 9.4614 });
  assert.ok(d > 1200 && d < 1300, `écart obtenu : ${d}`);
});

test('l’itinéraire n’est recalculé qu’après 100 m de déplacement', () => {
  const depart = { latitude: 0.39, longitude: 9.45 };
  assert.equal(doitRecalculerTrace(null, depart), true);
  assert.equal(doitRecalculerTrace(depart, { latitude: 0.39001, longitude: 9.45001 }), false);
  assert.equal(doitRecalculerTrace(depart, { latitude: 0.3910, longitude: 9.45 }), true);
});

test('les nouveaux libellés existent dans les quatre langues', () => {
  const table = dictionnaire as unknown as Record<string, Record<string, string>>;
  for (const langue of ['fr', 'en', 'ar', 'zh-Hans']) {
    for (const cle of ['livraison.suivi.fraicheurRecente', 'livraison.suivi.fraicheurAncienne']) {
      assert.ok(table[langue][cle], `${cle} absent en ${langue}`);
    }
  }
});
