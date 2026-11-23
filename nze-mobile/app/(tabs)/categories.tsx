import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Carte, Ecran } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

interface Categorie { id: string; nom: string; slug: string }

export default function Categories() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Categorie[]>([]);

  useEffect(() => {
    appeler<Categorie[]>('/categories', { sansJeton: true }).then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <Ecran>
      <Text style={styles.titre}>{t('categories.titre')}</Text>
      <Pressable onPress={() => router.push('/prestataires')} accessibilityRole="button" style={styles.entree}>
        <Carte style={styles.ligne}>
          <Text style={styles.nom}>{t('prestataires.entree')}</Text>
        </Carte>
      </Pressable>
      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={<Text style={styles.vide}>{t('categories.vide')}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/(tabs)', params: { categorie: item.slug } })}>
            <Carte style={styles.ligne}>
              <Text style={styles.nom}>{item.nom}</Text>
            </Carte>
          </Pressable>
        )}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, padding: espaces.l },
  liste: { padding: espaces.l, gap: espaces.s },
  ligne: { paddingVertical: espaces.l },
  entree: { paddingHorizontal: espaces.l, paddingBottom: espaces.s },
  nom: { fontSize: 16, color: couleurs.texte, fontWeight: '500' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
