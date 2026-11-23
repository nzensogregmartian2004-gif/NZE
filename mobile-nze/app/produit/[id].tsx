import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { ajouterAuPanier } from '../../src/api/panier';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Produit {
  id: string; nom: string; description: string | null; prixFcfa: number; garantieJours: number | null;
  enStock: boolean; quantiteDisponible: number; etatStock: 'RUPTURE' | 'STOCK_FAIBLE' | 'EN_STOCK';
  caracteristiques: { nom: string; valeur: string }[]; commentaires: string | null;
}
const QUANTITE_MAX = 99;

export default function FicheProduit() {
  const { t, langue } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [produit, setProduit] = useState<Produit | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    appeler<Produit>(`/produits/${id}`, { sansJeton: true }).then(setProduit).catch(() => setProduit(null));
  }, [id]);

  async function ajouter() {
    setMessage(null);
    setChargement(true);
    try {
      await ajouterAuPanier(String(id), quantite);
      setMessage({ texte: `${t('produit.ajoute')} (${quantite})`, type: 'succes' });
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    } finally {
      setChargement(false);
    }
  }

  async function ajouterListe() {
    setMessage(null);
    try {
      await appeler('/listes-envies', { methode: 'POST', corps: { produitId: String(id) } });
      setMessage({ texte: t('produit.ajouterListe'), type: 'succes' });
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  const etatLibelle = produit ? (produit.etatStock === 'EN_STOCK' ? 'fiche.etatEnStock' : produit.etatStock === 'STOCK_FAIBLE' ? 'fiche.etatFaible' : 'fiche.etatRupture') : 'fiche.etatRupture';
  const couleurEtat = produit?.etatStock === 'RUPTURE' ? couleurs.danger : produit?.etatStock === 'STOCK_FAIBLE' ? couleurs.violet : couleurs.succes;

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      {!produit ? (
        <Text style={styles.vide}>{t('commun.chargement')}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.contenu}>
          <View style={styles.photo}><Text style={styles.photoTexte}>{t('commun.photo')}</Text></View>
          <Text style={styles.nom}>{produit.nom}</Text>
          <Text style={styles.prix}>{formatFcfa(produit.prixFcfa, langue)}</Text>
          <Text style={[styles.etat, { color: couleurEtat }]}>{t(etatLibelle as Cle)} · {produit.quantiteDisponible} {t('fiche.disponibles')}</Text>
          {produit.garantieJours ? <Text style={styles.secondaire}>{t('produit.garantie', { jours: produit.garantieJours })}</Text> : null}

          {produit.description ? <Carte><Text style={styles.description}>{produit.description}</Text></Carte> : null}

          {produit.caracteristiques.length > 0 && (
            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('fiche.caracteristiques')}</Text>
              {produit.caracteristiques.map((c, i) => (
                <View key={`${c.nom}-${i}`} style={styles.ligne}>
                  <Text style={styles.secondaire}>{c.nom}</Text>
                  <Text style={styles.texte}>{c.valeur}</Text>
                </View>
              ))}
            </Carte>
          )}

          {produit.commentaires ? (
            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('fiche.commentaires')}</Text>
              <Text style={styles.texte}>{produit.commentaires}</Text>
            </Carte>
          ) : null}

          <Carte style={{ gap: espaces.s }}>
            <Text style={styles.sousTitre}>{t('fiche.quantite')}</Text>
            <View style={styles.quantite}>
              <Pressable onPress={() => setQuantite(Math.max(1, quantite - 1))} style={styles.plusMoins} accessibilityRole="button"><Text style={styles.plusMoinsTexte}>−</Text></Pressable>
              <Text style={styles.quantiteTexte}>{quantite}</Text>
              <Pressable onPress={() => setQuantite(Math.min(QUANTITE_MAX, quantite + 1))} style={styles.plusMoins} accessibilityRole="button"><Text style={styles.plusMoinsTexte}>+</Text></Pressable>
            </View>
            {quantite > produit.quantiteDisponible && <Text style={styles.avertissement}>{t('fiche.superieur')}</Text>}
          </Carte>

          {message && <Message texte={message.texte} type={message.type} />}
          <Bouton titre={t('produit.ajouterPanier')} onPress={ajouter} chargement={chargement} desactive={!produit.enStock} />
          <Bouton titre={t('produit.ajouterListe')} variante="secondaire" onPress={ajouterListe} />
        </ScrollView>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  contenu: { padding: espaces.l, gap: espaces.m },
  photo: { height: 220, borderRadius: rayons.l, backgroundColor: couleurs.fond, alignItems: 'center', justifyContent: 'center' },
  photoTexte: { color: couleurs.texteSecondaire },
  nom: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  prix: { fontSize: 22, fontWeight: '800', color: couleurs.violet },
  etat: { fontWeight: '600' },
  secondaire: { color: couleurs.texteSecondaire },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  texte: { color: couleurs.texte, flexShrink: 1, textAlign: 'right' },
  description: { color: couleurs.texte, lineHeight: 22 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', gap: espaces.m },
  quantite: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: couleurs.bordure, borderRadius: rayons.m, alignSelf: 'flex-start' },
  plusMoins: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  plusMoinsTexte: { fontSize: 20, color: couleurs.violet, fontWeight: '700' },
  quantiteTexte: { minWidth: 36, textAlign: 'center', color: couleurs.texte, fontWeight: '700', fontSize: 16 },
  avertissement: { color: couleurs.danger, fontSize: 13 },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
