// Adresse précise : position, bâtiment, étage et indications pour le livreur, enregistrés ensemble.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, connecter, demarrerBase, demarrerContexte, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let client: Session;

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  client = await connecter(ctx, '+24174990601');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('une adresse enregistre la position et le repérage détaillé', async () => {
  const r = await api(ctx, 'POST', '/adresses', {
    token: client.token,
    body: { libelle: 'Maison', quartier: 'Akanda', repere: 'Face à la pharmacie', batiment: 'Résidence Les Palmiers', etage: '3e, porte 12', instructions: 'Sonner au portail bleu', latitude: 0.39, longitude: 9.45 },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const [a] = await sql<{ batiment: string; etage: string; instructions: string; latitude: number }>(
    ctx, 'select batiment, etage, instructions, latitude from adresses where id = $1', [r.body.id]);
  assert.equal(a.batiment, 'Résidence Les Palmiers');
  assert.equal(a.etage, '3e, porte 12');
  assert.equal(a.instructions, 'Sonner au portail bleu');
  assert.equal(Number(a.latitude), 0.39);
});

test('une adresse sans repérage détaillé reste acceptée', async () => {
  const r = await api(ctx, 'POST', '/adresses', {
    token: client.token,
    body: { libelle: 'Bureau', quartier: 'Louis', latitude: 0.40, longitude: 9.46 },
  });
  assert.equal(r.status, 201);
});
