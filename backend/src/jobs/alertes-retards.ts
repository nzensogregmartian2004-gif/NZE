// Tâche planifiée horaire : alerte les responsables (ou les administrateurs) des dossiers de réclamation dont le délai est dépassé.
// Exécution Render Cron : node --experimental-strip-types src/jobs/alertes-retards.ts
import { createDb } from '../db/client.ts';
import { alerterDossiersEnRetard } from '../modules/reclamations/service.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL requis pour les alertes de retard');

const { db, pool } = createDb(databaseUrl);
try {
  const resultat = await alerterDossiersEnRetard(db);
  console.log(JSON.stringify({
    evenement: 'alertes_retards_terminees',
    date: new Date().toISOString(),
    dossiers: resultat.dossiers,
  }));
} catch (erreur) {
  console.error('Échec des alertes de retard', erreur);
  process.exitCode = 1;
} finally {
  await pool.end();
}
