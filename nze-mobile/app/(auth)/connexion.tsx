import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { Bouton, Champ, Ecran, Message } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

export default function Connexion() {
  const { t } = useI18n();
  const { ouvrirSession } = useSession();
  const [telephone, setTelephone] = useState('+241');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre() {
    setErreur(null);
    setChargement(true);
    try {
      const r = await appeler<{ token: string; utilisateur: { id: string; role: string; telephone?: string } }>('/auth/connexion', {
        methode: 'POST', corps: { telephone, motDePasse }, sansJeton: true,
      });
      await ouvrirSession(r);
      router.replace('/(auth)/accept-terms');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setChargement(false);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>NZE</Text>
        <Text style={styles.titre}>{t('connexion.titre')}</Text>
        {erreur && <Message texte={erreur} />}
        <Champ label={t('connexion.telephone')} valeur={telephone} onChangeTexte={setTelephone} clavier="phone-pad" auto="username" />
        <Champ label={t('connexion.motDePasse')} valeur={motDePasse} onChangeTexte={setMotDePasse} secret />
        <Bouton titre={t('connexion.bouton')} onPress={soumettre} chargement={chargement} desactive={!telephone || !motDePasse} />
        <View style={styles.liens}>
          <Text style={styles.lien} onPress={() => router.push('/(auth)/mot-de-passe-oublie')}>{t('connexion.oublie')}</Text>
          <Text style={styles.lien} onPress={() => router.push('/(auth)/inscription')}>{t('connexion.inscription')}</Text>
        </View>
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.xl, gap: espaces.m, flexGrow: 1, justifyContent: 'center' },
  logo: { fontSize: 36, fontWeight: '800', color: couleurs.violet, textAlign: 'center', marginBottom: espaces.s },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: espaces.m },
  liens: { gap: espaces.m, alignItems: 'center', marginTop: espaces.l },
  lien: { color: couleurs.violet, fontWeight: '600', padding: espaces.s },
});
