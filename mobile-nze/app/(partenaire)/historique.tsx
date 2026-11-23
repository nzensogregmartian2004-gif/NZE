// Historique du partenaire : ses collectes, ses ventes, son stock (en stock ou en rupture) et ses retraits.
// Chaque section charge sa liste à l'ouverture ; les données viennent des routes partenaire, sans identité du collecteur.
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler } from '../../src/api/client';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { Carte, Ecran, Message } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { formatDateHeure, formatFcfa } from '../../src/lib/format';
import { CLES_STATUT_COLLECTE, CLES_STATUT_RETRAIT, repartirStock, type ProduitStock } from '../../src/lib/historique-partenaire';
import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { couleurs, espaces } from '../../src/theme';

type Section = 'collectes' | 'ventes' | 'stock' | 'retraits' | 'echeances';
const SECTIONS: Section[] = ['collectes', 'ventes', 'stock', 'retraits', 'echeances'];

interface Collecte { id: string; reference: string; statut: string; createdAt: string; magasinNom: string | null; lignes: { id: string }[] }
interface Vente { id: string; montantFcfa: number; date: string; reference: string; produit: string | null; quantite: number | null }
interface EcheanceArticle { echeancierId: string; nom: string; principalRestantFcfa: number; moisValides: number; moisPartiels: number; moisEnRetard: number }
interface Echeance { id: string; commandeReference: string; commercantEncaisseFcfa: number; commercantAVerserFcfa: number; echeancesArticles: EcheanceArticle[] }
interface Retrait { id: string; montantFcfa: number; operateur: string; statut: string; createdAt: string }

