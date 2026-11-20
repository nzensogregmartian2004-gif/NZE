// Envoi réel des notifications push via Firebase Cloud Messaging.
// Activé uniquement lorsque FIREBASE_SERVICE_ACCOUNT_JSON (clé de compte de service) est fournie.
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { EnvoyeurPush } from './service.ts';

// Jetons renvoyés comme périmés par Firebase : ils sont retirés, l'appareil devra se réenregistrer.
const CODES_JETON_INVALIDE = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

export function creerEnvoyeurFirebase(cleServiceJson: string): EnvoyeurPush {
  const application = getApps().length > 0 ? getApp() : initializeApp({ credential: cert(JSON.parse(cleServiceJson)) });
  const messaging = getMessaging(application);
  return {
    async envoyer(jetons, message) {
      const reponse = await messaging.sendEachForMulticast({
        tokens: jetons,
        notification: { title: message.titre, body: message.corps },
        data: message.donnees,
        android: { priority: 'high' },
      });
      const invalides = reponse.responses.flatMap((r, i) => (r.error && CODES_JETON_INVALIDE.has(r.error.code) ? [jetons[i]] : []));
      return { invalides };
    },
  };
}
