// Tâche planifiée quotidienne : envoie les notifications d'échéance des paiements échelonnés.
// Exécution Render Cron : node --experimental-strip-types src/jobs/relances-quotidiennes.ts
import { createDb } from '../db/client.ts';
import { relancerEcheances } from '../modules/echelonnement/service.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL requis pour les relances quotidiennes');

const { db, pool } = createDb(databaseUrl);
try {
  const resultat = await relancerEcheances(db);
  console.log(JSON.stringify({
    evenement: 'relances_echelonnement_terminees',
    date: new Date().toISOString(),
    echeancesProches: resultat.echeancesProches,
    echeancesEnRetard: resultat.echeancesEnRetard,
  }));
} catch (erreur) {
  console.error('Échec des relances quotidiennes', erreur);
  process.exitCode = 1;
} finally {
  await pool.end();
}
