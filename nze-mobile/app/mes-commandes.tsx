import { useListePaginee } from '../src/lib/use-liste-paginee';
import { ChargerPlus } from '../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../src/i18n';
import { Carte, Ecran } from '../src/components/ui';
import { formatDateHeure, formatFcfa } from '../src/lib/format';
import { LIBELLE_STATUT_COMMANDE } from '../src/lib/reclamations';
import { couleurs, espaces } from '../src/theme';

interface CommandeResume { id: string; reference: string; statut: string; totalFcfa: number; createdAt: string }

export default function MesCommandes() {
  const { t, langue } = useI18n();
  const { elements: commandes, chargement, plusDisponible, recharger, chargerPlus } = useListePaginee<CommandeResume>('/commandes');

  useFocusEffect(useCallback(() => { recharger(); }, [recharger]));

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <Text style={styles.titre}>{t('commandes.titre')}</Text>
      <FlatList
        data={commandes}
        keyExtractor={(c) => c.id}
        ListFooterComponent={<ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={<Text style={styles.vide}>{chargement ? t('commun.chargement') : t('commandes.vide')}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/commande/${item.id}`)} accessibilityRole="button">
            <Carte style={styles.ligne}>
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.reference}</Text>
                <Text style={styles.secondaire}>
                  {formatDateHeure(item.createdAt, langue)} · {t(LIBELLE_STATUT_COMMANDE[item.statut])}
                </Text>
              </View>
              <Text style={styles.prix}>{formatFcfa(item.totalFcfa, langue)}</Text>
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
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, paddingHorizontal: espaces.l, paddingBottom: espaces.s },
  liste: { padding: espaces.l, gap: espaces.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  texte: { flex: 1, gap: espaces.xs },
  nom: { fontWeight: '600', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire },
  prix: { color: couleurs.violet, fontWeight: '700' },
  vide: { color: couleurs.texteSecondaire, textAlign: 'center', marginTop: espaces.xl },
});
