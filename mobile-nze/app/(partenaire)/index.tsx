import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Carte, Ecran } from '../../src/components/ui';
import { formatDateHeure, formatFcfa } from '../../src/lib/format';
import { couleurs, espaces } from '../../src/theme';

interface Bilan { articles: number; montantFcfa: number }
interface Resume {
  stock: { produits: number; ruptures: number; valeurFcfa: number };
  ventes: { aujourdhui: Bilan; septJours: Bilan };
  collectes: { id: string; numero: number; statut: string; date: string; nombreArticles: number }[];
  argent: { solde: number; disponible: number; enAttente: number };
}
interface TableauLivraisons { livraisonsActives: number; bordereauxAnomalie: number }

export default function TableauPartenaire() {
  const { t, langue } = useI18n();
  const [resume, setResume] = useState<Resume | null>(null);
  const [tableau, setTableau] = useState<TableauLivraisons | null>(null);

  useFocusEffect(useCallback(() => {
    appeler<Resume>('/partenaire/resume').then(setResume).catch(() => setResume(null));
    appeler<TableauLivraisons>('/partenaire/tableau-de-bord').then(setTableau).catch(() => setTableau(null));
  }, []));

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('onglets.tableau')}</Text>

        {resume && (
          <>
            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('dash.stock')}</Text>
              <View style={styles.grille}>
                <View style={styles.cellule}><Text style={styles.chiffre}>{resume.stock.produits}</Text><Text style={styles.legende}>{t('dash.produits')}</Text></View>
                <View style={styles.cellule}><Text style={[styles.chiffre, resume.stock.ruptures > 0 && styles.alerte]}>{resume.stock.ruptures}</Text><Text style={styles.legende}>{t('dash.ruptures')}</Text></View>
              </View>
              <Text style={styles.legende}>{t('dash.valeur')} : {formatFcfa(resume.stock.valeurFcfa, langue)}</Text>
            </Carte>

            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('dash.ventes')}</Text>
              <View style={styles.ligne}>
                <Text style={styles.texte}>{t('dash.aujourdhui')}</Text>
                <Text style={styles.valeur}>{resume.ventes.aujourdhui.articles} {t('dash.articles')} · {formatFcfa(resume.ventes.aujourdhui.montantFcfa, langue)}</Text>
              </View>
              <View style={styles.ligne}>
                <Text style={styles.texte}>{t('dash.septJours')}</Text>
                <Text style={styles.valeur}>{resume.ventes.septJours.articles} {t('dash.articles')} · {formatFcfa(resume.ventes.septJours.montantFcfa, langue)}</Text>
              </View>
            </Carte>

            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('dash.argent')}</Text>
              <View style={styles.ligne}><Text style={styles.texte}>{t('portefeuille.solde')}</Text><Text style={styles.valeur}>{formatFcfa(resume.argent.solde, langue)}</Text></View>
              <View style={styles.ligne}><Text style={styles.texte}>{t('portefeuille.disponible')}</Text><Text style={styles.valeur}>{formatFcfa(resume.argent.disponible, langue)}</Text></View>
              <View style={styles.ligne}><Text style={styles.texte}>{t('portefeuille.enAttente')}</Text><Text style={styles.valeur}>{formatFcfa(resume.argent.enAttente, langue)}</Text></View>
            </Carte>

            <Text style={styles.sousTitre}>{t('dash.collectes')}</Text>
            {resume.collectes.length === 0 && <Text style={styles.legende}>{t('dash.collecteVide')}</Text>}
            {resume.collectes.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/collecte/${c.id}`)} accessibilityRole="button">
                <Carte style={styles.ligne}>
                  <View style={{ gap: espaces.xs }}>
                    <Text style={styles.texte}>{t('dash.collecte')}{c.numero}</Text>
                    <Text style={styles.legende}>{formatDateHeure(c.date, langue)}</Text>
                  </View>
                  <Text style={styles.valeur}>{c.nombreArticles} {t('dash.nombreArticles')}</Text>
                </Carte>
              </Pressable>
            ))}
          </>
        )}

        {tableau && (
          <Carte style={{ gap: espaces.s }}>
            <View style={styles.ligne}><Text style={styles.texte}>{t('dash.livraisons')}</Text><Text style={styles.valeur}>{tableau.livraisonsActives}</Text></View>
            <View style={styles.ligne}><Text style={styles.texte}>{t('dash.anomalies')}</Text><Text style={[styles.valeur, tableau.bordereauxAnomalie > 0 && styles.alerte]}>{tableau.bordereauxAnomalie}</Text></View>
          </Carte>
        )}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  grille: { flexDirection: 'row', gap: espaces.m },
  cellule: { flex: 1, alignItems: 'center', gap: espaces.xs },
  chiffre: { fontSize: 24, fontWeight: '800', color: couleurs.violet },
  alerte: { color: couleurs.danger },
  legende: { color: couleurs.texteSecondaire },
  texte: { color: couleurs.texte },
  valeur: { color: couleurs.violet, fontWeight: '700' },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
