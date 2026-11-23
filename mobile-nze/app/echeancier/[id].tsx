// Échéancier du client : mois par mois pour chaque article, avec les pénalités. Lecture seule.
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { formatDateHeure } from '../../src/lib/format';
import { CLES_STATUT_MOIS, type Echeancier } from '../../src/lib/echeancier';
import { couleurs } from '../../src/theme';

export default function EcheancierClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, langue } = useI18n();
  const [donnees, setDonnees] = useState<Echeancier | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    appeler<Echeancier>(`/echelonnements/${id}/echeanciers`)
      .then(setDonnees)
      .catch(() => setErreur(true));
  }, [id]);

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('echeancier.titre')}</Text>
        <Bouton titre={t('echeancier.payer.bouton')} onPress={() => router.push(`/echeancier/payer/${id}`)} />
        {erreur && <Message texte={t('echeancier.erreur')} />}
        {donnees?.articles.map((a) => (
          <Carte key={a.echeancierId} style={styles.bloc}>
            <Text style={styles.principal}>{t('echeancier.article', { nom: a.nom, duree: a.dureeMois })}</Text>
            {a.mois.map((m) => (
              <View key={m.numero} style={styles.mois}>
                <Text style={styles.principal}>
                  {t('echeancier.mois', { n: m.numero })} · {formatDateHeure(m.dateLimite, langue)}
                </Text>
                <Text style={styles.secondaire}>
                  {t('echeancier.resteMois', { m: m.resteDuFcfa, total: m.montantDuFcfa })}
                </Text>
                <Text style={styles.statut}>{t(CLES_STATUT_MOIS[m.statut])}</Text>
              </View>
            ))}
            {a.penalites.map((p) => (
              <Text key={p.moisRetard} style={styles.penalite}>
                {t('echeancier.penalite', { n: p.moisRetard, m: p.montantFcfa, r: p.resteFcfa })}
              </Text>
            ))}
          </Carte>
        ))}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, gap: 12 },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  bloc: { gap: 8 },
  mois: { gap: 2, paddingVertical: 6 },
  principal: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  secondaire: { fontSize: 13, color: couleurs.texteSecondaire },
  statut: { fontSize: 13, fontWeight: '700', color: couleurs.violet },
  penalite: { fontSize: 13, fontWeight: '600', color: couleurs.danger },
});
