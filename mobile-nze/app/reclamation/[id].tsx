import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, appeler } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { Bouton, Carte, Champ, Ecran, Ligne, Message } from '../../src/components/ui';
import { HistoriqueDossier } from '../../src/components/HistoriqueDossier';
import { formatDateHeure } from '../../src/lib/format';
import { LIBELLE_MOTIF, LIBELLE_SOLUTION, LIBELLE_STATUT, SOLUTION_ARTICLE, estAdministration, type Reclamation } from '../../src/lib/reclamations';
import { couleurs, espaces } from '../../src/theme';

const MINIMUM_MOTIF = 5;

export default function DetailReclamation() {
  const { t, langue } = useI18n();
  const { utilisateur } = useSession();
  const administration = estAdministration(utilisateur?.role);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dossier, setDossier] = useState<Reclamation | null>(null);
  const [erreur, setErreur] = useState(false);
  const [motifRefus, setMotifRefus] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(() => {
    setErreur(false);
    appeler<Reclamation>(`/reclamations/${id}`)
      .then(setDossier)
      .catch(() => {
        setDossier(null);
        setErreur(true);
      });
  }, [id]);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function agir(chemin: string, corps?: unknown) {
    setOccupe(true);
    setMessage(null);
    try {
      await appeler(chemin, { methode: 'POST', corps });
      setMotifRefus('');
      charger();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setOccupe(false);
    }
  }

  const accepter = () => agir(`/admin/reclamations/${id}/decision`, { decision: 'ACCEPTER', solution: SOLUTION_ARTICLE });
  const refuser = () => agir(`/admin/reclamations/${id}/decision`, { decision: 'REFUSER', motif: motifRefus.trim() });
  const cloturer = () => agir(`/admin/reclamations/${id}/cloture`);

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        {erreur ? <Message texte={t('reclamation.erreur')} /> : null}
        {dossier ? (
          <>
            <Text style={styles.titre}>{dossier.reference}</Text>

            <Carte style={styles.bloc}>
              <Ligne libelle={t('reclamation.champ.statut')} valeur={t(LIBELLE_STATUT[dossier.statut])} />
              <Ligne libelle={t('reclamation.champ.article')} valeur={dossier.nomArticle} />
              <Ligne libelle={t('reclamation.champ.motif')} valeur={t(LIBELLE_MOTIF[dossier.motif])} />
              <Text style={styles.label}>{t('reclamation.champ.description')}</Text>
              <Text style={styles.texte}>{dossier.description}</Text>
              {dossier.statut === 'OUVERTE' ? (
                <Ligne libelle={t('reclamation.champ.echeance')} valeur={formatDateHeure(dossier.echeanceDecisionLe, langue)} />
              ) : null}
              {dossier.enRetard && dossier.statut === 'OUVERTE' ? (
                <Text style={styles.alerte}>{t('reclamation.enRetard')}</Text>
              ) : null}
              {dossier.solution ? (
                <Ligne libelle={t('reclamation.champ.solution')} valeur={LIBELLE_SOLUTION[dossier.solution] ? t(LIBELLE_SOLUTION[dossier.solution]) : dossier.solution} />
              ) : null}
              {dossier.motifDecision ? (
                <Ligne libelle={t('reclamation.champ.motifDecision')} valeur={dossier.motifDecision} />
              ) : null}
              {dossier.decideLe ? (
                <Ligne libelle={t('reclamation.champ.decideLe')} valeur={formatDateHeure(dossier.decideLe, langue)} />
              ) : null}
            </Carte>

            {administration && dossier.client ? (
              <Carte style={styles.bloc}>
                <Ligne libelle={t('reclamation.champ.client')} valeur={dossier.client.nom ?? '—'} />
                <Ligne libelle={t('reclamation.champ.telephone')} valeur={dossier.client.telephone} />
              </Carte>
            ) : null}

            {dossier.statut === 'ACCEPTEE' ? <Text style={styles.info}>{t('reclamation.info.acceptee')}</Text> : null}
            {dossier.statut === 'REFUSEE' ? <Text style={styles.info}>{t('reclamation.info.refusee')}</Text> : null}
            {dossier.statut === 'CLOTUREE' ? <Text style={styles.info}>{t('reclamation.info.cloturee')}</Text> : null}

            {administration && dossier.statut === 'OUVERTE' ? (
              <Carte style={styles.bloc}>
                <Text style={styles.sousTitre}>{t('reclamation.admin.decision')}</Text>
                <Bouton titre={t('reclamation.admin.accepter')} onPress={accepter} desactive={occupe} chargement={occupe} />
                <Champ
                  label={t('reclamation.admin.motifRefus')}
                  valeur={motifRefus}
                  onChangeTexte={setMotifRefus}
                  multiligne
                />
                <Bouton
                  titre={t('reclamation.admin.refuser')}
                  variante="danger"
                  onPress={refuser}
                  desactive={occupe || motifRefus.trim().length < MINIMUM_MOTIF}
                />
              </Carte>
            ) : null}

            {administration && dossier.statut === 'ACCEPTEE' ? (
              <Bouton titre={t('reclamation.admin.cloturer')} variante="secondaire" onPress={cloturer} desactive={occupe} chargement={occupe} />
            ) : null}

            {message ? <Message texte={message} /> : null}
            {administration ? <HistoriqueDossier reclamationId={dossier.id} /> : null}
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
  bloc: { gap: espaces.s },
  sousTitre: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  label: { fontSize: 13, color: couleurs.texteSecondaire },
  texte: { color: couleurs.texte, lineHeight: 20 },
  alerte: { color: couleurs.danger, fontWeight: '600' },
  info: { color: couleurs.texteSecondaire, lineHeight: 20 },
});
