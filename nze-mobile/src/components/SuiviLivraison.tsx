// Suivi de livraison pour le client : barre d'avancement, étape en cours, distance du livreur. Mis à jour toutes les 20 secondes.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appeler } from '../api/client';
import { useI18n } from '../i18n';
import { CLES_SUIVI } from '../lib/suivi-commande';
import { avancement, type LivraisonClient } from '../lib/suivi-livraison';
import { couleurs } from '../theme';

const INTERVALLE_MS = 20000;

export function SuiviLivraison({ commandeId }: { commandeId: string }) {
  const { t } = useI18n();
  const [suivi, setSuivi] = useState<string | null>(null);
  const [livraison, setLivraison] = useState<LivraisonClient | null>(null);

  useEffect(() => {
    let actif = true;
    const charger = () =>
      appeler<{ suivi: string | null; livraison: LivraisonClient | null }>(`/commandes/${commandeId}`)
        .then((d) => {
          if (!actif) return;
          setSuivi(d.suivi);
          setLivraison(d.livraison);
        })
        .catch(() => undefined);
    charger();
    const minuteur = setInterval(charger, INTERVALLE_MS);
    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, [commandeId]);

  if (!suivi) return null;
  const distance = livraison?.distanceRestanteMetres ?? null;
  const fraction = avancement(suivi, distance);

  return (
    <View style={styles.bloc}>
      <Text style={styles.titre}>{t('livraison.suivi.titre')}</Text>
      <View style={styles.piste}>
        <View style={[styles.remplissage, { width: `${Math.round(fraction * 100)}%` }]} />
      </View>
      <Text style={styles.etape}>{t(CLES_SUIVI[suivi])}</Text>
      {suivi === 'EN_LIVRAISON' && distance !== null ? <Text style={styles.detail}>{t('livraison.suivi.distance', { m: distance })}</Text> : null}
      {suivi === 'EN_LIVRAISON' && distance === null ? <Text style={styles.detail}>{t('livraison.suivi.attente')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: couleurs.bordure },
  titre: { fontSize: 15, fontWeight: '700', color: couleurs.texte },
  piste: { height: 10, borderRadius: 5, backgroundColor: couleurs.bordure, overflow: 'hidden' },
  remplissage: { height: 10, backgroundColor: couleurs.violet },
  etape: { fontSize: 14, fontWeight: '600', color: couleurs.violet },
  detail: { fontSize: 13, color: couleurs.texteSecondaire },
});
