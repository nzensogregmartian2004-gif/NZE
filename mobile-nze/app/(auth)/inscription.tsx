import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { Bouton, Champ, Ecran, Message } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

export default function Inscription() {
  const { t, langue } = useI18n();
  const { ouvrirSession } = useSession();
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('+241');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre() {
    setErreur(null);
    setChargement(true);
    try {
      const r = await appeler<{ token: string; utilisateur: { id: string; role: string; telephone?: string } }>('/auth/inscription', {
        methode: 'POST', corps: { telephone, motDePasse, nomAffiche: nom || undefined, langue }, sansJeton: true,
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
        <Text style={styles.titre}>{t('inscription.titre')}</Text>
        {erreur && <Message texte={erreur} />}
        <Champ label={t('inscription.nom')} valeur={nom} onChangeTexte={setNom} />
        <Champ label={t('connexion.telephone')} valeur={telephone} onChangeTexte={setTelephone} clavier="phone-pad" auto="username" />
        <Champ label={t('connexion.motDePasse')} valeur={motDePasse} onChangeTexte={setMotDePasse} secret />
        <Bouton titre={t('inscription.bouton')} onPress={soumettre} chargement={chargement} desactive={!telephone || motDePasse.length < 8} />
        <Text style={styles.lien} onPress={() => router.back()}>{t('inscription.dejaCompte')}</Text>
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.xl, gap: espaces.m, flexGrow: 1, justifyContent: 'center' },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: espaces.m },
  lien: { color: couleurs.violet, fontWeight: '600', textAlign: 'center', padding: espaces.s },
});
