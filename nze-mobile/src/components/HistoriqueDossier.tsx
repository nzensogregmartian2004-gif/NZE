import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appeler } from '../api/client';
import { useI18n } from '../i18n';
import type { Cle } from '../i18n/dictionnaire';
import { formatDateHeure } from '../lib/format';
import { cleAction, resumeDetails, type EntreeHistorique } from '../lib/historique-reclamation';
import { Carte } from './ui';
import { couleurs, espaces } from '../theme';

// Historique d'un dossier : toutes les actions journalisées (création, notes, décision, clôture, alerte).
export function HistoriqueDossier({ reclamationId }: { reclamationId: string }) {
  const { t, langue } = useI18n();
  const [entrees, setEntrees] = useState<EntreeHistorique[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    appeler<EntreeHistorique[]>(`/admin/reclamations/${reclamationId}/historique`)
      .then((liste) => { if (actif) setEntrees(liste); })
      .catch(() => { if (actif) setErreur(true); });
    return () => { actif = false; };
  }, [reclamationId]);

  return (
    <Carte>
      <Text style={styles.titre}>{t('historique.titre')}</Text>
      {erreur ? <Text style={styles.vide}>{t('historique.erreur')}</Text> : null}
      {entrees && entrees.length === 0 ? <Text style={styles.vide}>{t('historique.vide')}</Text> : null}
      {entrees?.map((e) => {
        const texte = resumeDetails(e.details);
        return (
          <View key={e.id} style={styles.entree}>
            <Text style={styles.action}>{t(cleAction(e.action) as Cle)}</Text>
            <Text style={styles.detail}>{formatDateHeure(e.creeLe, langue)} · {e.acteurNom ?? t('historique.systeme')}</Text>
            {texte ? <Text style={styles.texte}>{texte}</Text> : null}
          </View>
        );
      })}
    </Carte>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
  vide: { color: couleurs.texteSecondaire },
  entree: { gap: espaces.xs, paddingVertical: espaces.s, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  action: { fontWeight: '600', color: couleurs.texte },
  detail: { color: couleurs.texteSecondaire, fontSize: 12 },
  texte: { color: couleurs.texte },
});
