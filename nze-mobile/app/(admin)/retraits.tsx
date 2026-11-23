import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces } from '../../src/theme';

interface Retrait { id: string; entrepriseNom: string; montantFcfa: number; operateur: string; numero: string; nomBeneficiaire: string; statut: string }

export default function RetraitsAdmin() {
  const { t, langue } = useI18n();
  const { elements: liste, recharger, chargerPlus, plusDisponible, chargement } = useListePaginee<Retrait>('/admin/retraits');
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = recharger;
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function faire(chemin: string, corps?: unknown) {
    setMessage(null);
    try {
      await appeler(chemin, { methode: 'POST', corps: corps ?? {} });
      setMessage({ texte: t('admin.decisionOk'), type: 'succes' });
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('admin.retraitsTitre')}</Text>
        {message && <Message texte={message.texte} type={message.type} />}
        {liste.length === 0 && <Text style={styles.vide}>{t('admin.vide')}</Text>}
        {liste.map((r) => (
          <Carte key={r.id} style={{ gap: espaces.s }}>
            <Text style={styles.sousTitre}>{r.entrepriseNom} · {formatFcfa(r.montantFcfa, langue)}</Text>
            <Text style={styles.texte}>{r.nomBeneficiaire} · {r.operateur} · {r.numero}</Text>
            <Text style={styles.legende}>{t(`portefeuille.${r.statut}` as Cle)}</Text>
            {r.statut === 'EN_ATTENTE' && (
              <View style={styles.actions}>
                <View style={{ flex: 1 }}><Bouton titre={t('admin.accepter')} onPress={() => faire(`/admin/retraits/${r.id}/decision`, { decision: 'ACCEPTER' })} /></View>
                <View style={{ flex: 1 }}><Bouton titre={t('admin.rejeter')} variante="danger" onPress={() => faire(`/admin/retraits/${r.id}/decision`, { decision: 'REJETER' })} /></View>
              </View>
            )}
            {r.statut === 'VERSEMENT_EN_COURS' && (
              <Bouton titre={t('admin.verifier')} variante="secondaire" onPress={() => faire(`/admin/retraits/${r.id}/verifier-versement`)} />
            )}
          </Carte>
        ))}
      <ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  texte: { color: couleurs.texte },
  legende: { color: couleurs.violet, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: espaces.s },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire },
});
