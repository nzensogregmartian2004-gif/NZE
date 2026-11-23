// Fiches prestataires : règles de saisie alignées sur l'API, libellés complets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBELLE_MOTIF_DEMANDE, LIBELLE_STATUT_DEMANDE, LIBELLE_STATUT_FICHE, MOTIFS_DEMANDE, ficheValide, messageValide } from '../src/lib/prestataires.ts';

test('un message de 10 à 2000 caractères est envoyable ; les espaces de bord ne comptent pas', () => {
  assert.equal(messageValide('123456789'), false, '9 caractères : trop court');
  assert.equal(messageValide('1234567890'), true, '10 caractères : juste');
  assert.equal(messageValide('   1234567890   '), true, 'les espaces ne comptent pas');
  assert.equal(messageValide('a'.repeat(2000)), true);
  assert.equal(messageValide('a'.repeat(2001)), false, '2001 caractères : trop long');
});

test('une fiche exige un nom public et une activité de 2 caractères au moins', () => {
  assert.equal(ficheValide('Ab', 'Ph'), true);
  assert.equal(ficheValide('A', 'Ph'), false);
  assert.equal(ficheValide('Studio', ' '), false);
  assert.equal(ficheValide('a'.repeat(121), 'Ph'), false);
});

test('chaque motif et chaque statut ont une clé de libellé', () => {
  for (const m of MOTIFS_DEMANDE) assert.match(LIBELLE_MOTIF_DEMANDE[m], /^prestataires\.motif\./);
  for (const s of Object.values(LIBELLE_STATUT_FICHE)) assert.match(s, /^prestataires\.statut\./);
  for (const s of Object.values(LIBELLE_STATUT_DEMANDE)) assert.match(s, /^prestataires\.statut\./);
});
