// Profil du compte : en-tête personnalisé, puis des sections en tuiles (achats, compte, communication).
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { useSession } from '../../src/auth/session';
import { ConnexionRequise } from '../../src/components/ConnexionRequise';
import { LANGUES, type Langue } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran } from '../../src/components/ui';
import { initiales } from '../../src/lib/profil';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Profil {
  id: string;
  telephone: string;
  role: string;
  nomAffiche: string | null;
  langue: Langue;
  nom: string | null;
  prenom: string | null;
  dateNaissance: string | null;
}
interface Tuile { emoji: string; libelle: string; chemin: string }

function Profil() {
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

  const achats: Tuile[] = [
    { emoji: '📦', libelle: t('profil.commandes'), chemin: '/mes-commandes' },
    { emoji: '♡', libelle: t('profil.listes'), chemin: '/listes' },
    { emoji: '🧾', libelle: t('profil.reclamations'), chemin: '/mes-reclamations' },
  ];
  const compte: Tuile[] = [
    { emoji: '📍', libelle: t('profil.adresses'), chemin: '/adresses' },
    { emoji: '🔒', libelle: t('profil.motDePasse'), chemin: '/changer-mot-de-passe' },
    { emoji: '📄', libelle: t('profil.conditions'), chemin: '/legal/cgu' },
  ];
  const communication: Tuile[] = [
    { emoji: '💬', libelle: t('profil.messages'), chemin: '/(tabs)/messages' },
    { emoji: '🔔', libelle: t('notifications.titre'), chemin: '/notifications' },
    { emoji: '⚙️', libelle: t('messagerie.parametres'), chemin: '/messagerie/parametres' },
  ];

  const prenomAffiche = profil?.prenom ?? profil?.nomAffiche?.split(' ')[0] ?? '';

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.entete}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexte}>{initiales(profil?.prenom, profil?.nom, profil?.nomAffiche)}</Text>
          </View>
          <View style={styles.identite}>
            <Text style={styles.bonjour}>{t('profil.bonjour', { prenom: prenomAffiche || '—' })}</Text>
            <Text style={styles.secondaire}>{profil?.telephone ?? '—'}</Text>
          </View>
        </View>

        <Section titre={t('profil.section.achats')} tuiles={achats} />
        <Section titre={t('profil.section.compte')} tuiles={compte} />

        <Carte style={styles.bloc}>
          <Text style={styles.sousTitre}>{t('profil.infos')}</Text>
          <Text style={styles.secondaire}>{profil?.nom ?? '—'} · {profil?.prenom ?? '—'}</Text>
          <Text style={styles.secondaire}>{t('profil.dateNaissance')} : {profil?.dateNaissance ?? '—'}</Text>
        </Carte>

        <Section titre={t('profil.section.communication')} tuiles={communication} />

        <Carte style={styles.bloc}>
          <Text style={styles.sousTitre}>{t('profil.section.preferences')}</Text>
          <Text style={styles.sousTitreSecondaire}>{t('profil.langue')}</Text>
          <View style={styles.langues}>
            {LANGUES.map((l) => (
              <Pressable key={l} onPress={() => choisirLangue(l)} style={[styles.langue, langue === l && styles.langueActive]} accessibilityRole="button">
                <Text style={[styles.langueTexte, langue === l && styles.langueTexteActive]}>{t(`langue.${l}` as 'langue.fr')}</Text>
              </Pressable>
            ))}
          </View>
        </Carte>

        <View style={styles.pied}>
          <Bouton titre={t('profil.deconnexion')} variante="secondaire" onPress={deconnecter} />
        </View>
      </ScrollView>
    </Ecran>
  );
}

function Section({ titre, tuiles }: { titre: string; tuiles: Tuile[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.titreSection}>{titre}</Text>
      <View style={styles.grille}>
        {tuiles.map((tu) => (
          <Pressable key={tu.chemin} onPress={() => router.push(tu.chemin)} accessibilityRole="button" style={styles.tuile}>
            <Text style={styles.emoji}>{tu.emoji}</Text>
            <Text style={styles.libelleTuile}>{tu.libelle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ProfilAccueil() {
  const { statut } = useSession();
  const { t } = useI18n();
  if (statut === 'deconnecte') return <ConnexionRequise titre={t('auth.requise.profil')} />;
  return <Profil />;
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.l },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: couleurs.violet, alignItems: 'center', justifyContent: 'center' },
  avatarTexte: { color: couleurs.blanc, fontSize: 20, fontWeight: '700' },
  identite: { flex: 1, gap: espaces.xs },
  bonjour: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire },
  section: { gap: espaces.s },
  titreSection: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.m },
  tuile: { width: '47%', padding: espaces.m, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure, alignItems: 'center', gap: espaces.s, backgroundColor: couleurs.blanc },
  emoji: { fontSize: 28 },
  libelleTuile: { fontSize: 14, color: couleurs.texte, textAlign: 'center', fontWeight: '600' },
  bloc: { gap: espaces.s },
  sousTitre: { fontSize: 15, fontWeight: '700', color: couleurs.texte },
  sousTitreSecondaire: { fontSize: 13, color: couleurs.texteSecondaire },
  langues: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  langue: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  langueActive: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  langueTexte: { color: couleurs.texte },
  langueTexteActive: { color: couleurs.violet, fontWeight: '700' },
  pied: { marginTop: espaces.s },
});
