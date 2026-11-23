import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../src/api/client';
import { useSession } from '../src/auth/session';
import { useI18n } from '../src/i18n';
import { Bouton, Champ, Ecran, Message } from '../src/components/ui';
import { couleurs, espaces } from '../src/theme';

export default function ChangerMotDePasse() {
  const { t } = useI18n();
  const { ouvrirSession } = useSession();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  async function enregistrer() {
    setMessage(null);
    setChargement(true);
    try {
      const r = await appeler<{ token: string; utilisateur: { id: string; role: string; telephone?: string } }>('/auth/mot-de-passe/changer', {
        methode: 'POST', corps: { ancien, nouveau },
      });
      await ouvrirSession(r);
      setAncien('');
      setNouveau('');
      setMessage({ texte: t('mdp.succes'), type: 'succes' });
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    } finally {
      setChargement(false);
    }
  }

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
        <Text style={styles.titre}>{t('mdp.titre')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {message && <Message texte={message.texte} type={message.type} />}
        <Champ label={t('mdp.ancien')} valeur={ancien} onChangeTexte={setAncien} secret />
        <Champ label={t('mdp.nouveau')} valeur={nouveau} onChangeTexte={setNouveau} secret />
        <Bouton titre={t('mdp.enregistrer')} onPress={enregistrer} chargement={chargement} desactive={!ancien || nouveau.length < 8} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s, gap: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  contenu: { padding: espaces.l, gap: espaces.m },
});
