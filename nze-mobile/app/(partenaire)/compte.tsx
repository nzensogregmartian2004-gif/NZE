import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { LANGUES, type Langue } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran } from '../../src/components/ui';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Profil { telephone: string; nomAffiche: string | null; langue: Langue }

export default function ComptePartenaire() {
  const { t, langue, setLangue } = useI18n();
  const { deconnecter } = useSession();
  const [profil, setProfil] = useState<Profil | null>(null);
  useEffect(() => { appeler<Profil>('/profil').then(setProfil).catch(() => setProfil(null)); }, []);

  async function choisirLangue(l: Langue) {
    await setLangue(l);
    await appeler('/profil', { methode: 'PATCH', corps: { langue: l } }).catch(() => undefined);
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('profil.titre')}</Text>
        <Carte style={{ gap: espaces.xs }}>
          <Text style={styles.nom}>{profil?.nomAffiche ?? '—'}</Text>
          <Text style={styles.legende}>{t('profil.telephone')} : {profil?.telephone ?? '—'}</Text>
        </Carte>
        <Carte style={{ gap: espaces.s }}>
          <Text style={styles.sousTitre}>{t('profil.langue')}</Text>
          {LANGUES.map((l) => (
            <Pressable key={l} onPress={() => choisirLangue(l)} style={[styles.langue, langue === l && styles.actif]} accessibilityRole="radio">
              <Text style={[styles.langueTexte, langue === l && styles.actifTexte]}>{t(`langue.${l}` as 'langue.fr')}</Text>
            </Pressable>
          ))}
        </Carte>
        <Bouton titre={t('profil.motDePasse')} variante="secondaire" onPress={() => router.push('/changer-mot-de-passe')} />
        <Bouton titre={t('profil.deconnexion')} variante="danger" onPress={deconnecter} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  nom: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  legende: { color: couleurs.texteSecondaire },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  langue: { padding: espaces.m, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure },
  actif: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  langueTexte: { color: couleurs.texte },
  actifTexte: { color: couleurs.violet, fontWeight: '700' },
});
