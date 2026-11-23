// Notifications push : enregistrement de l'appareil après connexion, réenregistrement au démarrage, retrait à la déconnexion.
// Android : jeton FCM natif via expo-notifications. iOS (voie A, D-PUSH-3) : jeton FCM via le SDK natif Firebase.
// iOS reste désactivé (PUSH_IOS_ACTIF) tant que GoogleService-Info.plist et la clé APNs ne sont pas en place (O-20).
// Silencieux : un refus de permission ou une panne ne bloque jamais l'application.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { appeler } from '@/api/client';

export const PUSH_IOS_ACTIF = false;

// Affichage des notifications pendant que l'application est ouverte.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

interface JetonAppareil { jeton: string; plateforme: 'android' | 'ios' }

async function jetonAndroid(demander: boolean): Promise<JetonAppareil | null> {
  let statut = (await Notifications.getPermissionsAsync()).status;
  if (statut !== 'granted' && demander) statut = (await Notifications.requestPermissionsAsync()).status;
  if (statut !== 'granted') return null;
  const jeton = await Notifications.getDevicePushTokenAsync();
  return typeof jeton.data === 'string' ? { jeton: jeton.data, plateforme: 'android' } : null;
}

// iOS : le SDK natif Firebase renvoie le jeton FCM, celui que FCM sait envoyer (et non le jeton Apple brut).
async function jetonIos(demander: boolean): Promise<JetonAppareil | null> {
  if (!PUSH_IOS_ACTIF) return null;
  const { AuthorizationStatus, getMessaging, getToken, hasPermission, registerDeviceForRemoteMessages, requestPermission } =
    await import('@react-native-firebase/messaging');
  const messaging = getMessaging();
  const autorise = (s: number) => s === AuthorizationStatus.AUTHORIZED || s === AuthorizationStatus.PROVISIONAL;
  let statut = await hasPermission(messaging);
  if (!autorise(statut) && demander) statut = await requestPermission(messaging);
  if (!autorise(statut)) return null;
  await registerDeviceForRemoteMessages(messaging);
  const jeton = await getToken(messaging);
  return jeton ? { jeton, plateforme: 'ios' } : null;
}

async function jetonCourant(demander: boolean): Promise<JetonAppareil | null> {
  if (Platform.OS === 'android') return jetonAndroid(demander);
  if (Platform.OS === 'ios') return jetonIos(demander);
  return null;
}

// Après connexion ou au démarrage : enregistre l'appareil auprès de NZE.
// La permission n'est demandée qu'à la connexion (demander = true) ; au démarrage, un refus ou un oubli reste silencieux.
export async function enregistrerAppareilPush(demander = true): Promise<void> {
  const appareil = await jetonCourant(demander);
  if (!appareil) return;
  await appeler('/appareils', { methode: 'POST', corps: appareil });
}

// Avant déconnexion : retire l'appareil du compte, pour que ses notifications ne suivent pas la personne suivante.
export async function desenregistrerAppareilPush(): Promise<void> {
  const appareil = await jetonCourant(false);
  if (!appareil) return;
  await appeler('/appareils', { methode: 'DELETE', corps: { jeton: appareil.jeton } });
}

// Quand le système renouvelle le jeton pendant que l'application est ouverte, l'appareil est réenregistré aussitôt.
let arret: (() => void) | null = null;

export function demarrerSurveillanceJeton(): void {
  if (arret) return;
  if (Platform.OS === 'android') {
    const abonnement = Notifications.addPushTokenListener((jeton) => {
      if (typeof jeton.data !== 'string') return;
      void appeler('/appareils', { methode: 'POST', corps: { jeton: jeton.data, plateforme: 'android' } }).catch(() => undefined);
    });
    arret = () => abonnement.remove();
    return;
  }
  if (Platform.OS === 'ios' && PUSH_IOS_ACTIF) {
    void import('@react-native-firebase/messaging')
      .then(({ getMessaging, onTokenRefresh }) => {
        arret = onTokenRefresh(getMessaging(), (jeton) => {
          void appeler('/appareils', { methode: 'POST', corps: { jeton, plateforme: 'ios' } }).catch(() => undefined);
        });
      })
      .catch(() => undefined);
  }
}

export function arreterSurveillanceJeton(): void {
  arret?.();
  arret = null;
}
