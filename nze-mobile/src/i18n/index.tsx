// Langue de l'application : choisie par l'utilisateur, mémorisée sur le téléphone, et synchronisée avec son profil.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import { dictionnaire, LANGUES, type Cle, type Langue } from './dictionnaire';
import { detecterLangue } from './detection';

const CLE_STOCKAGE = 'nze.langue';

interface I18nValeur {
  langue: Langue;
  setLangue: (l: Langue) => Promise<void>;
  t: (cle: Cle, variables?: Record<string, string | number>) => string;
  rtl: boolean;
}

const I18nContext = createContext<I18nValeur | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [langue, setLangueEtat] = useState<Langue>('fr');

  useEffect(() => {
    let actif = true;
    async function initialiserLangue() {
      try {
        const sauvegardee = await SecureStore.getItemAsync(CLE_STOCKAGE);
        const locale = getLocales()[0];
        const tag = (locale?.languageTag ?? '').toLowerCase();
        const code = (locale?.languageCode ?? tag.split('-')[0]).toLowerCase();
        const detectee: Langue = detecterLangue(code, tag);
        const choisie = sauvegardee && (LANGUES as string[]).includes(sauvegardee)
          ? sauvegardee as Langue
          : detectee;
        if (!actif) return;
        setLangueEtat(choisie);
        I18nManager.allowRTL(choisie === 'ar');
        I18nManager.forceRTL(choisie === 'ar');
        if (!sauvegardee) await SecureStore.setItemAsync(CLE_STOCKAGE, choisie);
      } catch {
        // Si le stockage sécurisé ou la détection échoue, le français reste la langue de secours.
      }
    }
    void initialiserLangue();
    return () => { actif = false; };
  }, []);

  const valeur = useMemo<I18nValeur>(() => {
    const setLangue = async (l: Langue) => {
      await SecureStore.setItemAsync(CLE_STOCKAGE, l);
      setLangueEtat(l);
      // Le sens de lecture (droite-gauche) s'applique au redémarrage de l'application.
      I18nManager.allowRTL(l === 'ar');
      I18nManager.forceRTL(l === 'ar');
    };
    const t = (cle: Cle, variables?: Record<string, string | number>) => {
      let texte: string = (dictionnaire[langue] as Record<string, string>)[cle] ?? dictionnaire.fr[cle];
      if (variables) for (const [k, v] of Object.entries(variables)) texte = texte.replace(`{${k}}`, String(v));
      return texte;
    };
    return { langue, setLangue, t, rtl: langue === 'ar' };
  }, [langue]);

  return <I18nContext.Provider value={valeur}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValeur {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n hors de I18nProvider');
  return v;
}
