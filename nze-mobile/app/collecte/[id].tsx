import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Carte, Ecran } from '../../src/components/ui';
import { formatDateHeure } from '../../src/lib/format';
import { couleurs, espaces } from '../../src/theme';

interface LigneCollecte { id: string; nomArticle: string; quantite: number; etat: string; controle: string; bloqueLivraison: boolean }
interface Collecte { id: string; reference: string; statut: string; createdAt: string; commentaire?: string | null; partenaireConfirmeLe?: string | null; contesteLe?: string | null; motifContestation?: string | null; valideLe?: string | null; motifRefus?: string | null; lignes: LigneCollecte[] }

export default function DetailCollecte() {
  const { t, langue } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [collecte, setCollecte] = useState<Collecte | null>(null);
  const [motif, setMotif] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const charger = useCallback(() => appeler<Collecte>(`/bordereaux/${id}`).then(setCollecte).catch(() => setCollecte(null)), [id]);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  const libelleStatut = (statut: string) => {
    switch (statut) {
      case 'ATTENTE_PARTENAIRE': return t('collecte.statut.ATTENTE_PARTENAIRE');
      case 'ATTENTE_VALIDATION_NZE': return t('collecte.statut.ATTENTE_VALIDATION_NZE');
      case 'CONTESTE': return t('collecte.statut.CONTESTE');
      case 'VALIDE': return t('collecte.statut.VALIDE');
      case 'REFUSE': return t('collecte.statut.REFUSE');
      case 'ANNULE': return t('collecte.statut.ANNULE');
      default: return statut;
    }
  };

  const repondre = async (confirmer: boolean) => {
    if (!confirmer && motif.trim().length < 5) { setErreur(t('collecteDetail.motifMin')); return; }
    setChargement(true); setErreur('');
    try {
      await appeler(`/partenaire/bordereaux/${id}/reponse`, { methode: 'POST', corps: confirmer ? { confirmer: true } : { confirmer: false, motif: motif.trim() } });
      setMotif('');
      await charger();
    } catch (e) { setErreur(e instanceof Error ? e.message : t('commun.erreurGenerale')); }
    finally { setChargement(false); }
  };

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      {!collecte ? (
        <Text style={styles.legende}>{t('commun.chargement')}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.contenu}>
          <Text style={styles.titre}>{t('collecte.titre')} {collecte.reference}</Text>
          <Text style={styles.legende}>{t('collecte.date')} : {formatDateHeure(collecte.createdAt, langue)}</Text>
          <Carte style={{ gap: espaces.xs }}>
            <Text style={styles.sousTitre}>{t('collecte.statut')}: {libelleStatut(collecte.statut)}</Text>
            {collecte.partenaireConfirmeLe && <Text style={styles.legende}>{t('collecte.confirmee')}</Text>}
            {collecte.contesteLe && <Text style={styles.alerte}>{t('collecte.contestee')}: {collecte.motifContestation}</Text>}
            {collecte.valideLe && <Text style={styles.legende}>{t('collecte.validee')}</Text>}
            {collecte.motifRefus && <Text style={styles.alerte}>{t('collecte.refusee')}: {collecte.motifRefus}</Text>}
          </Carte>
          {collecte.statut === 'ATTENTE_PARTENAIRE' && (
            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('collecte.confirmationTitre')}</Text>
              <Text style={styles.legende}>{t('collecte.confirmationTexte')}</Text>
              <Pressable disabled={chargement} onPress={() => repondre(true)} style={[styles.bouton, chargement && styles.boutonDesactive]}>
                {chargement ? <ActivityIndicator color="white" /> : <Text style={styles.boutonTexte}>{t('collecte.confirmer')}</Text>}
              </Pressable>
              <TextInput value={motif} onChangeText={setMotif} placeholder={t('collecte.motifPlaceholder')} multiline style={styles.champ} />
              <Pressable disabled={chargement} onPress={() => repondre(false)} style={[styles.boutonSecondaire, chargement && styles.boutonDesactive]}>
                <Text style={styles.boutonSecondaireTexte}>{t('collecte.signalerErreur')}</Text>
              </Pressable>
              {!!erreur && <Text style={styles.alerte}>{erreur}</Text>}
            </Carte>
          )}
          <Text style={styles.sousTitre}>{t('collecte.articles')}</Text>
          {collecte.lignes.map((l) => (
            <Carte key={l.id} style={{ gap: espaces.xs }}>
              <Text style={styles.titreLigne}>{l.nomArticle} · {t('collecte.quantite')} {l.quantite}</Text>
              <Text style={styles.legende}>{t('collecte.etat')} : {l.etat}</Text>
              <Text style={styles.legende}>{t('collecte.controle')} : {l.controle}</Text>
              {l.bloqueLivraison && <Text style={styles.alerte}>{t('collecte.bloque')}</Text>}
            </Carte>
          ))}
        </ScrollView>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  titreLigne: { fontWeight: '600', color: couleurs.texte },
  legende: { color: couleurs.texteSecondaire },
  alerte: { color: couleurs.danger, fontWeight: '600' },
  bouton: { backgroundColor: couleurs.violet, borderRadius: 10, padding: espaces.m, alignItems: 'center' },
  boutonTexte: { color: 'white', fontWeight: '700' },
  boutonSecondaire: { borderColor: couleurs.danger, borderWidth: 1, borderRadius: 10, padding: espaces.m, alignItems: 'center' },
  boutonSecondaireTexte: { color: couleurs.danger, fontWeight: '700' },
  boutonDesactive: { opacity: 0.5 },
  champ: { borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 10, minHeight: 76, padding: espaces.m, color: couleurs.texte, textAlignVertical: 'top' },
});
