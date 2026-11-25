// Photos des articles : l'administration ajoute une photo à chaque article, utilisée par la recherche par photo.
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { typeMimeImage } from '../../src/lib/recherche-photo';
import { couleurs, espaces } from '../../src/theme';

interface Produit { id: string; nom: string }

export default function PhotosProduits() {
  const { t } = useI18n();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  useEffect(() => {
    appeler<Produit[]>('/produits?limite=100', { sansJeton: true }).then(setProduits).catch(() => setProduits([]));
  }, []);

  async function ajouter(id: string) {
    const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ['images'] });
    const asset = r.canceled ? null : r.assets[0];
    if (!asset?.base64) return;
    setEnCours(id);
    setMessage(null);
    try {
      await appeler(`/admin/produits/${id}/photo`, { methode: 'POST', corps: { image: asset.base64, typeMime: typeMimeImage(asset.mimeType) } });
      setMessage({ texte: t('admin.photos.ok'), type: 'succes' });
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? t('admin.photos.erreur') : t('commun.erreur'), type: 'erreur' });
    } finally {
      setEnCours(null);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('admin.photos.titre')}</Text>
        {message && <Message texte={message.texte} type={message.type} />}
        {produits.map((p) => (
          <Carte key={p.id} style={styles.ligne}>
            <Text style={styles.nom}>{p.nom}</Text>
            <Bouton titre={t('admin.photos.ajouter')} variante="secondaire" onPress={() => ajouter(p.id)} desactive={enCours !== null} chargement={enCours === p.id} />
          </Carte>
        ))}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  ligne: { gap: espaces.s },
  nom: { fontWeight: '600', color: couleurs.texte },
});
