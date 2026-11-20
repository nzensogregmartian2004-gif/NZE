// Envoi des notifications push restées en attente. Sans FIREBASE_SERVICE_ACCOUNT_JSON, le job n'envoie rien et le signale.
// Exécution Render Cron : node --experimental-strip-types src/jobs/push-notifications.ts
import { createDb } from '../db/client.ts';
import { creerEnvoyeurFirebase } from '../modules/push/firebase.ts';
import { envoyerNotificationsEnAttente } from '../modules/push/service.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL requis pour les notifications push');

const { db, pool } = createDb(databaseUrl);
try {
  const cle = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const envoyeur = cle ? creerEnvoyeurFirebase(cle) : null;
  const bilan = await envoyerNotificationsEnAttente(db, envoyeur);
  console.log(JSON.stringify({ evenement: 'push_termine', date: new Date().toISOString(), ...bilan }));
} catch (erreur) {
  console.error('Échec de l’envoi des notifications push', erreur);
  process.exitCode = 1;
} finally {
  await pool.end();
}
