import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../src/i18n';
import { Carte, Ecran } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Commande { id: string; reference: string; statut: string; reception: string; totalFcfa: number; createdAt: string }
const FILTRES = ['', 'PAYEE', 'PANIER', 'ANNULEE'] as const;

export default function CommandesAdmin() {
  const { t, langue } = useI18n();
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]>('');
  const { elements: liste, recharger, chargerPlus, plusDisponible, chargement } = useListePaginee<Commande>(filtre ? `/admin/commandes?statut=${filtre}` : '/admin/commandes');
  useFocusEffect(useCallback(() => { recharger(); }, [recharger]));
  return (
    <Ecran>
      <Text style={styles.titre}>{t('admin.commandesTitre')}</Text>
      <View style={styles.filtres}>
        {FILTRES.map((f) => (
          <Pressable key={f || 'tous'} onPress={() => setFiltre(f)} style={[styles.pilule, filtre === f && styles.actif]} accessibilityRole="radio">
            <Text style={[styles.pilulesTexte, filtre === f && styles.actifTexte]}>{f || t('admin.tous')}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={liste}
        keyExtractor={(c) => c.id}
        ListFooterComponent={<ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={<Text style={styles.vide}>{t('admin.vide')}</Text>}
        renderItem={({ item }) => (
          <Carte style={styles.ligne}>
            <View style={{ flex: 1, gap: espaces.xs }}>
              <Text style={styles.nom}>{item.reference}</Text>
              <Text style={styles.secondaire}>{item.statut} · {item.reception}</Text>
            </View>
            <Text style={styles.prix}>{formatFcfa(item.totalFcfa, langue)}</Text>
          </Carte>
        )}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, padding: espaces.l },
  filtres: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s, paddingHorizontal: espaces.l },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  actif: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  pilulesTexte: { color: couleurs.texte },
  actifTexte: { color: couleurs.violet, fontWeight: '700' },
  liste: { padding: espaces.l, gap: espaces.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  nom: { fontWeight: '600', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire },
  prix: { color: couleurs.violet, fontWeight: '700' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
