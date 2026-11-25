// Promotions : créer une réduction sur un article, voir les offres en cours et à venir, arrêter ou supprimer.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { periodeValide, pourcentageValide, statutPromotion } from '../../src/lib/promotions-admin';
import { couleurs, espaces, rayons } from '../../src/theme';

interface PromotionAdmin { id: string; titre: string; pourcentage: number; debut: string; fin: string; produitId: string; produitNom: string; prixFcfa: number }
interface ProduitChoix { id: string; nom: string; prixFcfa: number }

export default function Promotions() {
  const { t, langue } = useI18n();
  const [promotions, setPromotions] = useState<PromotionAdmin[]>([]);
  const [produits, setProduits] = useState<ProduitChoix[]>([]);
  const [produitId, setProduitId] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [pourcentage, setPourcentage] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(() => {
    appeler<PromotionAdmin[]>('/admin/promotions').then(setPromotions).catch(() => setPromotions([]));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  useEffect(() => {
    appeler<ProduitChoix[]>('/produits?limite=100', { sansJeton: true }).then(setProduits).catch(() => setProduits([]));
  }, []);

  const formulaireValide = produitId !== null && titre.trim().length >= 2 && pourcentageValide(pourcentage) && periodeValide(debut, fin);

  async function creer() {
    if (!formulaireValide) return setMessage({ texte: t('admin.promo.invalide'), type: 'erreur' });
    setMessage(null);
    try {
      await appeler('/admin/promotions', { methode: 'POST', corps: { produitId, titre: titre.trim(), pourcentage: Number(pourcentage), debut, fin } });
      setTitre(''); setPourcentage(''); setDebut(''); setFin(''); setProduitId(null);
      setMessage({ texte: t('admin.promo.creee'), type: 'succes' });
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  async function arreter(id: string) {
    await appeler(`/admin/promotions/${id}`, { methode: 'PATCH', corps: { arreter: true } }).catch(() => undefined);
    charger();
  }

  async function supprimer(id: string) {
    await appeler(`/admin/promotions/${id}`, { methode: 'DELETE' }).catch(() => undefined);
    charger();
  }

  const libelleStatut = (s: string) => (s === 'EN_COURS' ? t('admin.promo.enCours') : s === 'A_VENIR' ? t('admin.promo.aVenir') : t('admin.promo.terminee'));

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        {message && <Message texte={message.texte} type={message.type} />}

        <Carte style={styles.bloc}>
          <Text style={styles.titre}>{t('admin.promo.nouvelle')}</Text>
          <Text style={styles.libelle}>{t('admin.promo.article')}</Text>
          <View style={styles.choix}>
            {produits.map((p) => (
              <Pressable key={p.id} onPress={() => setProduitId(p.id)} style={[styles.puce, produitId === p.id && styles.puceActive]}>
                <Text style={[styles.puceTexte, produitId === p.id && styles.puceTexteActive]}>{p.nom}</Text>
              </Pressable>
            ))}
          </View>
          <Champ label={t('admin.promo.libelle')} valeur={titre} onChangeTexte={setTitre} />
          <Champ label={t('admin.promo.pourcentage')} valeur={pourcentage} onChangeTexte={setPourcentage} clavier="number-pad" />
          <Champ label={t('admin.promo.debut')} valeur={debut} onChangeTexte={setDebut} />
          <Champ label={t('admin.promo.fin')} valeur={fin} onChangeTexte={setFin} />
          <Bouton titre={t('admin.promo.creer')} onPress={creer} desactive={!formulaireValide} />
        </Carte>

        <Text style={styles.titre}>{t('admin.promo.liste')}</Text>
        {promotions.length === 0 && <Text style={styles.vide}>{t('admin.promo.vide')}</Text>}
        {promotions.map((p) => {
          const statut = statutPromotion(p.debut, p.fin);
          return (
            <Carte key={p.id} style={styles.bloc}>
              <Text style={styles.nom}>{p.titre} · -{p.pourcentage} %</Text>
              <Text style={styles.secondaire}>{p.produitNom} · {formatFcfa(p.prixFcfa, langue)} → {formatFcfa(Math.round((p.prixFcfa * (100 - p.pourcentage)) / 100), langue)}</Text>
              <Text style={styles.secondaire}>{p.debut} → {p.fin} · {libelleStatut(statut)}</Text>
              <View style={styles.actions}>
                {statut !== 'TERMINEE' ? (
                  <Pressable onPress={() => arreter(p.id)} accessibilityRole="button"><Text style={styles.lien}>{t('admin.promo.arreter')}</Text></Pressable>
                ) : null}
                <Pressable onPress={() => supprimer(p.id)} accessibilityRole="button"><Text style={styles.supprimer}>{t('admin.promo.supprimer')}</Text></Pressable>
              </View>
            </Carte>
          );
        })}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  bloc: { gap: espaces.s },
  titre: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  libelle: { color: couleurs.texteSecondaire, fontSize: 13 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  puce: { paddingHorizontal: espaces.m, paddingVertical: 6, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  puceActive: { backgroundColor: couleurs.violet, borderColor: couleurs.violet },
  puceTexte: { color: couleurs.texte },
  puceTexteActive: { color: couleurs.blanc, fontWeight: '700' },
  nom: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire, fontSize: 13 },
  actions: { flexDirection: 'row', gap: espaces.l, marginTop: espaces.s },
  lien: { color: couleurs.violet, fontWeight: '600' },
  supprimer: { color: couleurs.danger, fontWeight: '600' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire },
});
