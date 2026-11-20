// Rattrapage des paiements restés en attente (webhook manqué ou API MyPVit momentanément indisponible).
// Exécution Render Cron : node --experimental-strip-types src/jobs/rattrapage-paiements.ts
import { createDb } from '../db/client.ts';
import { loadMyPvitConfig, MyPvitClient } from '../modules/paiements/providers/mypvit/index.ts';
import { rattraperPaiementsEnAttente } from '../modules/paiements/service.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL requis pour le rattrapage des paiements');

const { db, pool } = createDb(databaseUrl);
try {
  const mypvit = new MyPvitClient(loadMyPvitConfig(process.env));
  const resultat = await rattraperPaiementsEnAttente({ db, mypvit }, 5);
  console.log(JSON.stringify({ evenement: 'rattrapage_paiements_termine', date: new Date().toISOString(), ...resultat }));
} catch (erreur) {
  console.error('Échec du rattrapage des paiements', erreur);
  process.exitCode = 1;
} finally {
  await pool.end();
}
