import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { useSession } from '../../src/auth/session';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { couleurs, espaces } from '../../src/theme';

export default function ReglagesAdmin() {
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [enregistre, setEnregistre] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);
  const [chargement, setChargement] = useState(false);
  const { utilisateur } = useSession();
  const [telRecup, setTelRecup] = useState('+241');
  const [codeRecup, setCodeRecup] = useState<string | null>(null);
  const [erreurRecup, setErreurRecup] = useState<string | null>(null);
  const [chargRecup, setChargRecup] = useState(false);

  // Code de récupération à transmettre au client, une seule fois, après vérification de son identité.
  async function genererCode() {
    setCodeRecup(null);
    setErreurRecup(null);
    setChargRecup(true);
    try {
      const r = await appeler<{ code: string; expireDans: number }>('/admin/recuperations-assistees', { methode: 'POST', corps: { telephone: telRecup } });
      setCodeRecup(r.code);
    } catch (e) {
      setErreurRecup(e instanceof ApiError ? e.message : t('commun.erreur'));
    } finally {
      setChargRecup(false);
    }
  }

  useEffect(() => {
    appeler<{ message: string }>('/admin/reglages/paiement-sur-place').then((r) => setMessage(r.message)).catch(() => undefined);
  }, []);

  async function enregistrer() {
    setEnregistre(null);
    setChargement(true);
    try {
      await appeler('/admin/reglages/paiement-sur-place', { methode: 'PUT', corps: { message } });
      setEnregistre({ texte: t('admin.messageEnregistre'), type: 'succes' });
    } catch (e) {
      setEnregistre({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    } finally {
      setChargement(false);
    }
  }

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
        <Text style={styles.titre}>{t('admin.reglages')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Carte style={{ gap: espaces.s }}>
          <Text style={styles.legende}>{t('admin.messageAide')}</Text>
          <Champ label={t('admin.messagePaiement')} valeur={message} onChangeTexte={setMessage} multiligne />
          {enregistre && <Message texte={enregistre.texte} type={enregistre.type} />}
          <Bouton titre={t('commun.enregistrer')} onPress={enregistrer} chargement={chargement} desactive={message.trim().length < 20} />
        </Carte>
        {utilisateur?.role === 'admin_principal' ? (
          <Carte style={{ gap: espaces.s }}>
            <Text style={styles.sousTitre}>{t('admin.recuperation.titre')}</Text>
            <Text style={styles.legende}>{t('admin.recuperation.texte')}</Text>
            <Champ label={t('admin.recuperation.telephone')} valeur={telRecup} onChangeTexte={setTelRecup} clavier="phone-pad" />
            {erreurRecup && <Message texte={erreurRecup} />}
            {codeRecup ? <Text style={styles.code}>{codeRecup}</Text> : null}
            {codeRecup ? <Text style={styles.legende}>{t('admin.recuperation.expire')}</Text> : null}
            <Bouton titre={t('admin.recuperation.generer')} onPress={genererCode} chargement={chargRecup} desactive={telRecup.trim().length < 8} />
          </Carte>
        ) : null}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s, gap: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  contenu: { padding: espaces.l, gap: espaces.m },
  legende: { color: couleurs.texteSecondaire },
  sousTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
  code: { fontSize: 28, fontWeight: '700', color: couleurs.violet, letterSpacing: 4, textAlign: 'center' },
});
