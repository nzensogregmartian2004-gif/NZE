// Jeton de session : stocké dans le coffre sécurisé du téléphone (Keychain iOS, Keystore Android).
import * as SecureStore from 'expo-secure-store';

const CLE = 'nze.jeton';

export const lireJeton = (): Promise<string | null> => SecureStore.getItemAsync(CLE);
export const enregistrerJeton = (jeton: string): Promise<void> => SecureStore.setItemAsync(CLE, jeton);
export const effacerJeton = (): Promise<void> => SecureStore.deleteItemAsync(CLE);
