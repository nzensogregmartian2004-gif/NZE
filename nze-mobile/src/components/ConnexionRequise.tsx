// Invitation affichée à la place d'un espace réservé aux clients connectés.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { Bouton, Ecran } from './ui';
import { couleurs, espaces } from '../theme';

export function ConnexionRequise({ titre }: { titre: string }) {
  const { t } = useI18n();
  return (
    <Ecran>
      <View style={styles.bloc}>
        <Text style={styles.titre}>{titre}</Text>
        <Bouton titre={t('auth.requise.connexion')} onPress={() => router.push('/(auth)/connexion')} />
        <Bouton titre={t('auth.requise.inscription')} variante="secondaire" onPress={() => router.push('/(auth)/inscription')} />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  bloc: { flex: 1, justifyContent: 'center', padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, textAlign: 'center', marginBottom: espaces.s },
});
