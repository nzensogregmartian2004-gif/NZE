import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Carte, Ecran } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

interface LivraisonListe { id: string; reference: string; statut: string; commandeReference: string }

export default function LivraisonsLivreur() {
  const { t } = useI18n();
  const { elements: liste, recharger, chargerPlus, plusDisponible, chargement } = useListePaginee<LivraisonListe>('/livreur/livraisons');
  useFocusEffect(useCallback(() => { recharger(); }, [recharger]));
  return (
    <Ecran>
      <Text style={styles.titre}>{t('livreur.titre')}</Text>
      <FlatList
        data={liste}
        keyExtractor={(l) => l.id}
        ListFooterComponent={<ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={<Text style={styles.vide}>{t('livreur.vide')}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/livraison/${item.id}`)}>
            <Carte style={styles.ligne}>
              <Text style={styles.nom}>{item.reference}</Text>
              <Text style={styles.statut}>{t(`livreur.statut.${item.statut}` as Cle)}</Text>
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
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontWeight: '600', color: couleurs.texte },
  statut: { color: couleurs.violet, fontWeight: '600' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
