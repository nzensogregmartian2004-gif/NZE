import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../src/i18n';
import { Carte, Ecran } from '../../src/components/ui';
import { formatDateHeure } from '../../src/lib/format';
import { LIBELLE_STATUT, STATUTS, type Reclamation, type Statut } from '../../src/lib/reclamations';
import { couleurs, espaces, rayons } from '../../src/theme';

type Filtre = 'TOUTES' | 'RETARD' | Statut;
const FILTRES: Filtre[] = ['TOUTES', 'RETARD', ...STATUTS];

function cheminDe(filtre: Filtre): string {
  if (filtre === 'TOUTES') return '/reclamations';
  if (filtre === 'RETARD') return '/reclamations?enRetard=true';
  return `/reclamations?statut=${filtre}`;
}

export default function ReclamationsAdmin() {
  const { t, langue } = useI18n();
  const [filtre, setFiltre] = useState<Filtre>('OUVERTE');
  const { elements: dossiers, erreur, plusDisponible, chargement, recharger, chargerPlus } = useListePaginee<Reclamation>(cheminDe(filtre));

  useFocusEffect(useCallback(() => { recharger(); }, [recharger]));

  const libelleFiltre = (f: Filtre) =>
    f === 'TOUTES' ? t('reclamation.admin.filtreTout') : f === 'RETARD' ? t('reclamation.admin.filtreRetard') : t(LIBELLE_STATUT[f]);

  return (
    <Ecran>
      <Text style={styles.titre}>{t('onglets.reclamations')}</Text>
      <View style={styles.filtres}>
        {FILTRES.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFiltre(f)}
            accessibilityRole="radio"
            accessibilityState={{ selected: filtre === f }}
            style={[styles.pilule, filtre === f && styles.actif]}
          >
            <Text style={[styles.pilulesTexte, filtre === f && styles.actifTexte]}>{libelleFiltre(f)}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={dossiers}
        keyExtractor={(d) => d.id}
        ListFooterComponent={<ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={<Text style={styles.vide}>{erreur ? t('reclamation.erreur') : t('reclamation.admin.vide')}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/reclamation/${item.id}`)} accessibilityRole="button">
            <Carte style={styles.ligne}>
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.reference} · {item.nomArticle}</Text>
                <Text style={styles.secondaire}>
                  {item.client ? (item.client.nom ?? item.client.telephone) : '—'} · {formatDateHeure(item.createdAt, langue)}
                </Text>
                {item.enRetard && item.statut === 'OUVERTE' ? <Text style={styles.alerte}>{t('reclamation.enRetard')}</Text> : null}
              </View>
              <Text style={styles.statut}>{t(LIBELLE_STATUT[item.statut])}</Text>
            </Carte>
          </Pressable>
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
  texte: { flex: 1, gap: espaces.xs },
  nom: { fontWeight: '600', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire, fontSize: 13 },
  alerte: { color: couleurs.danger, fontSize: 13, fontWeight: '600' },
  statut: { color: couleurs.violet, fontWeight: '700', fontSize: 13 },
  vide: { color: couleurs.texteSecondaire, textAlign: 'center', marginTop: espaces.xl },
});
