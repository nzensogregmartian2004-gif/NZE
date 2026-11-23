import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { Carte, Ecran, Message } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { REGISTRES } from '../../src/lib/admin-entreprises';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Ecriture { id: string; commandeId: string; registre: string; categorie: string; montantFcfa: number; creeLe: string }
interface Reponse { totaux: Record<string, number>; lignes: Ecriture[] }

export default function RegistresAdmin() {
  const { t, langue } = useI18n();
  const [registre, setRegistre] = useState<(typeof REGISTRES)[number]['code']>('TOUS');
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [plusLignes, setPlusLignes] = useState(false);
  const [chargementPlus, setChargementPlus] = useState(false);

  const charger = useCallback(() => {
    const chemin = registre === 'TOUS' ? '/admin/ecritures' : `/admin/ecritures?registre=${registre}`;
    appeler<Reponse>(chemin)
      .then((r) => { setReponse(r); setMessage(null); setPlusLignes(r.lignes.length >= 50); })
      .catch(() => setMessage(t('registres.erreur')));
  }, [registre, t]);

  useFocusEffect(charger);

  // Écritures : une page de 50 lignes à la fois. Les totaux, eux, portent sur l'ensemble des écritures.
  async function chargerPlus() {
    if (!reponse || chargementPlus || !plusLignes) return;
    setChargementPlus(true);
    try {
      const base = registre === 'TOUS' ? '/admin/ecritures' : `/admin/ecritures?registre=${registre}`;
      const r = await appeler<Reponse>(`${base}${base.includes('?') ? '&' : '?'}limite=50&decalage=${reponse.lignes.length}`);
      setReponse((actuel) => actuel ? { ...actuel, lignes: [...actuel.lignes, ...r.lignes.filter((l) => !actuel.lignes.some((x) => x.id === l.id))] } : actuel);
      setPlusLignes(r.lignes.length >= 50);
    } catch {
      setPlusLignes(false);
    } finally {
      setChargementPlus(false);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('registres.titre')}</Text>
        <View style={styles.ligneChips}>
          {REGISTRES.map((r) => (
            <Pressable key={r.code} onPress={() => setRegistre(r.code)} style={[styles.chip, registre === r.code && styles.chipActif]}>
              <Text style={[styles.chipTexte, registre === r.code && styles.chipTexteActif]}>{t(r.cle)}</Text>
            </Pressable>
          ))}
        </View>
        {message ? <Message texte={message} /> : null}
        {reponse ? (
          <Carte>
            <Text style={styles.sousTitre}>{t('registres.totaux')}</Text>
            {Object.entries(reponse.totaux).map(([code, total]) => (
              <Text key={code} style={styles.ligne}>{t(`registre.${code}` as Cle)} : {formatFcfa(total)}</Text>
            ))}
          </Carte>
        ) : null}
        {reponse?.lignes.map((l) => (
          <Carte key={l.id}>
            <Text style={styles.ligne}>{l.categorie} · {t(`registre.${l.registre}` as Cle)}</Text>
            <Text style={styles.montant}>{formatFcfa(l.montantFcfa)}</Text>
            <Text style={styles.detail}>{t('registres.commande', { id: l.commandeId.slice(0, 8) })} · {new Date(l.creeLe).toLocaleDateString(langue === 'fr' ? 'fr-FR' : langue)}</Text>
          </Carte>
        ))}
        <ChargerPlus visible={plusLignes} chargement={chargementPlus} onPress={chargerPlus} />
        {reponse && reponse.lignes.length === 0 ? <Text style={styles.detail}>{t('registres.aucune')}</Text> : null}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.m, gap: espaces.m },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
  ligneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  chip: { paddingVertical: espaces.s, paddingHorizontal: espaces.m, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.violet },
  chipActif: { backgroundColor: couleurs.violet },
  chipTexte: { color: couleurs.violet, fontWeight: '600' },
  chipTexteActif: { color: couleurs.blanc },
  ligne: { color: couleurs.texte },
  montant: { fontSize: 18, fontWeight: '700', color: couleurs.violet },
  detail: { color: couleurs.texteSecondaire, fontSize: 12 },
});
