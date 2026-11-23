import { useListePaginee } from '../src/lib/use-liste-paginee';
import { ChargerPlus } from '../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../src/api/client';
import { useI18n } from '../src/i18n';
import { Bouton, Carte, Ecran } from '../src/components/ui';
import { formatDateHeure } from '../src/lib/format';
import { couleurs, espaces } from '../src/theme';

interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string;
  lueLe: string | null;
  createdAt: string;
}

export default function Notifications() {
  const { t, langue } = useI18n();
  const { elements: items, setElements: setItems, chargement, plusDisponible, erreur: erreurChargement, recharger, chargerPlus } = useListePaginee<Notification>('/notifications');
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(async () => { recharger(); }, [recharger]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));

  async function marquerLue(id: string) {
    try {
      await appeler(`/notifications/${id}/lue`, { methode: 'POST' });
      setItems((anciens) => anciens.map((n) => n.id === id ? { ...n, lueLe: new Date().toISOString() } : n));
    } catch {
      setErreur(true);
    }
  }

  async function toutLire() {
    try {
      await appeler('/notifications/toutes-lues', { methode: 'POST' });
      setItems((anciens) => anciens.map((n) => ({ ...n, lueLe: n.lueLe ?? new Date().toISOString() })));
    } catch {
      setErreur(true);
    }
  }

  const nonLues = items.filter((n) => !n.lueLe).length;

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('notifications.titre')}</Text>
        {nonLues > 0 && <Bouton titre={t('notifications.toutLire')} variante="secondaire" onPress={toutLire} />}
        {(erreur || erreurChargement) && <Text style={styles.erreur}>{t('notifications.erreur')}</Text>}
        {chargement ? <Text style={styles.secondaire}>{t('commun.chargement')}</Text> : null}
        {!chargement && items.length === 0 ? <Text style={styles.vide}>{t('notifications.vide')}</Text> : null}
        {items.map((n) => (
          <Pressable key={n.id} onPress={() => !n.lueLe && marquerLue(n.id)} accessibilityRole="button">
            <Carte style={[styles.carte, !n.lueLe && styles.nonLue]}>
              <View style={styles.entete}>
                <Text style={styles.notificationTitre}>{n.titre}</Text>
                <Text style={styles.etat}>{n.lueLe ? t('notifications.lue') : t('notifications.nouvelle')}</Text>
              </View>
              <Text style={styles.message}>{n.message}</Text>
              <Text style={styles.date}>{formatDateHeure(n.createdAt, langue)}</Text>
            </Carte>
          </Pressable>
        ))}
      <ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  carte: { gap: espaces.s, borderWidth: 1, borderColor: couleurs.bordure },
  nonLue: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaces.s },
  notificationTitre: { flex: 1, color: couleurs.texte, fontWeight: '700' },
  etat: { color: couleurs.violet, fontSize: 11, fontWeight: '600' },
  message: { color: couleurs.texte },
  date: { color: couleurs.texteSecondaire, fontSize: 12 },
  secondaire: { color: couleurs.texteSecondaire },
  erreur: { color: couleurs.danger },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
