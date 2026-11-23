import { StyleSheet, Text } from 'react-native';
import { Bouton, Ecran } from '../src/components/ui';
import { useSession } from '../src/auth/session';
import { useI18n } from '../src/i18n';
import { couleurs, espaces } from '../src/theme';

export default function Bientot() {
  const { t } = useI18n();
  const { deconnecter } = useSession();
  return (
    <Ecran>
      <Text style={styles.titre}>{t('bientot.titre')}</Text>
      <Text style={styles.texte}>{t('bientot.texte')}</Text>
      <Bouton titre={t('profil.deconnexion')} variante="secondaire" onPress={deconnecter} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, padding: espaces.l },
  texte: { color: couleurs.texteSecondaire, paddingHorizontal: espaces.l, marginBottom: espaces.l },
});
