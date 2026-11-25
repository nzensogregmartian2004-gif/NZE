// Lecture du texte d'une photo (OCR hors ligne, sans compte ni frais). Les données de langue viennent du paquet npm.
import { copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createWorker, type Worker } from 'tesseract.js';

const requireNpm = createRequire(import.meta.url);

let moteurPret: Promise<Worker> | null = null;
let fileAttente: Promise<unknown> = Promise.resolve();

// Données de langue (anglais et français) copiées une seule fois dans un dossier de travail.
async function dossierLangues(): Promise<string> {
  const dossier = await mkdtemp(join(tmpdir(), 'nze-langues-'));
  for (const langue of ['eng', 'fra']) {
    const source = requireNpm.resolve(`@tesseract.js-data/${langue}/4.0.0_best_int/${langue}.traineddata.gz`);
    await copyFile(source, join(dossier, `${langue}.traineddata.gz`));
  }
  return dossier;
}

function moteur(): Promise<Worker> {
  if (!moteurPret) {
    moteurPret = dossierLangues().then((langPath) => createWorker(['eng', 'fra'], 1, { langPath, gzip: true }));
  }
  return moteurPret;
}

// Une lecture à la fois : le moteur ne traite pas de lectures simultanées.
export function lireTexte(contenu: Buffer): Promise<string> {
  const resultat = fileAttente.then(async () => {
    const w = await moteur();
    const { data } = await w.recognize(contenu);
    return data.text;
  });
  fileAttente = resultat.catch(() => undefined);
  return resultat;
}

// Arrêt propre du moteur (tests, arrêt du serveur).
export async function arreterLecture(): Promise<void> {
  if (!moteurPret) return;
  const w = await moteurPret;
  moteurPret = null;
  await w.terminate();
}

// Mots utiles d'un texte : sans accents, en minuscules, sans mots de liaison, deux lettres ou plus.
const MOTS_VIDES = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'et', 'pour', 'avec', 'sans', 'un', 'une', 'the', 'and', 'for', 'with']);
export function motsUtiles(texte: string): string[] {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 2 && !MOTS_VIDES.has(m));
}
