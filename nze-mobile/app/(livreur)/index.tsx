import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Carte, Ecran } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

interface Tableau { aFaire: number; enCours: number; livreesAujourdhui: number; livreesMois: number; partiellesMois: number; echecsMois: number }

export default function TableauLivreur() {
  const { t } = useI18n();
  const [tableau, setTableau] = useState<Tableau | null>(null);
  useFocusEffect(useCallback(() => { appeler<Tableau>('/livreur/tableau-de-bord').then(setTableau).catch(() => setTableau(null)); }, []));
  const cellules: [keyof Tableau, string][] = [
    ['aFaire', 'livreur.aFaire'], ['enCours', 'livreur.enCours'], ['livreesAujourdhui', 'livreur.livreesJour'],
    ['livreesMois', 'livreur.livreesMois'], ['partiellesMois', 'livreur.partiellesMois'], ['echecsMois', 'livreur.echecsMois'],
  ];
  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('livreur.titre')}</Text>
        {tableau && (
          <View style={styles.grille}>
            {cellules.map(([cle, libelle]) => (
              <Carte key={cle} style={styles.cellule}>
                <Text style={styles.chiffre}>{tableau[cle]}</Text>
                <Text style={styles.legende}>{t(libelle as 'livreur.titre')}</Text>
              </Carte>
            ))}
          </View>
        )}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.m },
  cellule: { width: '47%', alignItems: 'center', gap: espaces.xs },
  chiffre: { fontSize: 26, fontWeight: '800', color: couleurs.violet },
  legende: { color: couleurs.texteSecondaire, textAlign: 'center' },
});
