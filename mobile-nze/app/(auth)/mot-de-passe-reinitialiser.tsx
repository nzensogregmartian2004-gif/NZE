import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { Bouton, Champ, Ecran, Message } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

export default function MotDePasseReinitialiser() {
  const { t } = useI18n();
  const { ouvrirSession } = useSession();
  const { telephone = '' } = useLocalSearchParams<{ telephone?: string }>();
  const [code, setCode] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setErreur(null);
    setChargement(true);
    try {
      const r = await appeler<{ token: string; utilisateur: { id: string; role: string; telephone?: string } }>('/auth/mot-de-passe/reinitialiser', {
        methode: 'POST', corps: { telephone, code, nouveauMotDePasse: nouveau }, sansJeton: true,
      });
      await ouvrirSession(r);
      router.replace('/');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setChargement(false);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.titre}>{t('reinit.titre')}</Text>
        {erreur && <Message texte={erreur} />}
        <Champ label={t('reinit.code')} valeur={code} onChangeTexte={setCode} clavier="number-pad" />
        <Champ label={t('reinit.nouveau')} valeur={nouveau} onChangeTexte={setNouveau} secret />
        <Bouton titre={t('reinit.bouton')} onPress={enregistrer} chargement={chargement} desactive={code.length !== 6 || nouveau.length < 8} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.xl, gap: espaces.m, flexGrow: 1, justifyContent: 'center' },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: espaces.m },
});
