// Contrôle de préparation avant test ou mise en production : présence des variables et des fichiers Firebase.
// N'affiche jamais de valeur : seulement « présent » ou « manquant ». Code de sortie 1 si un élément requis manque.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = new URL('../..', import.meta.url).pathname;
const MOBILE = join(RACINE, 'nze-mobile');
let manquants = 0;

function ligne(etat, texte) {
  const repere = { ok: '✔', manque: '✖', optionnel: '·', avertir: '!' }[etat];
  console.log(`  ${repere} ${texte}`);
  if (etat === 'manque') manquants += 1;
}

console.log('Serveur — variables d’environnement (noms seulement) :');
const requises = [
  'DATABASE_URL', 'SESSION_SECRET', 'APP_ENV', 'GOOGLE_MAPS_API_KEY',
  'MYPVIT_BASE_URL', 'MYPVIT_AGENT', 'MYPVIT_PRODUCT', 'MYPVIT_PASSWORD', 'MYPVIT_CODE_SECRET',
  'MYPVIT_CALLBACK_URL_CODE', 'MYPVIT_RECEPTION_URL_CODE', 'MYPVIT_CODE_PAYMENT', 'MYPVIT_CODE_LINK',
  'MYPVIT_CODE_STATUS', 'MYPVIT_CODE_FEES', 'MYPVIT_CODE_BALANCE', 'MYPVIT_CODE_COUNTRIES', 'MYPVIT_CODE_OPERATORS',
  'MYPVIT_CODE_QRCODE', 'MYPVIT_OPERATION_ACCOUNT_CODE', 'MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL', 'MYPVIT_OPERATION_ACCOUNT_CODE_MOOV',
];
for (const nom of requises) ligne(process.env[nom] ? 'ok' : 'manque', nom);
ligne(process.env.MYPVIT_WEBHOOK_ALLOWED_IPS ? 'ok' : 'manque', 'MYPVIT_WEBHOOK_ALLOWED_IPS (obligatoire en production)');
ligne(process.env.MYPVIT_OPERATION_ACCOUNT_CODE_CARD ? 'ok' : 'optionnel', 'MYPVIT_OPERATION_ACCOUNT_CODE_CARD (carte fermée, O-18)');
ligne(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'ok' : 'optionnel', 'FIREBASE_SERVICE_ACCOUNT_JSON (push, O-19)');
const carte = process.env.CARTOGRAPHIE ?? 'google';
if (process.env.APP_ENV === 'production' && carte !== 'google') ligne('manque', 'CARTOGRAPHIE doit valoir google en production');
else ligne('ok', `CARTOGRAPHIE = ${carte === 'google' ? 'google' : carte}`);

console.log('\nApplication — Firebase (fichiers et configuration) :');
const app = JSON.parse(readFileSync(join(MOBILE, 'app.json'), 'utf8'));
const expo = app.expo ?? app;
const androidFichier = join(MOBILE, 'google-services.json');
const iosFichier = join(MOBILE, 'GoogleService-Info.plist');
if (existsSync(androidFichier)) {
  const pkg = JSON.parse(readFileSync(androidFichier, 'utf8')).client?.[0]?.client_info?.android_client_info?.package_name;
  ligne(pkg === expo.android?.package ? 'ok' : 'avertir', `google-services.json présent (paquet Android ${pkg === expo.android?.package ? 'correct' : 'à vérifier'})`);
  ligne(expo.android?.googleServicesFile ? 'ok' : 'manque', 'app.json : android.googleServicesFile renseigné');
} else {
  ligne('manque', 'google-services.json (Android) absent de nze-mobile/');
}
if (existsSync(iosFichier)) {
  ligne('ok', 'GoogleService-Info.plist présent (iOS)');
  ligne(expo.ios?.googleServicesFile ? 'ok' : 'manque', 'app.json : ios.googleServicesFile renseigné');
} else {
  ligne('optionnel', 'GoogleService-Info.plist (iOS) absent : iOS reste désactivé (O-20)');
}
ligne((expo.plugins ?? []).includes('expo-notifications') ? 'ok' : 'manque', 'app.json : plugin expo-notifications');

console.log(`\n${manquants === 0 ? 'Tous les éléments requis sont présents.' : `${manquants} élément(s) requis manquent.`}`);
process.exitCode = manquants === 0 ? 0 : 1;
