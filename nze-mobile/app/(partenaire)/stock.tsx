import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { formatDateHeure, formatSigne } from '../../src/lib/format';
import { cleEtat } from '../../src/lib/admin-entreprises';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Produit { id: string; nom: string; disponible: number | null; etat?: string }
interface Mouvement { id: string; date: string; produit: string; mouvement: string; delta: number; origine: string; disponibleApres: number | null }
const GENRES = ['VENTE', 'RUPTURE', 'RETOUR', 'VARIATION'] as const;

export default function StockPartenaire() {
  const { t, langue } = useI18n();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [produitId, setProduitId] = useState<string | null>(null);
  const [genre, setGenre] = useState<(typeof GENRES)[number]>('VENTE');
  const [quantite, setQuantite] = useState('');
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);
  const { elements: historique, recharger, chargerPlus, plusDisponible, chargement } = useListePaginee<Mouvement>('/partenaire/mouvements-stock');

  useFocusEffect(useCallback(() => {
    recharger();
    appeler<Produit[]>('/partenaire/produits').then((l) => { setProduits(l); if (!produitId && l[0]) setProduitId(l[0].id); }).catch(() => setProduits([]));
    // Liste rechargée à chaque retour sur l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  async function enregistrer() {
    if (!produitId) return;
    setMessage(null);
    try {
      await appeler('/partenaire/signalements', { methode: 'POST', corps: { produitId, genre, quantite: Number(quantite) } });
      setQuantite('');
      setMessage({ texte: t('stock.succes'), type: 'succes' });
      appeler<Produit[]>('/partenaire/produits').then(setProduits).catch(() => undefined);
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  const quantiteValide = /^-?\d{1,5}$/.test(quantite) && Number(quantite) !== 0;

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('stock.titre')}</Text>
        <Carte style={{ gap: espaces.s }}>
          <Text style={styles.sousTitre}>{t('stock.produit')}</Text>
          <View style={styles.pilules}>
            {produits.map((p) => (
              <Pressable key={p.id} onPress={() => setProduitId(p.id)} style={[styles.pilule, produitId === p.id && styles.actif]} accessibilityRole="radio">
                <Text style={[styles.pilulesTexte, produitId === p.id && styles.actifTexte]}>{p.nom}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sousTitre}>{t('stock.genre')}</Text>
          <View style={styles.pilules}>
            {GENRES.map((g) => (
              <Pressable key={g} onPress={() => setGenre(g)} style={[styles.pilule, genre === g && styles.actif]} accessibilityRole="radio">
                <Text style={[styles.pilulesTexte, genre === g && styles.actifTexte]}>{t(`stock.${g}` as Cle)}</Text>
              </Pressable>
            ))}
          </View>
          <Champ label={t('stock.quantite')} valeur={quantite} onChangeTexte={setQuantite} clavier="numbers-and-punctuation" />
          {message && <Message texte={message.texte} type={message.type} />}
          <Bouton titre={t('stock.envoyer')} onPress={enregistrer} desactive={!produitId || !quantiteValide} />
        </Carte>
        <Text style={styles.sousTitre}>{t('stock.disponible')}</Text>
        {produits.map((p) => (
          <Carte key={p.id} style={styles.ligne}>
            <Text style={styles.nom}>{p.nom}</Text>
            <Text style={styles.quantiteTexte}>{p.disponible ?? 0}</Text>
            <Text style={{ color: couleurs.texteSecondaire, fontSize: 12 }}>{t(cleEtat(p.etat ?? 'DISPONIBLE') as Cle)}</Text>
          </Carte>
        ))}
        <Text style={styles.sousTitre}>{t('stock.historique')}</Text>
        {historique.length === 0 && <Text style={styles.legende}>{t('stock.historiqueVide')}</Text>}
        {historique.map((m) => (
          <Carte key={m.id} style={{ gap: espaces.xs }}>
            <View style={styles.ligne}>
              <Text style={styles.nom}>{m.produit}</Text>
              <Text style={[styles.quantiteTexte, m.delta < 0 && styles.alerte]}>{formatSigne(m.delta)}</Text>
            </View>
            <Text style={styles.legende}>{formatDateHeure(m.date, langue)} · {m.mouvement} · {t(`stock.origine.${m.origine}` as Cle)}{m.disponibleApres !== null ? ` · ${m.disponibleApres}` : ''}</Text>
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
  pilules: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  actif: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  pilulesTexte: { color: couleurs.texte },
  actifTexte: { color: couleurs.violet, fontWeight: '700' },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { color: couleurs.texte, fontWeight: '500' },
  quantiteTexte: { color: couleurs.violet, fontWeight: '700' },
  alerte: { color: couleurs.danger },
  legende: { color: couleurs.texteSecondaire },
});
