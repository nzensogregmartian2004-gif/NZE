import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { useSession } from '../../src/auth/session';
import { Bouton, Champ, Ecran, Message } from '../../src/components/ui';
import { LIBELLE_MOTIF_DEMANDE, MOTIFS_DEMANDE, messageValide, MESSAGE_MINIMUM, type MotifDemande } from '../../src/lib/prestataires';
import { couleurs, espaces, rayons } from '../../src/theme';

interface FicheDetail { id: string; nomPublic: string; activite: string; description: string; zone: string | null }

// Fiche d'un prestataire publicitaire. Pas de réservation : la demande part vers NZE, qui rappelle le client.
export default function FichePrestataire() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { utilisateur } = useSession();
  const [fiche, setFiche] = useState<FicheDetail | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [motif, setMotif] = useState<MotifDemande>('INFORMATION');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    appeler<FicheDetail>(`/prestataires/${id}`, { sansJeton: true })
      .then(setFiche)
      .catch(() => setIntrouvable(true));
  }, [id]);

  const peutDemander = utilisateur?.role === 'client';
  const valide = messageValide(message);

  async function envoyer() {
    if (!valide || envoi || !fiche) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await appeler(`/prestataires/${fiche.id}/demandes`, { methode: 'POST', corps: { motif, message: message.trim() } });
      setEnvoyee(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErreur(t('prestataires.dejaEnCours'));
      else setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {introuvable ? <Message texte={t('prestataires.introuvable')} /> : null}
        {fiche ? (
          <>
            <Text style={styles.titre}>{fiche.nomPublic}</Text>
            <Text style={styles.activite}>{fiche.zone ? `${fiche.activite} · ${fiche.zone}` : fiche.activite}</Text>
            {fiche.description ? <Text style={styles.description}>{fiche.description}</Text> : null}
            <Text style={styles.note}>{t('prestataires.note')}</Text>

            {envoyee ? (
              <Message texte={t('prestataires.envoyee')} type="succes" />
            ) : !peutDemander ? (
              <Text style={styles.note}>{t('prestataires.connexion')}</Text>
            ) : (
              <>
                <Text style={styles.sousTitre}>{t('prestataires.demandeTitre')}</Text>
                <View style={styles.motifs}>
                  {MOTIFS_DEMANDE.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setMotif(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: motif === m }}
                      style={[styles.pilule, motif === m && styles.pileActive]}
                    >
                      <Text style={[styles.pileTexte, motif === m && styles.pileTexteActive]}>{t(LIBELLE_MOTIF_DEMANDE[m])}</Text>
                    </Pressable>
                  ))}
                </View>
                <Champ
                  label={t('prestataires.message')}
                  valeur={message}
                  onChangeTexte={setMessage}
                  placeholder={t('prestataires.messagePlaceholder')}
                  multiligne
                />
                {message.length > 0 && !valide ? <Text style={styles.note}>{t('prestataires.minimum')}</Text> : null}
                {erreur ? <Message texte={erreur} /> : null}
                <Bouton titre={t('prestataires.envoyer')} onPress={envoyer} desactive={!valide || envoi} chargement={envoi} />
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  contenu: { padding: espaces.l, gap: espaces.s },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  activite: { color: couleurs.texteSecondaire },
  description: { color: couleurs.texte, marginTop: espaces.s },
  note: { color: couleurs.texteSecondaire, fontSize: 13, marginTop: espaces.s },
  sousTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte, marginTop: espaces.l },
  motifs: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s, marginBottom: espaces.m },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  pileActive: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  pileTexte: { color: couleurs.texte },
  pileTexteActive: { color: couleurs.violet, fontWeight: '700' },
});
