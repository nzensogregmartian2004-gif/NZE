import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../src/api/client';
import { useI18n } from '../src/i18n';
import { Bouton, Carte, Champ, Ecran, Message } from '../src/components/ui';
import { useFocusEffect } from 'expo-router';
import { couleurs, espaces } from '../src/theme';

interface Adresse { id: string; libelle: string; quartier: string; repere: string | null }

export default function Adresses() {
  const { t } = useI18n();
  const [liste, setListe] = useState<Adresse[]>([]);
  const [ajout, setAjout] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [quartier, setQuartier] = useState('');
  const [repere, setRepere] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(() => {
    appeler<Adresse[]>('/adresses').then(setListe).catch(() => setListe([]));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function localiser() {
    setMessage(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return setMessage({ texte: t('adresses.positionKo'), type: 'erreur' });
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
    setMessage({ texte: t('adresses.positionOk'), type: 'succes' });
  }

  async function enregistrer() {
    if (!position) return;
    setMessage(null);
    try {
      await appeler('/adresses', { methode: 'POST', corps: { libelle, quartier, repere: repere || undefined, ...position } });
      setAjout(false);
      setLibelle(''); setQuartier(''); setRepere(''); setPosition(null);
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  async function supprimer(id: string) {
    await appeler(`/adresses/${id}`, { methode: 'DELETE' }).catch(() => undefined);
    charger();
  }

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
        <Text style={styles.titre}>{t('adresses.titre')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        {liste.length === 0 && <Text style={styles.vide}>{t('adresses.vide')}</Text>}
        {liste.map((a) => (
          <Carte key={a.id} style={styles.ligne}>
            <View style={{ flex: 1, gap: espaces.xs }}>
              <Text style={styles.nom}>{a.libelle}</Text>
              <Text style={styles.secondaire}>{a.quartier}{a.repere ? ` · ${a.repere}` : ''}</Text>
            </View>
            <Pressable onPress={() => supprimer(a.id)} accessibilityRole="button"><Text style={styles.supprimer}>{t('adresses.supprimer')}</Text></Pressable>
          </Carte>
        ))}
        {message && <Message texte={message.texte} type={message.type} />}
        {!ajout ? (
          <Bouton titre={t('adresses.ajouter')} onPress={() => setAjout(true)} />
        ) : (
          <Carte style={{ gap: espaces.s }}>
            <Champ label={t('adresses.libelle')} valeur={libelle} onChangeTexte={setLibelle} />
            <Champ label={t('adresses.quartier')} valeur={quartier} onChangeTexte={setQuartier} />
            <Champ label={t('adresses.repere')} valeur={repere} onChangeTexte={setRepere} />
            <Bouton titre={t('adresses.position')} variante="secondaire" onPress={localiser} />
            <Bouton titre={t('adresses.enregistrer')} onPress={enregistrer} desactive={!position || !libelle || !quartier} />
          </Carte>
        )}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s, gap: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  contenu: { padding: espaces.l, gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  nom: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire },
  supprimer: { color: couleurs.danger, fontWeight: '600' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire },
});
