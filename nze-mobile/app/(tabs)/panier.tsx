import { useSession } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { ConnexionRequise } from '../../src/components/ConnexionRequise';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { enregistrerLignes, lirePanier, type Livraison, type Panier } from '../../src/api/panier';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces, rayons } from '../../src/theme';

interface LigneAffichee { produitId: string; quantite: number; montant: number; nom: string }
interface Adresse { id: string; libelle: string; quartier: string; latitude: number; longitude: number }
type Reception = 'RETRAIT' | 'LIVRAISON';

function PanierEcran() {
  const { t, langue } = useI18n();
  const [panier, setPanier] = useState<Panier | null>(null);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [adresses, setAdresses] = useState<Adresse[]>([]);
  const [reception, setReception] = useState<Reception>('RETRAIT');
  const [adresseId, setAdresseId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const p = await lirePanier();
      setPanier(p);
      if (p) setReception(p.reception === 'LIVRAISON' ? 'LIVRAISON' : 'RETRAIT');
      if (p) {
        const entrees = await Promise.all(p.lignes.map(async (l) => {
          const produit = await appeler<{ nom: string }>(`/produits/${l.produitId}`, { sansJeton: true }).catch(() => ({ nom: '—' }));
          return [l.produitId, produit.nom] as const;
        }));
        setNoms(Object.fromEntries(entrees));
      }
      const liste = await appeler<Adresse[]>('/adresses').catch(() => [] as Adresse[]);
      setAdresses(liste);
      if (!adresseId && liste.length > 0) setAdresseId(liste[0].id);
    } catch {
      setErreur(t('commun.erreur'));
    }
    // Chargement à chaque retour sur l'écran. La sélection d'adresse est conservée par ailleurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  const adresseChoisie = adresses.find((a) => a.id === adresseId) ?? null;
  const livraisonCourante: Livraison | undefined = reception === 'LIVRAISON' && adresseChoisie
    ? { latitude: adresseChoisie.latitude, longitude: adresseChoisie.longitude }
    : undefined;

  async function appliquer(lignes: { produitId: string; quantite: number }[], nouvelleReception: Reception, livraison?: Livraison) {
    try {
      setErreur(null);
      setPanier(await enregistrerLignes(lignes, nouvelleReception, livraison));
    } catch {
      setErreur(t('commun.erreur'));
    }
  }

  async function changerQuantite(produitId: string, delta: number) {
    if (!panier) return;
    const lignes = panier.lignes
      .map((l) => ({ produitId: l.produitId, quantite: l.produitId === produitId ? l.quantite + delta : l.quantite }))
      .filter((l) => l.quantite > 0);
    await appliquer(lignes, reception, livraisonCourante);
  }

  async function choisirReception(r: Reception) {
    setReception(r);
    if (!panier) return;
    const lignes = panier.lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite }));
    if (r === 'RETRAIT') await appliquer(lignes, 'RETRAIT');
    else if (adresseChoisie) await appliquer(lignes, 'LIVRAISON', { latitude: adresseChoisie.latitude, longitude: adresseChoisie.longitude });
  }

  async function choisirAdresse(id: string) {
    setAdresseId(id);
    if (!panier || reception !== 'LIVRAISON') return;
    const a = adresses.find((x) => x.id === id);
    if (!a) return;
    const lignes = panier.lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite }));
    await appliquer(lignes, 'LIVRAISON', { latitude: a.latitude, longitude: a.longitude });
  }

  const lignes: LigneAffichee[] = (panier?.lignes ?? []).map((l) => ({ produitId: l.produitId, quantite: l.quantite, montant: l.montantLigneFcfa, nom: noms[l.produitId] ?? '—' }));
  const livraisonIncomplete = reception === 'LIVRAISON' && !adresseChoisie;

  return (
    <Ecran>
      <Text style={styles.titre}>{t('panier.titre')}</Text>
      {erreur && <View style={styles.marge}><Message texte={erreur} /></View>}
      <FlatList
        data={lignes}
        keyExtractor={(l) => l.produitId}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={<Text style={styles.vide}>{t('panier.vide')}</Text>}
        renderItem={({ item }) => (
          <Carte style={styles.ligne}>
            <View style={{ flex: 1, gap: espaces.xs }}>
              <Text style={styles.nom}>{item.nom}</Text>
              <Text style={styles.prix}>{formatFcfa(item.montant, langue)}</Text>
            </View>
            <View style={styles.quantite} accessibilityLabel={t('panier.quantite')}>
              <Pressable onPress={() => changerQuantite(item.produitId, -1)} style={styles.plusMoins} accessibilityRole="button"><Text style={styles.plusMoinsTexte}>−</Text></Pressable>
              <Text style={styles.quantiteTexte}>{item.quantite}</Text>
              <Pressable onPress={() => changerQuantite(item.produitId, 1)} style={styles.plusMoins} accessibilityRole="button"><Text style={styles.plusMoinsTexte}>+</Text></Pressable>
            </View>
          </Carte>
        )}
        ListFooterComponent={panier ? (
          <Carte style={styles.bloc}>
            <View style={styles.choix}>
              <Pressable onPress={() => choisirReception('RETRAIT')} style={[styles.option, reception === 'RETRAIT' && styles.optionActive]} accessibilityRole="radio">
                <Text style={[styles.optionTexte, reception === 'RETRAIT' && styles.optionTexteActive]}>{t('panier.retrait')}</Text>
              </Pressable>
              <Pressable onPress={() => choisirReception('LIVRAISON')} style={[styles.option, reception === 'LIVRAISON' && styles.optionActive]} accessibilityRole="radio">
                <Text style={[styles.optionTexte, reception === 'LIVRAISON' && styles.optionTexteActive]}>{t('panier.livraison')}</Text>
              </Pressable>
            </View>
            {reception === 'LIVRAISON' && (
              <View style={styles.adresses}>
                <Text style={styles.sousTitre}>{t('panier.adresse')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adressesLigne}>
                  {adresses.map((a) => (
                    <Pressable key={a.id} onPress={() => choisirAdresse(a.id)} style={[styles.pilule, adresseId === a.id && styles.optionActive]} accessibilityRole="radio">
                      <Text style={[styles.optionTexte, adresseId === a.id && styles.optionTexteActive]}>{a.libelle} · {a.quartier}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable onPress={() => router.push('/adresses')} accessibilityRole="button">
                  <Text style={styles.lien}>{t('panier.ajouterAdresse')}</Text>
                </Pressable>
                {livraisonIncomplete && <Text style={styles.avertissement}>{t('panier.adresseManquante')}</Text>}
              </View>
            )}
          </Carte>
        ) : undefined}
      />
      {panier && (
        <View style={styles.pied}>
          <View style={styles.totalLigne}>
            <Text style={styles.totalLabel}>{t('panier.total')}</Text>
            <Text style={styles.totalMontant}>{formatFcfa(panier.totalFcfa, langue)}</Text>
          </View>
          <Bouton titre={t('panier.payer')} onPress={() => router.push('/paiement')} desactive={lignes.length === 0 || livraisonIncomplete} />
        </View>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, padding: espaces.l },
  marge: { paddingHorizontal: espaces.l },
  liste: { padding: espaces.l, gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  nom: { fontSize: 15, color: couleurs.texte, fontWeight: '500' },
  prix: { color: couleurs.violet, fontWeight: '700' },
  quantite: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: couleurs.bordure, borderRadius: rayons.m },
  plusMoins: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  plusMoinsTexte: { fontSize: 18, color: couleurs.violet, fontWeight: '700' },
  quantiteTexte: { minWidth: 24, textAlign: 'center', color: couleurs.texte, fontWeight: '600' },
  bloc: { gap: espaces.m, marginTop: espaces.s },
  choix: { flexDirection: 'row', gap: espaces.s },
  option: { flex: 1, padding: espaces.m, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure, alignItems: 'center' },
  optionActive: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  optionTexte: { color: couleurs.texte },
  optionTexteActive: { color: couleurs.violet, fontWeight: '700' },
  adresses: { gap: espaces.s },
  sousTitre: { fontWeight: '600', color: couleurs.texte },
  adressesLigne: { gap: espaces.s },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  lien: { color: couleurs.violet, fontWeight: '600' },
  avertissement: { color: couleurs.danger },
  pied: { padding: espaces.l, gap: espaces.m, borderTopWidth: 1, borderTopColor: couleurs.bordure },
  totalLigne: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16, color: couleurs.texte },
  totalMontant: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});

export default function PanierEcranAccueil() {
  const { statut } = useSession();
  const { t } = useI18n();
  if (statut === 'deconnecte') return <ConnexionRequise titre={t('auth.requise.panier')} />;
  return <PanierEcran />;
}
