import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { ETATS_STOCK } from '../../src/lib/admin-entreprises';
import { couleurs, espaces, rayons } from '../../src/theme';

interface ProduitStock { id: string; nom: string; disponible: number | null }
type Retour = { texte: string; type: 'erreur' | 'succes' } | null;

export default function StockAdmin() {
  const { t } = useI18n();
  const { elements: produits, recharger, chargerPlus, plusDisponible, chargement } = useListePaginee<ProduitStock>('/admin/produits');
  const [selection, setSelection] = useState<ProduitStock | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [retour, setRetour] = useState<Retour>(null);

  const charger = recharger;
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  const appliquer = async () => {
    if (!selection || !etat) return;
    try {
      await appeler(`/admin/produits/${selection.id}/etat-stock`, { methode: 'PATCH', corps: { etat, motif: motif.trim() || undefined } });
      setRetour({ texte: t('stockAdmin.succes', { etat: t((ETATS_STOCK.find((e) => e.code === etat)?.cle ?? etat) as Cle) }), type: 'succes' });
      setEtat(null);
      setMotif('');
    } catch (e) {
      setRetour({ texte: e instanceof ApiError ? e.message : t('stock.refuse'), type: 'erreur' });
    }
  };

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('stockAdmin.titre')}</Text>
        {produits.map((p) => (
          <Pressable key={p.id} onPress={() => { setSelection(p); setEtat(null); setRetour(null); }}>
            <Carte style={selection?.id === p.id ? styles.carteActive : undefined}>
              <Text style={styles.nom}>{p.nom}</Text>
              <Text style={styles.detail}>{t('stockAdmin.quantite', { quantite: p.disponible ?? 0 })}</Text>
            </Carte>
          </Pressable>
        ))}

        {selection ? (
          <Carte>
            <Text style={styles.sousTitre}>{selection.nom}</Text>
            <View style={styles.ligneChips}>
              {ETATS_STOCK.map((e) => (
                <Pressable key={e.code} onPress={() => setEtat(e.code)} style={[styles.chip, etat === e.code && styles.chipActif]}>
                  <Text style={[styles.chipTexte, etat === e.code && styles.chipTexteActif]}>{t(e.cle)}</Text>
                </Pressable>
              ))}
            </View>
            <Champ label={t('commun.motifFacultatif')} valeur={motif} onChangeTexte={setMotif} />
            <Bouton titre={t('stock.appliquer')} onPress={appliquer} desactive={!etat} />
          </Carte>
        ) : null}

        {retour ? <Message texte={retour.texte} type={retour.type} /> : null}
      <ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.m, gap: espaces.m },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
  nom: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  detail: { color: couleurs.texteSecondaire, fontSize: 12 },
  carteActive: { borderWidth: 2, borderColor: couleurs.violet },
  ligneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  chip: { paddingVertical: espaces.s, paddingHorizontal: espaces.m, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.violet },
  chipActif: { backgroundColor: couleurs.violet },
  chipTexte: { color: couleurs.violet, fontWeight: '600' },
  chipTexteActif: { color: couleurs.blanc },
});
