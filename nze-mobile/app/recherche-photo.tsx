// Recherche par photo : on photographie un article, et l'application propose les articles qui lui ressemblent.
import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../src/api/client';
import { API_URL } from '../src/config';
import { useI18n } from '../src/i18n';
import { Bouton, Carte, Ecran, Message } from '../src/components/ui';
import { formatFcfa } from '../src/lib/format';
import { typeMimeImage } from '../src/lib/recherche-photo';
import { couleurs, espaces } from '../src/theme';

interface Resultat { id: string; nom: string; prixFcfa: number; distance: number; photoUrl: string | null }

export default function RecherchePhoto() {
  const { t, langue } = useI18n();
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState<Resultat[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function rechercher(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.base64) {
      setErreur(t('commun.erreur'));
      return;
    }
    setErreur(null);
    setResultats(null);
    setEnCours(true);
    try {
      const r = await appeler<Resultat[]>('/recherche/photo', {
        methode: 'POST',
        corps: { image: asset.base64, typeMime: typeMimeImage(asset.mimeType) },
        sansJeton: true,
      });
      setResultats(r);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setEnCours(false);
    }
  }

  async function prendre() {
    const autorisation = await ImagePicker.requestCameraPermissionsAsync();
    if (!autorisation.granted) {
      setErreur(t('commun.erreur'));
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, mediaTypes: ['images'] });
    if (!r.canceled && r.assets[0]) void rechercher(r.assets[0]);
  }

  async function choisir() {
    const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ['images'] });
    if (!r.canceled && r.assets[0]) void rechercher(r.assets[0]);
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('recherche.photo.titre')}</Text>
        <Text style={styles.secondaire}>{t('recherche.photo.indice')}</Text>
        <Bouton titre={t('recherche.photo.prendre')} onPress={prendre} desactive={enCours} />
        <Bouton titre={t('recherche.photo.galerie')} variante="secondaire" onPress={choisir} desactive={enCours} />
        {erreur && <Message texte={erreur} />}
        {enCours && (
          <View style={styles.attente}>
            <ActivityIndicator color={couleurs.violet} />
            <Text style={styles.secondaire}>{t('recherche.photo.enCours')}</Text>
          </View>
        )}
        {resultats && resultats.length === 0 && <Text style={styles.secondaire}>{t('recherche.photo.aucun')}</Text>}
        {resultats?.map((r) => (
          <Pressable key={r.id} onPress={() => router.push(`/produit/${r.id}`)} accessibilityRole="button">
            <Carte style={styles.ligne}>
              {r.photoUrl ? (
                <Image source={{ uri: `${API_URL}/produits/${r.id}/photo` }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.sansPhoto]} />
              )}
              <View style={styles.infos}>
                <Text style={styles.nom}>{r.nom}</Text>
                <Text style={styles.prix}>{formatFcfa(r.prixFcfa, langue)}</Text>
              </View>
            </Carte>
          </Pressable>
        ))}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire },
  attente: { alignItems: 'center', gap: espaces.s, paddingVertical: espaces.l },
  ligne: { flexDirection: 'row', gap: espaces.m, alignItems: 'center' },
  photo: { width: 80, height: 80, borderRadius: 8, backgroundColor: couleurs.fond },
  sansPhoto: { alignItems: 'center', justifyContent: 'center' },
  infos: { flex: 1, gap: espaces.xs },
  nom: { fontWeight: '600', color: couleurs.texte },
  prix: { color: couleurs.violet, fontWeight: '700' },
});
