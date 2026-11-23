import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { appeler } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { LANGUES, type Langue } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran } from '../../src/components/ui';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Profil { id: string; telephone: string; role: string; nomAffiche: string | null; langue: Langue }

export default function Profil() {
  const { t, langue, setLangue } = useI18n();
  const { deconnecter } = useSession();
  const [profil, setProfil] = useState<Profil | null>(null);

  useEffect(() => {
    appeler<Profil>('/profil').then((p) => {
      setProfil(p);
      if (p.langue !== langue) setLangue(p.langue);
    }).catch(() => setProfil(null));
    // Chargement initial uniquement : la langue du profil est appliquée une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choisirLangue(l: Langue) {
    await setLangue(l);
    await appeler('/profil', { methode: 'PATCH', corps: { langue: l } }).catch(() => undefined);
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('profil.titre')}</Text>
        <Carte style={styles.bloc}>
          <Text style={styles.nom}>{profil?.nomAffiche ?? '—'}</Text>
          <Text style={styles.secondaire}>{t('profil.telephone')} : {profil?.telephone ?? '—'}</Text>
        </Carte>
        <Carte style={styles.bloc}>
          <Text style={styles.sousTitre}>{t('profil.langue')}</Text>
          {LANGUES.map((l) => (
            <Pressable key={l} onPress={() => choisirLangue(l)} style={[styles.langue, langue === l && styles.langueActive]} accessibilityRole="button">
              <Text style={[styles.langueTexte, langue === l && styles.langueTexteActive]}>{t(`langue.${l}` as 'langue.fr')}</Text>
            </Pressable>
          ))}
          <Text style={styles.note}>{langue === 'ar' ? t('profil.rtlNote') : ''}</Text>
        </Carte>
        <Carte style={styles.bloc}>
          <Pressable onPress={() => router.push('/adresses')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('profil.adresses')}</Text></Pressable>
          <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('notifications.titre')}</Text></Pressable>
          <Pressable onPress={() => router.push('/listes')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('profil.listes')}</Text></Pressable>
          <Pressable onPress={() => router.push('/mes-commandes')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('profil.commandes')}</Text></Pressable>
          <Pressable onPress={() => router.push('/mes-reclamations')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('profil.reclamations')}</Text></Pressable>
          <Pressable onPress={() => router.push('/(tabs)/messages')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('profil.messages')}</Text></Pressable>
          <Pressable onPress={() => router.push('/messagerie/parametres')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('messagerie.parametres')}</Text></Pressable>
          <Pressable onPress={() => router.push('/changer-mot-de-passe')} accessibilityRole="button"><Text style={styles.sousTitre}>{t('profil.motDePasse')}</Text></Pressable>
        </Carte>
        <View style={styles.pied}>
          <Bouton titre={t('profil.deconnexion')} variante="secondaire" onPress={deconnecter} />
        </View>
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  bloc: { gap: espaces.s },
  nom: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire },
  sousTitre: { fontSize: 15, fontWeight: '600', color: couleurs.texte, marginBottom: espaces.xs },
  langue: { padding: espaces.m, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure },
  langueActive: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  langueTexte: { color: couleurs.texte },
  langueTexteActive: { color: couleurs.violet, fontWeight: '700' },
  note: { color: couleurs.texteSecondaire, fontSize: 12 },
  pied: { marginTop: espaces.l },
});
