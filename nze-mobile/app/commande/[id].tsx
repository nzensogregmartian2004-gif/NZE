import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { LIBELLE_STATUT_COMMANDE } from '../../src/lib/reclamations';
import { CLES_SUIVI } from '../../src/lib/suivi-commande';
import { SuiviLivraison } from '../../src/components/SuiviLivraison';
import { couleurs, espaces } from '../../src/theme';

interface LigneCommande {
  id: string;
  nomArticle: string;
  quantite: number;
  montantLigneFcfa: number;
  livree: boolean;
  reclamationEnCours: boolean;
}

interface Commande {
  id: string;
  reference: string;
  statut: string;
  suivi?: string | null;
  echelonnementId?: string | null;
  sousTotalFcfa: number;
  fraisLivraisonFcfa: number;
  totalFcfa: number;
  lignes: LigneCommande[];
}

export default function DetailCommande() {
  const { t, langue } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [commande, setCommande] = useState<Commande | null>(null);
  const [erreur, setErreur] = useState(false);

  useFocusEffect(useCallback(() => {
    setErreur(false);
    appeler<Commande>(`/commandes/${id}`).then(setCommande).catch(() => {
      setCommande(null);
      setErreur(true);
    });
  }, [id]));

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        {erreur ? <Message texte={t('commande.erreur')} /> : null}
        {commande ? (
          <>
            <Text style={styles.titre}>{commande.reference}</Text>
            <Text style={styles.secondaire}>{t(LIBELLE_STATUT_COMMANDE[commande.statut])}</Text>
            {commande.suivi ? <Text style={styles.secondaire}>{t(CLES_SUIVI[commande.suivi])}</Text> : null}
            {commande.statut === 'PAYEE' ? <SuiviLivraison commandeId={String(id)} /> : null}
            {commande.echelonnementId ? (
              <Pressable onPress={() => router.push(`/echeancier/${commande.echelonnementId}`)} style={{ paddingVertical: 8 }}>
                <Text style={styles.secondaire}>{t('echeancier.voir')}</Text>
              </Pressable>
            ) : null}

            <Text style={styles.sousTitre}>{t('commande.lignes')}</Text>
            {commande.lignes.map((l) => (
              <Carte key={l.id} style={styles.ligne}>
                <Text style={styles.nom}>{l.nomArticle} × {l.quantite}</Text>
                <Text style={styles.secondaire}>{formatFcfa(l.montantLigneFcfa, langue)}</Text>
                <Text style={[styles.etat, l.livree && styles.etatRecu]}>
                  {l.livree ? t('commande.ligne.remise') : t('commande.ligne.aRecevoir')}
                </Text>
                {l.reclamationEnCours ? (
                  <Text style={styles.secondaire}>{t('commande.ligne.enCours')}</Text>
                ) : l.livree ? (
                  <Bouton
                    titre={t('commande.signaler')}
                    variante="secondaire"
                    onPress={() => router.push({ pathname: '/reclamation/nouvelle', params: { ligneId: l.id, nom: l.nomArticle } })}
                  />
                ) : null}
              </Carte>
            ))}

            <Carte style={styles.totaux}>
              <View style={styles.ligneTotal}>
                <Text style={styles.secondaire}>{t('commande.frais')}</Text>
                <Text style={styles.secondaire}>{formatFcfa(commande.fraisLivraisonFcfa, langue)}</Text>
              </View>
              <View style={styles.ligneTotal}>
                <Text style={styles.nom}>{t('commande.total')}</Text>
                <Text style={styles.prix}>{formatFcfa(commande.totalFcfa, langue)}</Text>
              </View>
            </Carte>

            <Text style={styles.aide}>{t('commande.aide')}</Text>
          </>
        ) : null}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontSize: 15, fontWeight: '600', color: couleurs.texte, marginTop: espaces.s },
  secondaire: { color: couleurs.texteSecondaire },
  nom: { fontWeight: '600', color: couleurs.texte },
  prix: { color: couleurs.violet, fontWeight: '700' },
  ligne: { gap: espaces.s },
  etat: { color: couleurs.texteSecondaire, fontWeight: '600' },
  etatRecu: { color: couleurs.succes },
  totaux: { gap: espaces.s },
  ligneTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aide: { color: couleurs.texteSecondaire, fontSize: 13, lineHeight: 19 },
});
