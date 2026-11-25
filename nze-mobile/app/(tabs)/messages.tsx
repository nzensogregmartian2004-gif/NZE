import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { ConnexionRequise } from '../../src/components/ConnexionRequise';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { Bouton, Carte, Ecran } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

interface Conversation { id: string; produitId: string | null; createdAt: string }

function Messages() {
  const { t } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const charger = useCallback(() => {
    appeler<Conversation[]>('/conversations').then(setConversations).catch(() => setConversations([]));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function nouvelleConversation() {
    const c = await appeler<Conversation>('/conversations', { methode: 'POST', corps: {} });
    router.push(`/conversation/${c.id}`);
  }

  return (
    <Ecran>
      <Text style={styles.titre}>{t('messages.titre')}</Text>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={<Text style={styles.vide}>{t('messages.vide')}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/conversation/${item.id}`)}>
            <Carte style={styles.ligne}>
              <Text style={styles.nom}>{item.produitId ? t('messages.article') : 'NZE'}</Text>
              <Text style={styles.ouvrir}>{t('messages.ouvrir')}</Text>
            </Carte>
          </Pressable>
        )}
      />
      <View style={styles.pied}>
        <Bouton titre={t('messages.ecrire')} onPress={nouvelleConversation} />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, padding: espaces.l },
  liste: { padding: espaces.l, gap: espaces.s },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  ouvrir: { color: couleurs.violet, fontWeight: '600' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
  pied: { padding: espaces.l, borderTopWidth: 1, borderTopColor: couleurs.bordure },
});

export default function MessagesAccueil() {
  const { statut } = useSession();
  const { t } = useI18n();
  if (statut === 'deconnecte') return <ConnexionRequise titre={t('auth.requise.messages')} />;
  return <Messages />;
}
