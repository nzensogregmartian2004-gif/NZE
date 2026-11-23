import { ChargerPlus } from '../../src/components/ChargerPlus';
import { fusionnerPages, rafraichirFil } from '../../src/lib/pagination';
import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Ecran, Message } from '../../src/components/ui';
import { tailles, couleurs, espaces, rayons } from '../../src/theme';

interface Msg { id: string; corps: string | null; genre: string; expediteurId: string; createdAt: string }

export default function Conversation() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [plusAnciens, setPlusAnciens] = useState(false);
  const [chargementAnciens, setChargementAnciens] = useState(false);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  // Rafraîchissement : la dernière page remplace les messages récents, sans effacer les plus anciens déjà chargés.
  const charger = useCallback(() => {
    appeler<Msg[]>(`/conversations/${id}/messages?limite=50`)
      .then((page) => {
        setMessages((actuels) => rafraichirFil(actuels, page));
        setPlusAnciens((actuel) => actuel || page.length >= 50);
      })
      .catch(() => setMessages([]));
  }, [id]);

  async function chargerAnciens() {
    if (chargementAnciens || !plusAnciens) return;
    setChargementAnciens(true);
    try {
      const page = await appeler<Msg[]>(`/conversations/${id}/messages?limite=50&decalage=${messages.length}`);
      setMessages((actuels) => fusionnerPages(page, actuels));
      setPlusAnciens(page.length >= 50);
    } catch {
      setPlusAnciens(false);
    } finally {
      setChargementAnciens(false);
    }
  }

  useEffect(() => {
    charger();
    const intervalle = setInterval(charger, 10000);
    return () => clearInterval(intervalle);
  }, [charger]);

  // Suppression définitive (point O-11) : après confirmation, la conversation et ses messages sont effacés.
  function demanderSuppression() {
    Alert.alert(t('messagerie.supprimer'), t('messagerie.supprimerConfirm'), [
      { text: t('commun.annuler'), style: 'cancel' },
      { text: t('commun.supprimer'), style: 'destructive', onPress: supprimerConversation },
    ]);
  }

  async function supprimerConversation() {
    try {
      await appeler(`/conversations/${id}`, { methode: 'DELETE' });
      router.back();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('messagerie.supprimerKo'));
    }
  }

  async function envoyer() {
    if (!texte.trim()) return;
    setErreur(null);
    try {
      await appeler(`/conversations/${id}/messages`, { methode: 'POST', corps: { genre: 'TEXTE', corps: texte.trim() } });
      setTexte('');
      charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
    }
  }

  return (
    <Ecran>
      <View style={styles.menuLigne}>
        <Pressable onPress={demanderSuppression} accessibilityLabel={t('messagerie.options')} hitSlop={10}>
          <Text style={styles.menuBouton}>⋯</Text>
        </Pressable>
      </View>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      <FlatList
        data={messages}
        ListHeaderComponent={plusAnciens ? <ChargerPlus visible={plusAnciens} chargement={chargementAnciens} onPress={chargerAnciens} titre={t('messages.chargerAnciens')} /> : undefined}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.liste}
        renderItem={({ item }) => (
          <View style={[styles.bulle, item.genre === 'TEXTE' && styles.bulleTexte]}>
            <Text style={styles.bulleTexteTxt}>{item.corps ?? ''}</Text>
          </View>
        )}
      />
      {erreur && <View style={styles.marge}><Message texte={erreur} /></View>}
      <View style={styles.saisie}>
        <TextInput value={texte} onChangeText={setTexte} placeholder={t('messages.ecrire')} placeholderTextColor={couleurs.texteSecondaire} style={styles.champ} />
        <Bouton titre={t('messages.envoyer')} onPress={envoyer} desactive={!texte.trim()} />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  liste: { padding: espaces.l, gap: espaces.s },
  bulle: { alignSelf: 'flex-start', backgroundColor: couleurs.fond, borderRadius: rayons.l, padding: espaces.m, maxWidth: '80%' },
  bulleTexte: { alignSelf: 'flex-end', backgroundColor: couleurs.violetClair },
  bulleTexteTxt: { color: couleurs.texte },
  marge: { paddingHorizontal: espaces.l },
  saisie: { flexDirection: 'row', gap: espaces.s, padding: espaces.l, alignItems: 'center', borderTopWidth: 1, borderTopColor: couleurs.bordure },
  champ: { flex: 1, height: tailles.champHauteur, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: rayons.pilule, paddingHorizontal: espaces.l, color: couleurs.texte },
  menuLigne: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  menuBouton: { fontSize: 22, color: couleurs.texte, paddingHorizontal: espaces.s },
});
