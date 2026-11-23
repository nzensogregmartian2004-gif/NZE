import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../src/api/client';
import { useI18n } from '../src/i18n';
import { Carte, Ecran } from '../src/components/ui';
import { couleurs, espaces } from '../src/theme';

interface FichePublique { id: string; nomPublic: string; activite: string; description: string; zone: string | null }

// Liste des prestataires publicitaires publiés par NZE. Aucun contact direct : on ouvre la fiche pour envoyer une demande.
export default function Prestataires() {
  const { t } = useI18n();
  const [fiches, setFiches] = useState<FichePublique[]>([]);
  const [chargee, setChargee] = useState(false);

  useEffect(() => {
    appeler<FichePublique[]>('/prestataires', { sansJeton: true })
      .then(setFiches)
      .catch(() => setFiches([]))
      .finally(() => setChargee(true));
  }, []);

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <Text style={styles.titre}>{t('prestataires.titre')}</Text>
      <FlatList
        data={fiches}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={chargee ? <Text style={styles.vide}>{t('prestataires.vide')}</Text> : undefined}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/prestataire/${item.id}`)} accessibilityRole="button">
            <Carte style={styles.carte}>
              <Text style={styles.nom}>{item.nomPublic}</Text>
              <Text style={styles.activite}>{item.zone ? `${item.activite} · ${item.zone}` : item.activite}</Text>
            </Carte>
          </Pressable>
        )}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, paddingHorizontal: espaces.l, paddingBottom: espaces.m },
  liste: { paddingHorizontal: espaces.l, gap: espaces.s, paddingBottom: espaces.xl },
  carte: { gap: espaces.xs },
  nom: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  activite: { color: couleurs.texteSecondaire },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
