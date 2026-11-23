import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Champ, Ecran, Message } from '../../src/components/ui';
import { LIBELLE_MOTIF, MOTIFS, type Motif, type Reclamation } from '../../src/lib/reclamations';
import { couleurs, espaces, rayons } from '../../src/theme';

const MINIMUM_CARACTERES = 10;

export default function NouvelleReclamation() {
  const { t } = useI18n();
  const { ligneId, nom } = useLocalSearchParams<{ ligneId: string; nom: string }>();
  const [motif, setMotif] = useState<Motif>('ARTICLE_DEFECTUEUX');
  const [description, setDescription] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valide = description.trim().length >= MINIMUM_CARACTERES && !!ligneId;

  async function envoyer() {
    if (!valide || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const reclamation = await appeler<Reclamation>('/reclamations', {
        methode: 'POST',
        corps: { ligneCommandeId: ligneId, motif, description: description.trim() },
      });
      router.replace(`/reclamation/${reclamation.id}`);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
      setEnvoi(false);
    }
  }

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.titre}>{t('reclamation.nouvelle.titre')}</Text>
        {nom ? <Text style={styles.article}>{nom}</Text> : null}

        <Text style={styles.label}>{t('reclamation.nouvelle.motif')}</Text>
        <View style={styles.motifs}>
          {MOTIFS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMotif(m)}
              accessibilityRole="radio"
              accessibilityState={{ selected: motif === m }}
              style={[styles.pilule, motif === m && styles.pileActive]}
            >
              <Text style={[styles.pileTexte, motif === m && styles.pileTexteActive]}>{t(LIBELLE_MOTIF[m])}</Text>
            </Pressable>
          ))}
        </View>

        <Champ
          label={t('reclamation.nouvelle.description')}
          valeur={description}
          onChangeTexte={setDescription}
          placeholder={t('reclamation.nouvelle.placeholder')}
          multiligne
        />
        {description.length > 0 && description.trim().length < MINIMUM_CARACTERES ? (
          <Text style={styles.secondaire}>{t('reclamation.nouvelle.minimum')}</Text>
        ) : null}
        <Text style={styles.secondaire}>{t('reclamation.nouvelle.delai')}</Text>

        {erreur ? <Message texte={erreur} /> : null}
        <Bouton titre={t('reclamation.nouvelle.envoyer')} onPress={envoyer} desactive={!valide} chargement={envoi} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  contenu: { padding: espaces.l, gap: espaces.s },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  article: { fontSize: 15, fontWeight: '600', color: couleurs.texte, marginBottom: espaces.s },
  label: { fontSize: 13, color: couleurs.texteSecondaire },
  motifs: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s, marginBottom: espaces.m },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  pileActive: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  pileTexte: { color: couleurs.texte },
  pileTexteActive: { color: couleurs.violet, fontWeight: '700' },
  secondaire: { color: couleurs.texteSecondaire, fontSize: 13, lineHeight: 19, marginBottom: espaces.m },
});
