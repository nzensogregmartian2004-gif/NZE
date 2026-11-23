import { useListePaginee } from '../src/lib/use-liste-paginee';
import { ChargerPlus } from '../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../src/i18n';
import { Carte, Ecran } from '../src/components/ui';
import { formatDateHeure } from '../src/lib/format';
import { LIBELLE_STATUT, type Reclamation } from '../src/lib/reclamations';
import { couleurs, espaces } from '../src/theme';

export default function MesReclamations() {
  const { t, langue } = useI18n();
  const { elements: dossiers, chargement, erreur, plusDisponible, recharger, chargerPlus } = useListePaginee<Reclamation>('/reclamations');

  useFocusEffect(useCallback(() => { recharger(); }, [recharger]));

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <Text style={styles.titre}>{t('reclamation.liste.titre')}</Text>
      <FlatList
        data={dossiers}
        keyExtractor={(d) => d.id}
        ListFooterComponent={<ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          <Text style={styles.vide}>
            {erreur ? t('reclamation.erreur') : chargement ? t('commun.chargement') : t('reclamation.liste.vide')}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/reclamation/${item.id}`)} accessibilityRole="button">
            <Carte style={styles.ligne}>
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.nomArticle}</Text>
                <Text style={styles.secondaire}>{item.reference} · {formatDateHeure(item.createdAt, langue)}</Text>
                {item.enRetard && item.statut === 'OUVERTE' ? <Text style={styles.alerte}>{t('reclamation.enRetard')}</Text> : null}
              </View>
              <Text style={[styles.statut, item.statut === 'ACCEPTEE' && styles.statutAcceptee]}>{t(LIBELLE_STATUT[item.statut])}</Text>
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
  secondaire: { color: couleurs.texteSecondaire, fontSize: 13 },
  alerte: { color: couleurs.danger, fontSize: 13, fontWeight: '600' },
  statut: { color: couleurs.violet, fontWeight: '700', fontSize: 13 },
  statutAcceptee: { color: couleurs.succes },
  vide: { color: couleurs.texteSecondaire, textAlign: 'center', marginTop: espaces.xl },
});
