import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Champ, Ecran, Message } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

export default function MotDePasseOublie() {
  const { t } = useI18n();
  const [telephone, setTelephone] = useState('+241');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [assiste, setAssiste] = useState(false);

  async function envoyer() {
    setErreur(null);
    setChargement(true);
    try {
      const reponse = await appeler<{ mode: 'SMS' | 'ASSISTE' }>('/auth/mot-de-passe/oubli', { methode: 'POST', corps: { telephone }, sansJeton: true });
      // Mode assisté : aucun SMS. Le client s'adresse à NZE, qui lui transmet un code après vérification de son identité.
      if (reponse.mode === 'ASSISTE') { setAssiste(true); return; }
      router.push({ pathname: '/(auth)/mot-de-passe-reinitialiser', params: { telephone } });
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setChargement(false);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.titre}>{t('oubli.titre')}</Text>
        <Text style={styles.info}>{t('oubli.info')}</Text>
        {erreur && <Message texte={erreur} />}
        {assiste ? <Message texte={t('oubli.assiste')} type="succes" /> : null}
        {assiste ? null : <Champ label={t('connexion.telephone')} valeur={telephone} onChangeTexte={setTelephone} clavier="phone-pad" auto="username" />}
        {assiste ? null : <Bouton titre={t('oubli.bouton')} onPress={envoyer} chargement={chargement} desactive={!telephone} />}
        <Text style={styles.lien} onPress={() => router.back()}>{t('commun.retour')}</Text>
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.xl, gap: espaces.m, flexGrow: 1, justifyContent: 'center' },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  info: { color: couleurs.texteSecondaire, marginBottom: espaces.m },
  lien: { color: couleurs.violet, fontWeight: '600', textAlign: 'center', padding: espaces.s },
});
