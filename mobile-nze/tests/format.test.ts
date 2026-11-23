// Formatage des montants et des dates : aucun montant ne doit perdre ses chiffres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFcfa, formatSigne } from '../src/lib/format.ts';

const chiffres = (texte: string) => texte.replace(/\D/g, '');

test('un montant garde tous ses chiffres et porte la devise', () => {
  const texte = formatFcfa(125000);
  assert.equal(chiffres(texte), '125000');
  assert.ok(texte.includes('FCFA'), texte);
});

test('un montant nul reste lisible', () => {
  assert.equal(chiffres(formatFcfa(0)), '0');
});

test('le signe d’un écart est explicite', () => {
  assert.ok(formatSigne(500).startsWith('+'), formatSigne(500));
  assert.ok(formatSigne(-500).startsWith('-') || formatSigne(-500).startsWith('−'), formatSigne(-500));
});
