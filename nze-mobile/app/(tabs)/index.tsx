import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { appeler } from '../../src/api/client';
import { API_URL } from '../../src/config';
import { useI18n } from '../../src/i18n';
import { urlPhotoProduit } from '../../src/lib/photos';
import { Carte, Ecran } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { TAILLE_PAGE, TAILLE_RANGEE, fusionnerPages, uneSuiteExiste } from '../../src/lib/pagination';
import { promotionParProduit, type Promotion } from '../../src/lib/promotions';
import { tailles, couleurs, espaces, rayons } from '../../src/theme';

interface ProduitListe { id: string; nom: string; prixFcfa: number; enStock: boolean; aPhoto?: boolean }
interface Categorie { id: string; nom: string; slug: string }
type Tri = 'nom' | 'prix-croissant' | 'prix-decroissant';

const LARGEUR_OFFRE = 300;
const ESPACE_OFFRE = espaces.m;
const DELAI_DEFILEMENT_MS = 4000;

export default function Accueil() {
  const { t, langue } = useI18n();
  const { categorie: categorieInitiale } = useLocalSearchParams<{ categorie?: string }>();
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState<string | undefined>(categorieInitiale);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [produits, setProduits] = useState<ProduitListe[]>([]);
  const [suite, setSuite] = useState(true);          // une page suivante existe-t-elle ?
  const [chargement, setChargement] = useState(false);
  const [rangees, setRangees] = useState<Record<string, ProduitListe[]>>({});
  const [enStock, setEnStock] = useState(false);
  const [tri, setTri] = useState<Tri>('nom');
  const [offres, setOffres] = useState<Promotion[]>([]);
  const requete = useRef(0);   // numéro de la dernière requête : une réponse plus ancienne est ignorée
  const recus = useRef(0);     // nombre d'articles reçus de l'API pour la liste courante (sert de décalage)
  const bandeau = useRef<FlatList<Promotion>>(null);
  const indexBandeau = useRef(0);

  const offreDuProduit = useMemo(() => promotionParProduit(offres), [offres]);

  useEffect(() => {
    appeler<Categorie[]>('/categories', { sansJeton: true }).then(setCategories).catch(() => setCategories([]));
    appeler<Promotion[]>('/promotions', { sansJeton: true }).then(setOffres).catch(() => setOffres([]));
  }, []);

  // Le bandeau d'offres défile tout seul, puis revient au début.
  useEffect(() => {
    if (offres.length < 2) return;
    const minuteur = setInterval(() => {
      const suivant = (indexBandeau.current + 1) % offres.length;
      indexBandeau.current = suivant;
      try {
        bandeau.current?.scrollToIndex({ index: suivant, animated: true });
      } catch {
        // Bandeau pas encore mesuré : le prochain défilement corrigera.
      }
    }, DELAI_DEFILEMENT_MS);
    return () => clearInterval(minuteur);
  }, [offres.length]);

  useEffect(() => {
    setCategorie(categorieInitiale);
  }, [categorieInitiale]);

  // Filtres essentiels (cahier V3.0 §7) : en stock et tri par prix.
  function parametres(extra: Record<string, string> = {}): URLSearchParams {
    const p = new URLSearchParams(extra);
    if (enStock) p.set('enStock', 'true');
    if (tri !== 'nom') p.set('tri', tri);
    return p;
  }

  // Charge une page de la liste principale. Le décalage avance à chaque page, sans limite globale.
  const chargerPage = useCallback(async (decalage: number) => {
    const numero = ++requete.current;
    setChargement(true);
    const p = parametres(recherche ? { q: recherche } : {});
    if (categorie) p.set('categorie', categorie);
    p.set('limite', String(TAILLE_PAGE));
    p.set('decalage', String(decalage));
    try {
      const page = await appeler<ProduitListe[]>(`/produits?${p.toString()}`, { sansJeton: true });
      if (numero !== requete.current) return;
      recus.current = decalage + page.length;
      setProduits((actuels) => (decalage === 0 ? fusionnerPages([], page) : fusionnerPages(actuels, page)));
      setSuite(uneSuiteExiste(page.length, TAILLE_PAGE));
    } catch {
      if (numero !== requete.current) return;
      if (decalage === 0) {
        setProduits([]);
        setSuite(false);
      }
    } finally {
      if (numero === requete.current) setChargement(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, categorie, enStock, tri]);

  // Nouvelle recherche ou nouveau filtre : on repart de la première page, après une courte pause de frappe.
  useEffect(() => {
    setSuite(true);
    const minuteur = setTimeout(() => { void chargerPage(0); }, 300);
    return () => clearTimeout(minuteur);
  }, [chargerPage]);

  // Défilement en bas de liste : page suivante, si elle existe et qu'aucune n'est déjà en route.
  function chargerSuite() {
    if (chargement || !suite || produits.length === 0) return;
    void chargerPage(recus.current);
  }

  // Rangées par catégorie : affichées quand aucune recherche ni catégorie n'est choisie.
  useEffect(() => {
    if (recherche || categorie || categories.length === 0) return;
    let actif = true;
    Promise.all(
      categories.map((c) =>
        appeler<ProduitListe[]>(`/produits?${parametres({ categorie: c.slug, limite: String(TAILLE_RANGEE) }).toString()}`, { sansJeton: true })
          .catch(() => [] as ProduitListe[])
          .then((liste) => [c.slug, liste] as const),
      ),
    ).then((paires) => { if (actif) setRangees(Object.fromEntries(paires)); });
    return () => { actif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, recherche, categorie, enStock, tri]);

  // Article : prix barré et libellé de l'offre quand il est en promotion.
  const carte = (item: ProduitListe) => {
    const offre = offreDuProduit.get(item.id);
    return (
      <Pressable onPress={() => router.push(`/produit/${item.id}`)} style={styles.cellule}>
        <Carte style={styles.carte}>
          <View style={styles.photo}>
            {item.aPhoto ? (
              <Image source={{ uri: urlPhotoProduit(API_URL, item.id) }} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <Text style={styles.photoTexte}>{t('commun.photo')}</Text>
            )}
            {offre ? <Text style={[styles.badge, styles.badgeEnHaut]}>{t('accueil.topOffre')}</Text> : null}
          </View>
          <Text style={styles.nom} numberOfLines={2}>{item.nom}</Text>
          {offre ? (
            <View style={styles.ligneprix}>
              <Text style={styles.prixBarre}>{formatFcfa(offre.prixAvantFcfa, langue)}</Text>
              <Text style={styles.prix}>{formatFcfa(offre.prixApresFcfa, langue)}</Text>
            </View>
          ) : (
            <Text style={styles.prix}>{formatFcfa(item.prixFcfa, langue)}</Text>
          )}
          <Text style={{ color: item.enStock ? couleurs.succes : couleurs.danger, fontSize: 12 }}>
            {item.enStock ? t('accueil.enStock') : t('accueil.rupture')}
          </Text>
        </Carte>
      </Pressable>
    );
  };

  // Vue d'accueil sans recherche ni catégorie : bandeau d'offres, rangées par catégorie, puis tous les articles
  // (y compris ceux sans catégorie, qui n'apparaissent dans aucune rangée).
  const vueParDefaut = !recherche && !categorie;

  const entete = vueParDefaut ? (
    <View style={styles.rangees}>
      {offres.length > 0 ? (
        <View style={styles.rangee}>
          <Text style={styles.rangeeTitre}>{t('accueil.offres')}</Text>
          <FlatList
            ref={bandeau}
            horizontal
            data={offres}
            keyExtractor={(o) => o.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={LARGEUR_OFFRE + ESPACE_OFFRE}
            decelerationRate="fast"
            contentContainerStyle={styles.rangeeListe}
            getItemLayout={(_, i) => ({ length: LARGEUR_OFFRE + ESPACE_OFFRE, offset: (LARGEUR_OFFRE + ESPACE_OFFRE) * i, index: i })}
            renderItem={({ item: o }) => (
              <Pressable onPress={() => router.push(`/produit/${o.produitId}`)} style={styles.offre}>
                <View style={styles.offreTete}>
                  <Text style={styles.badge}>{t('accueil.topOffre')} · {o.titre}</Text>
                  <Text style={styles.reduction}>{t('accueil.reduction', { p: o.pourcentage })}</Text>
                </View>
                <Text style={styles.nom} numberOfLines={2}>{o.produitNom}</Text>
                <View style={styles.ligneprix}>
                  <Text style={styles.prixBarre}>{formatFcfa(o.prixAvantFcfa, langue)}</Text>
                  <Text style={styles.prixOffre}>{formatFcfa(o.prixApresFcfa, langue)}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : null}
      {categories.map((c) => (rangees[c.slug]?.length ? (
        <View key={c.id} style={styles.rangee}>
          <View style={styles.rangeeEntete}>
            <Text style={styles.rangeeTitre}>{c.nom}</Text>
            <Pressable onPress={() => setCategorie(c.slug)}>
              <Text style={styles.voirTout}>{t('accueil.voirTout')}</Text>
            </Pressable>
          </View>
          <FlatList
            horizontal
            data={rangees[c.slug]}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rangeeListe}
            renderItem={({ item }) => <View style={styles.rangeeCellule}>{carte(item)}</View>}
          />
        </View>
      ) : null))}
      {produits.length > 0 ? <Text style={styles.titreSection}>{t('accueil.tousLesProduits')}</Text> : null}
    </View>
  ) : undefined;

  return (
    <Ecran>
      <View style={styles.entete}>
        <View style={styles.ligneRecherche}>
          <TextInput
            value={recherche}
            onChangeText={setRecherche}
            placeholder={t('accueil.recherche')}
            placeholderTextColor={couleurs.texteSecondaire}
            style={styles.recherche}
            autoCapitalize="none"
          />
          <Pressable onPress={() => router.push('/adresses')} accessibilityRole="button" accessibilityLabel={t('accueil.localisation')} style={styles.localisation}>
            <Text style={styles.localisationIcone}>📍</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/recherche-photo')} accessibilityRole="button" accessibilityLabel={t('recherche.photo.titre')} style={styles.localisation}>
            <Text style={styles.localisationIcone}>📷</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable onPress={() => setCategorie(undefined)} style={[styles.chip, !categorie && styles.chipActif]}>
          <Text style={[styles.chipTexte, !categorie && styles.chipTexteActif]}>{t('accueil.recommandes')}</Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable key={c.id} onPress={() => setCategorie(c.slug)} style={[styles.chip, categorie === c.slug && styles.chipActif]}>
            <Text style={[styles.chipTexte, categorie === c.slug && styles.chipTexteActif]}>{c.nom}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable onPress={() => setEnStock((v) => !v)} style={[styles.chip, enStock && styles.chipActif]}>
          <Text style={[styles.chipTexte, enStock && styles.chipTexteActif]}>{t('accueil.enStock')}</Text>
        </Pressable>
        <Pressable onPress={() => setTri(tri === 'prix-croissant' ? 'nom' : 'prix-croissant')} style={[styles.chip, tri === 'prix-croissant' && styles.chipActif]}>
          <Text style={[styles.chipTexte, tri === 'prix-croissant' && styles.chipTexteActif]}>{t('accueil.trierPrixCroissant')}</Text>
        </Pressable>
        <Pressable onPress={() => setTri(tri === 'prix-decroissant' ? 'nom' : 'prix-decroissant')} style={[styles.chip, tri === 'prix-decroissant' && styles.chipActif]}>
          <Text style={[styles.chipTexte, tri === 'prix-decroissant' && styles.chipTexteActif]}>{t('accueil.trierPrixDecroissant')}</Text>
        </Pressable>
      </ScrollView>

      <FlatList
        data={produits}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.ligne}
        contentContainerStyle={styles.liste}
        ListHeaderComponent={entete}
        ListEmptyComponent={chargement ? undefined : <Text style={styles.vide}>{t('accueil.vide')}</Text>}
        ListFooterComponent={chargement ? <ActivityIndicator color={couleurs.violet} style={styles.attente} /> : undefined}
        onEndReached={chargerSuite}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => carte(item)}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { padding: espaces.l, paddingBottom: espaces.s },
  ligneRecherche: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  recherche: { flex: 1, height: tailles.champHauteur, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure, paddingHorizontal: espaces.l, fontSize: 16, color: couleurs.texte },
  localisation: { width: tailles.champHauteur, height: tailles.champHauteur, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure, alignItems: 'center', justifyContent: 'center' },
  localisationIcone: { fontSize: 18 },
  chips: { paddingHorizontal: espaces.l, gap: espaces.s, paddingBottom: espaces.m },
  chip: { paddingHorizontal: espaces.m, height: 36, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure, justifyContent: 'center' },
  chipActif: { backgroundColor: couleurs.violet, borderColor: couleurs.violet },
  chipTexte: { color: couleurs.texte },
  chipTexteActif: { color: couleurs.blanc, fontWeight: '700' },
  liste: { padding: espaces.m, gap: espaces.m },
  ligne: { gap: espaces.m },
  cellule: { flex: 1 },
  carte: { flex: 1, gap: espaces.s },
  photo: { height: 110, borderRadius: rayons.s, backgroundColor: couleurs.fond, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  badgeEnHaut: { position: 'absolute', top: 6, left: 6 },
  photoTexte: { color: couleurs.texteSecondaire, fontSize: 12 },
  badge: { alignSelf: 'flex-start', backgroundColor: couleurs.danger, color: couleurs.blanc, fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  nom: { color: couleurs.texte, fontWeight: '500' },
  ligneprix: { flexDirection: 'row', alignItems: 'baseline', gap: espaces.s, flexWrap: 'wrap' },
  prix: { color: couleurs.violet, fontWeight: '700' },
  prixBarre: { color: couleurs.texteSecondaire, textDecorationLine: 'line-through', fontSize: 13 },
  prixOffre: { color: couleurs.danger, fontWeight: '800', fontSize: 16 },
  reduction: { color: couleurs.danger, fontWeight: '800' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
  attente: { paddingVertical: espaces.l },
  rangees: { paddingBottom: espaces.m, gap: espaces.l },
  rangee: { gap: espaces.s },
  rangeeEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: espaces.l },
  rangeeTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte, paddingHorizontal: espaces.l },
  voirTout: { color: couleurs.violet, fontWeight: '600' },
  rangeeListe: { paddingHorizontal: espaces.l, gap: ESPACE_OFFRE },
  rangeeCellule: { width: 160 },
  offre: { width: LARGEUR_OFFRE, padding: espaces.m, gap: espaces.s, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.blanc },
  offreTete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaces.s },
  titreSection: { fontSize: 16, fontWeight: '700', color: couleurs.texte, paddingHorizontal: espaces.l },
});
