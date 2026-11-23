import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

interface Tableau {
  parStatut: Record<string, number>; aReprendre: number; blocagesOuverts: number;
  parLivreur: { livreurId: string; nom: string | null; livreesMois: number; partiellesMois: number; echecsMois: number }[];
}

export default function TableauAdmin() {
  const { t } = useI18n();
  const [tableau, setTableau] = useState<Tableau | null>(null);
  useFocusEffect(useCallback(() => { appeler<Tableau>('/admin/tableau-de-bord').then(setTableau).catch(() => setTableau(null)); }, []));
  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('onglets.tableau')}</Text>
        <Bouton titre={t('admin.reglages')} variante="secondaire" onPress={() => router.push('/(admin)/reglages')} />
        {tableau && (
          <>
            <View style={styles.grille}>
              <Carte style={styles.cellule}><Text style={styles.chiffre}>{tableau.aReprendre}</Text><Text style={styles.legende}>{t('admin.aReprendre')}</Text></Carte>
              <Carte style={styles.cellule}><Text style={styles.chiffre}>{tableau.blocagesOuverts}</Text><Text style={styles.legende}>{t('admin.blocages')}</Text></Carte>
            </View>
            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('admin.parStatut')}</Text>
              {Object.entries(tableau.parStatut).map(([s, n]) => (
                <View key={s} style={styles.ligne}><Text style={styles.legende}>{t(`livreur.statut.${s}` as Cle)}</Text><Text style={styles.valeur}>{n}</Text></View>
              ))}
            </Carte>
            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('admin.parLivreur')}</Text>
              {tableau.parLivreur.map((l) => (
                <View key={l.livreurId} style={styles.ligne}>
                  <Text style={styles.texte}>{l.nom ?? '—'}</Text>
                  <Text style={styles.valeur}>{l.livreesMois} / {l.partiellesMois} / {l.echecsMois}</Text>
                </View>
              ))}
            </Carte>
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  grille: { flexDirection: 'row', gap: espaces.m },
  cellule: { flex: 1, alignItems: 'center', gap: espaces.xs },
  chiffre: { fontSize: 26, fontWeight: '800', color: couleurs.violet },
  legende: { color: couleurs.texteSecondaire, textAlign: 'center' },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  texte: { color: couleurs.texte },
  valeur: { color: couleurs.violet, fontWeight: '700' },
  ligne: { flexDirection: 'row', justifyContent: 'space-between' },
});
