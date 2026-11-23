import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../src/api/client';
import { ajouterAuPanier } from '../src/api/panier';
import { useI18n } from '../src/i18n';
import { Bouton, Carte, Ecran, Message } from '../src/components/ui';
import { formatFcfa } from '../src/lib/format';
import { couleurs, espaces } from '../src/theme';

interface Article { produitId: string; nom: string; prixFcfa: number; enStock?: boolean }

export default function Listes() {
  const { t, langue } = useI18n();
  const [envies, setEnvies] = useState<Article[]>([]);
  const [achats, setAchats] = useState<Article[]>([]);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(() => {
    appeler<Article[]>('/listes-envies').then((r) => setEnvies(r.map((a) => ({ ...a, produitId: a.produitId })))).catch(() => setEnvies([]));
    appeler<Article[]>('/achats-a-nouveau').then(setAchats).catch(() => setAchats([]));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function retirer(produitId: string) {
    await appeler(`/listes-envies/${produitId}`, { methode: 'DELETE' }).catch(() => undefined);
    charger();
  }

  async function racheter(produitId: string) {
    setMessage(null);
    try {
      await ajouterAuPanier(produitId, 1);
      setMessage({ texte: t('produit.ajoute'), type: 'succes' });
    } catch {
      setMessage({ texte: t('commun.erreur'), type: 'erreur' });
    }
  }

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
        <Text style={styles.titre}>{t('listes.titre')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        {message && <Message texte={message.texte} type={message.type} />}
        <Text style={styles.section}>{t('listes.envies')}</Text>
        {envies.length === 0 && <Text style={styles.vide}>{t('listes.vide')}</Text>}
        {envies.map((a) => (
          <Carte key={a.produitId} style={styles.ligne}>
            <View style={{ flex: 1, gap: espaces.xs }}>
              <Text style={styles.nom}>{a.nom}</Text>
              <Text style={styles.prix}>{formatFcfa(a.prixFcfa, langue)}</Text>
            </View>
            <Pressable onPress={() => retirer(a.produitId)} accessibilityRole="button"><Text style={styles.danger}>{t('listes.retirer')}</Text></Pressable>
          </Carte>
        ))}
        <Text style={styles.section}>{t('listes.achats')}</Text>
        {achats.length === 0 && <Text style={styles.vide}>{t('listes.vide')}</Text>}
        {achats.map((a) => (
          <Carte key={a.produitId} style={styles.ligne}>
            <View style={{ flex: 1, gap: espaces.xs }}>
              <Text style={styles.nom}>{a.nom}</Text>
              <Text style={styles.prix}>{formatFcfa(a.prixFcfa, langue)}</Text>
            </View>
            <Bouton titre={t('listes.racheter')} onPress={() => racheter(a.produitId)} desactive={a.enStock === false} />
          </Carte>
        ))}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s, gap: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  contenu: { padding: espaces.l, gap: espaces.m },
  section: { fontSize: 16, fontWeight: '700', color: couleurs.texte, marginTop: espaces.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  nom: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  prix: { color: couleurs.violet, fontWeight: '700' },
  danger: { color: couleurs.danger, fontWeight: '600' },
  vide: { color: couleurs.texteSecondaire },
});
