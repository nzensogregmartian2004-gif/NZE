import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Carte, Ecran } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces } from '../../src/theme';

interface Vente {
  id: string; commandeReference: string; dateCommande: string; articles: { nom: string; quantite: number }[];
  statut: string; totalFcfa: number; commercantTotalFcfa: number; commercantEncaisseFcfa: number; commercantAVerserFcfa: number;
  enRetard: boolean; encaissements: { type: string; montantFcfa: number; partCommercantFcfa: number | null; encaisseLe: string | null }[];
}

export default function VentesEchelonneesPartenaire() {
  const { t, langue } = useI18n();
  const [ventes, setVentes] = useState<Vente[]>([]);
  const charger = useCallback(() => {
    appeler<Vente[]>('/partenaire/echelonnements').then(setVentes).catch(() => setVentes([]));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titrePage}>{t('commercant.echelon.titre')}</Text>
        {ventes.length === 0 ? <Text style={styles.texteSecondaire}>{t('commercant.echelon.vide')}</Text> : null}
        {ventes.map((v) => (
          <Carte key={v.id}>
            <Text style={styles.titre}>{t('commercant.echelon.commande')} {v.commandeReference}{v.enRetard ? ' · ⚠ ' + t('commercant.echelon.retard') : ''}</Text>
            <Text style={styles.ligne}>{v.articles.map((a) => `${a.quantite} × ${a.nom}`).join(', ')}</Text>
            <Text style={styles.ligne}>{t('commercant.echelon.part')} : {formatFcfa(v.commercantTotalFcfa, langue)}</Text>
            <Text style={styles.ligne}>{t('commercant.echelon.encaisse')} : {formatFcfa(v.commercantEncaisseFcfa, langue)}</Text>
            <Text style={styles.ligne}>{t('commercant.echelon.aVerser')} : {formatFcfa(v.commercantAVerserFcfa, langue)}</Text>
            <Text style={styles.sousTitre}>{t('commercant.echelon.encaissements')}</Text>
            {v.encaissements.map((e, i) => (
              <Text key={i} style={styles.texteSecondaire}>
                {formatFcfa(e.montantFcfa, langue)} · {t('commercant.echelon.encaisse')} {formatFcfa(e.partCommercantFcfa ?? 0, langue)}
                {e.encaisseLe ? ' · ' + new Date(e.encaisseLe).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
              </Text>
            ))}
          </Carte>
        ))}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.m, gap: espaces.m },
  titrePage: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  titre: { fontWeight: '600', color: couleurs.texte, fontSize: 16 },
  sousTitre: { fontWeight: '600', color: couleurs.texte, marginTop: espaces.s },
  ligne: { color: couleurs.texte },
  texteSecondaire: { color: couleurs.texteSecondaire },
});
