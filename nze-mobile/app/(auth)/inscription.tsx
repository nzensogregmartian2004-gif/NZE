// Inscription sur une seule page : identité, date de naissance, téléphone, mot de passe, et acceptation des conditions.
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { Bouton, Champ, Ecran, Message } from '../../src/components/ui';
import { dateNaissanceValide } from '../../src/lib/inscription';
import { couleurs, espaces } from '../../src/theme';

export default function Inscription() {
  const { t, langue } = useI18n();
  const { ouvrirSession } = useSession();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [telephone, setTelephone] = useState('+241');
  const [motDePasse, setMotDePasse] = useState('');
  const [accepte, setAccepte] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const dateOk = dateNaissanceValide(dateNaissance);
  const formulaireComplet = prenom.trim() !== '' && nom.trim() !== '' && dateOk && telephone !== '' && motDePasse.length >= 8 && accepte;

  async function soumettre() {
    setErreur(null);
    setChargement(true);
    try {
      const r = await appeler<{ token: string; utilisateur: { id: string; role: string; telephone?: string } }>('/auth/inscription', {
        methode: 'POST',
        corps: { telephone, motDePasse, prenom: prenom.trim(), nom: nom.trim(), dateNaissance, accepteConditions: true, langue },
        sansJeton: true,
      });
      await ouvrirSession(r);
      router.replace('/');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setChargement(false);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.titre}>{t('inscription.titre')}</Text>
        {erreur && <Message texte={erreur} />}
        <Champ label={t('inscription.prenom')} valeur={prenom} onChangeTexte={setPrenom} />
        <Champ label={t('inscription.nom')} valeur={nom} onChangeTexte={setNom} />
        <Champ label={t('inscription.dateNaissance')} valeur={dateNaissance} onChangeTexte={setDateNaissance} />
        {dateNaissance.length > 0 && !dateOk && <Text style={styles.avertissement}>{t('inscription.dateInvalide')}</Text>}
        <Champ label={t('connexion.telephone')} valeur={telephone} onChangeTexte={setTelephone} clavier="phone-pad" auto="username" />
        <Champ label={t('connexion.motDePasse')} valeur={motDePasse} onChangeTexte={setMotDePasse} secret />

        <Pressable onPress={() => setAccepte(!accepte)} accessibilityRole="checkbox" accessibilityState={{ checked: accepte }} style={styles.ligneAcceptation}>
          <View style={[styles.case, accepte && styles.caseCochee]}>
            {accepte ? <Text style={styles.coche}>✓</Text> : null}
          </View>
          <Text style={styles.texteAcceptation}>{t('inscription.accepteConditions')}</Text>
        </Pressable>
        <Text style={styles.lien} onPress={() => router.push('/legal/cgu')}>{t('inscription.lireConditions')}</Text>

        <Bouton titre={t('inscription.bouton')} onPress={soumettre} chargement={chargement} desactive={!formulaireComplet || chargement} />
        <Text style={styles.lien} onPress={() => router.back()}>{t('inscription.dejaCompte')}</Text>
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: espaces.s },
  avertissement: { color: couleurs.danger, fontSize: 13 },
  ligneAcceptation: { flexDirection: 'row', alignItems: 'center', gap: espaces.s, marginTop: espaces.s },
  case: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: couleurs.bordure, alignItems: 'center', justifyContent: 'center' },
  caseCochee: { backgroundColor: couleurs.violet, borderColor: couleurs.violet },
  coche: { color: '#fff', fontWeight: '700' },
  texteAcceptation: { flex: 1, color: couleurs.texte, fontSize: 14 },
  lien: { color: couleurs.violet, textAlign: 'center', fontWeight: '600' },
});
