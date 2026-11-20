// Recherche de secrets dans le dépôt, avec des motifs courants. Signale seulement : n'affiche jamais la valeur trouvée.
// Usage : npm run verifier:secrets (depuis backend/). Code de sortie 1 si quelque chose est trouvé.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = new URL('../..', import.meta.url).pathname;
const IGNORES = new Set(['node_modules', '.git', 'dist']);
const MOTIFS = [
  { nom: 'clé d’accès AWS', re: /AKIA[0-9A-Z]{16}/ },
  { nom: 'clé privée', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nom: 'jeton JWT', re: /eyJhbGciOi[A-Za-z0-9_-]{20,}/ },
  { nom: 'clé de production (sk_live)', re: /sk_live_[A-Za-z0-9]{6,}/ },
];
// Valeurs de test connues, sans caractère secret.
const EXCEPTIONS = ['sk_test_1'];

const trouvailles = [];

function parcourir(dossier) {
  for (const nom of readdirSync(dossier)) {
    if (IGNORES.has(nom)) continue;
    const chemin = join(dossier, nom);
    const stat = statSync(chemin);
    if (stat.isDirectory()) parcourir(chemin);
    else if (stat.size < 2_000_000) analyser(chemin);
  }
}

function analyser(chemin) {
  const contenu = readFileSync(chemin, 'utf8');
  if (contenu.includes('\u0000')) return; // fichier binaire
  contenu.split('\n').forEach((ligne, i) => {
    if (EXCEPTIONS.some((e) => ligne.includes(e))) return;
    for (const m of MOTIFS) {
      if (m.re.test(ligne)) trouvailles.push({ fichier: relative(RACINE, chemin), ligne: i + 1, motif: m.nom });
    }
  });
}

parcourir(RACINE);
if (trouvailles.length === 0) {
  console.log('Aucun secret détecté dans le dépôt.');
} else {
  console.log(`${trouvailles.length} emplacement(s) à vérifier (valeurs non affichées) :`);
  for (const t of trouvailles) console.log(`  - ${t.fichier}, ligne ${t.ligne} : ${t.motif}`);
  process.exitCode = 1;
}