export default function HistoriquePartenaire() {
  const { t, langue } = useI18n();
  const [section, setSection] = useState<Section>('collectes');
  const [stock, setStock] = useState<ProduitStock[] | null>(null);
  const [erreurStock, setErreurStock] = useState(false);
  const [echeances, setEcheances] = useState<Echeance[] | null>(null);
  const collectes = useListePaginee<Collecte>('/partenaire/bordereaux');
  const ventes = useListePaginee<Vente>('/partenaire/ventes');
  const retraits = useListePaginee<Retrait>('/partenaire/retraits');

  // La section ouverte est rechargée à chaque ouverture de l'écran et à chaque changement d'onglet.
  useFocusEffect(useCallback(() => {
    if (section === 'collectes') collectes.recharger();
    if (section === 'ventes') ventes.recharger();
    if (section === 'retraits') retraits.recharger();
    if (section === 'echeances') {
      appeler<Echeance[]>('/partenaire/echelonnements').then(setEcheances).catch(() => setEcheances([]));
    }
    if (section === 'stock') {
      setErreurStock(false);
      appeler<ProduitStock[]>('/partenaire/produits')
        .then(setStock)
        .catch(() => { setStock([]); setErreurStock(true); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]));

  const repartition = useMemo(() => (stock ? repartirStock(stock) : null), [stock]);

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('partHist.titre')}</Text>
        <View style={styles.onglets}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSection(s)}
              style={[styles.onglet, section === s && styles.ongletActif]}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === s }}
            >
              <Text style={[styles.ongletTexte, section === s && styles.ongletTexteActif]}>{t(`partHist.onglet.${s}` as Cle)}</Text>
            </Pressable>
          ))}
        </View>

        {section === 'collectes' && (
          <>
            {collectes.erreur && <Message texte={t('partHist.erreur')} />}
            {!collectes.chargement && !collectes.erreur && collectes.elements.length === 0 && <Text style={styles.vide}>{t('partHist.vide')}</Text>}
            {collectes.elements.map((c) => (
              <Carte key={c.id} style={styles.ligne}>
                <View style={styles.entete}>
                  <Text style={styles.principal}>{c.reference}</Text>
                  <Text style={styles.secondaire}>{formatDateHeure(c.createdAt, langue)}</Text>
                </View>
                <Text style={styles.secondaire}>
                  {t(CLES_STATUT_COLLECTE[c.statut] ?? 'partHist.statutInconnu')} · {t('partHist.articles', { n: c.lignes.length })}
                  {c.magasinNom ? ` · ${c.magasinNom}` : ''}
                </Text>
              </Carte>
            ))}
            <ChargerPlus visible={collectes.plusDisponible} chargement={collectes.chargement} onPress={collectes.chargerPlus} />
          </>
        )}

        {section === 'ventes' && (
          <>
            {ventes.erreur && <Message texte={t('partHist.erreur')} />}
            {!ventes.chargement && !ventes.erreur && ventes.elements.length === 0 && <Text style={styles.vide}>{t('partHist.vide')}</Text>}
            {ventes.elements.map((v) => (
              <Carte key={v.id} style={styles.ligne}>
                <View style={styles.entete}>
                  <Text style={styles.principal}>{v.produit ?? v.reference}</Text>
                  <Text style={styles.montant}>{formatFcfa(v.montantFcfa, langue)}</Text>
                </View>
                <Text style={styles.secondaire}>
                  {v.reference} · {formatDateHeure(v.date, langue)}{v.quantite ? ` · ${v.quantite}` : ''}
                </Text>
              </Carte>
            ))}
            <ChargerPlus visible={ventes.plusDisponible} chargement={ventes.chargement} onPress={ventes.chargerPlus} />
          </>
        )}

        {section === 'stock' && (
          <>
            {erreurStock && <Message texte={t('partHist.erreur')} />}
            {repartition && (
              <>
                <Text style={styles.sousTitre}>{t('partHist.enStock')} ({repartition.enStock.length})</Text>
                {repartition.enStock.map((p) => (
                  <Carte key={p.id} style={styles.ligne}>
                    <View style={styles.entete}>
                      <Text style={styles.principal}>{p.nom}</Text>
                      <Text style={styles.montant}>{p.disponible}</Text>
                    </View>
                  </Carte>
                ))}
                <Text style={styles.sousTitre}>{t('partHist.enRupture')} ({repartition.enRupture.length})</Text>
                {repartition.enRupture.map((p) => (
                  <Carte key={p.id} style={styles.ligne}>
                    <View style={styles.entete}>
                      <Text style={styles.principal}>{p.nom}</Text>
                      <Text style={styles.rupture}>0</Text>
                    </View>
                  </Carte>
                ))}
              </>
            )}
          </>
        )}

        {section === 'echeances' && (
          <>
            {echeances && echeances.length === 0 && <Text style={styles.vide}>{t('partHist.vide')}</Text>}
            {echeances?.map((p) => (
              <Carte key={p.id} style={styles.ligne}>
                <View style={styles.entete}>
                  <Text style={styles.principal}>{p.commandeReference}</Text>
                </View>
                <Text style={styles.secondaire}>
                  {t('partHist.ech.encaisse')} : {formatFcfa(p.commercantEncaisseFcfa, langue)} · {t('partHist.ech.attendu')} : {formatFcfa(p.commercantAVerserFcfa, langue)}
                </Text>
                {p.echeancesArticles.map((a) => (
                  <Text key={a.echeancierId} style={styles.secondaire}>
                    {a.nom} · {formatFcfa(a.principalRestantFcfa, langue)} · {t('partHist.ech.mois', { valides: a.moisValides, partiels: a.moisPartiels, retard: a.moisEnRetard })}
                  </Text>
                ))}
              </Carte>
            ))}
          </>
        )}

        {section === 'retraits' && (
          <>
            {retraits.erreur && <Message texte={t('partHist.erreur')} />}
            {!retraits.chargement && !retraits.erreur && retraits.elements.length === 0 && <Text style={styles.vide}>{t('partHist.vide')}</Text>}
            {retraits.elements.map((r) => (
              <Carte key={r.id} style={styles.ligne}>
                <View style={styles.entete}>
                  <Text style={styles.principal}>{formatFcfa(r.montantFcfa, langue)}</Text>
                  <Text style={styles.secondaire}>{formatDateHeure(r.createdAt, langue)}</Text>
                </View>
                <Text style={styles.secondaire}>
                  {t(CLES_STATUT_RETRAIT[r.statut] ?? 'partHist.statutInconnu')} · {r.operateur}
                </Text>
              </Carte>
            ))}
            <ChargerPlus visible={retraits.plusDisponible} chargement={retraits.chargement} onPress={retraits.chargerPlus} />
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, gap: espaces.s },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  onglets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  onglet: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: couleurs.bordure },
  ongletActif: { backgroundColor: couleurs.violet, borderColor: couleurs.violet },
  ongletTexte: { color: couleurs.texte, fontWeight: '600' },
  ongletTexteActif: { color: couleurs.blanc },
  sousTitre: { fontSize: 15, fontWeight: '700', color: couleurs.texte, marginTop: 8 },
  ligne: { gap: 4 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  principal: { fontSize: 15, fontWeight: '600', color: couleurs.texte, flexShrink: 1 },
  secondaire: { fontSize: 13, color: couleurs.texteSecondaire },
  montant: { fontSize: 15, fontWeight: '700', color: couleurs.violet },
  rupture: { fontSize: 15, fontWeight: '700', color: couleurs.danger },
  vide: { color: couleurs.texteSecondaire, textAlign: 'center', marginTop: 16 },
});
