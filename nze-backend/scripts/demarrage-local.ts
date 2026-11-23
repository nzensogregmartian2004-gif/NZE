// Démarrage local complet : Postgres embarqué (données conservées entre deux lancements), migrations comme au déploiement,
// compte administrateur de test, puis le vrai serveur. Valeurs locales factices uniquement : aucun secret réel n'est utilisé.
// Usage : npm run demarrage:local. Le code de connexion s'affiche dans ce terminal (mode console, développement seulement).
import EmbeddedPostgres from 'embedded-postgres';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from '../src/db/client.ts';

const PORT_BASE = 5543;
const PORT_SERVEUR = 3999;
const DOSSIER_BASE = join(tmpdir(), 'nze-local-pg');

// Valeurs factices pour que le serveur démarre : aucun paiement réel n'est possible en local.
const FACTICES_MYPVIT = [
  'MYPVIT_AGENT', 'MYPVIT_PASSWORD', 'MYPVIT_PRODUCT', 'MYPVIT_CODE_SECRET', 'MYPVIT_CODE_BALANCE', 'MYPVIT_CODE_COUNTRIES',
  'MYPVIT_CODE_FEES', 'MYPVIT_CODE_LINK', 'MYPVIT_CODE_OPERATORS', 'MYPVIT_CODE_PAYMENT', 'MYPVIT_CODE_QRCODE', 'MYPVIT_CODE_STATUS',
  'MYPVIT_OPERATION_ACCOUNT_CODE', 'MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL', 'MYPVIT_OPERATION_ACCOUNT_CODE_CARD', 'MYPVIT_OPERATION_ACCOUNT_CODE_MOOV',
];
const FACTICES_URL = ['MYPVIT_BASE_URL', 'MYPVIT_CALLBACK_URL_CODE', 'MYPVIT_RECEPTION_URL_CODE'];
const facticesLocaux: Record<string, string> = {};
for (const nom of FACTICES_MYPVIT) facticesLocaux[nom] = `local-factice-${nom.toLowerCase()}`;
for (const nom of FACTICES_URL) facticesLocaux[nom] = 'https://local.invalide/mypvit';
facticesLocaux.MYPVIT_TIMEOUT_MS = '10000';
facticesLocaux.CARTOGRAPHIE = 'estimation'; // interdit en production, où la distance doit être routière

const env = {
  ...facticesLocaux,
  ...process.env,
  APP_ENV: 'development',
  DATABASE_URL: `postgres://nze:nze-local@localhost:${PORT_BASE}/nze`,
  SESSION_SECRET: 'secret-local-de-test-plus-de-trente-deux-caracteres',
  OTP_PROVIDER: 'console',
  PORT: String(PORT_SERVEUR),
};

async function attendre(url: string, delaiMs = 30000): Promise<void> {
  const fin = Date.now() + delaiMs;
  while (Date.now() < fin) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // le serveur n'écoute pas encore
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`Le serveur ne répond pas sur ${url}`);
}

function lancer(commande: string[], nom: string): ChildProcess {
  const p = spawn(commande[0], commande.slice(1), { env, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout?.on('data', (d) => process.stdout.write(`[${nom}] ${d}`));
  p.stderr?.on('data', (d) => process.stderr.write(`[${nom}] ${d}`));
  return p;
}

const dejaCree = existsSync(DOSSIER_BASE);
const pg = new EmbeddedPostgres({
  databaseDir: DOSSIER_BASE, user: 'nze', password: 'nze-local', port: PORT_BASE, persistent: true,
  createPostgresUser: true, onLog: () => {}, onError: () => {},
});
let serveur: ChildProcess | null = null;
try {
  if (!dejaCree) await pg.initialise();
  await pg.start();
  if (!dejaCree) await pg.createDatabase('nze');
  console.log(dejaCree ? 'Base locale reprise (données conservées).' : 'Base locale créée.');

  await new Promise<void>((resolve, reject) => {
    const m = lancer(['node', '--env-file-if-exists=.env', '--experimental-strip-types', 'src/db/migrate.ts'], 'migrations');
    m.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`migrations en échec (code ${code})`))));
  });
  console.log('Migrations appliquées.');

  serveur = lancer(['node', '--experimental-strip-types', 'src/server.ts'], 'serveur');
  await attendre(`http://localhost:${PORT_SERVEUR}/sante`);
  await new Promise<void>((resolve) => {
    const d = lancer(['node', '--env-file-if-exists=.env', '--experimental-strip-types', 'scripts/donnees-demo.ts'], 'démo');
    d.on('exit', () => resolve());
  });
  console.log(`Serveur démarré : http://localhost:${PORT_SERVEUR} (GET /sante répond 200). Ctrl+C pour arrêter.`);
  await new Promise(() => {});
} catch (erreur) {
  console.error('Échec du démarrage local :', erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
} finally {
  serveur?.kill();
  await pg.stop().catch(() => undefined);
}
