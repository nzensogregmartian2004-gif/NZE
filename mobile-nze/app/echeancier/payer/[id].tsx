// Paiement d'une échéance depuis l'application : choix de l'article, montant, opérateur, puis suivi jusqu'à confirmation.
import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../../src/api/client';
import { Bouton, Carte, Champ, Ecran, Message } from '../../../src/components/ui';
import { useI18n } from '../../../src/i18n';
import { formatFcfa } from '../../../src/lib/format';
import { montantSaisi, restantArticle, type ArticleSolde } from '../../../src/lib/echeancier-paiement';
import { couleurs, espaces, rayons } from '../../../src/theme';

type Canal = 'AIRTEL_MONEY' | 'MOOV_MONEY' | 'CARTE';
const DELAI_VERIFICATION_MS = 4000;
const TENTATIVES_MAX = 15;

export default function PayerEcheance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, langue } = useI18n();
  const [articles, setArticles] = useState<ArticleSolde[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [montantTexte, setMontantTexte] = useState('');
  const [canal, setCanal] = useState<Canal>('AIRTEL_MONEY');
  const [numero, setNumero] = useState('');
  const [chargement, setChargement] = useState(false);
  const [attente, setAttente] = useState(false);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    appeler<{ articles: ArticleSolde[] }>(`/echelonnements/${id}/echeanciers`)
      .then((d) => {
        const ouverts = d.articles.filter((a) => restantArticle(a) > 0);
        setArticles(ouverts);
        if (ouverts.length === 1) setChoisi(ouverts[0].echeancierId);
        if (ouverts.length === 0) setMessage({ texte: t('echeancier.payer.soldeNul'), type: 'succes' });
      })
      .catch(() => setMessage({ texte: t('echeancier.erreur'), type: 'erreur' }));
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [id]);

  const article = articles.find((a) => a.echeancierId === choisi) ?? null;
  const solde = article ? restantArticle(article) : 0;
  const montant = article ? montantSaisi(montantTexte, solde) : null;
  const numeroValide = /^0?\d{7,9}$/.test(numero);
  const canalMobile = canal !== 'CARTE';

  // Vérifie le paiement jusqu'à ce que le reste de l'article baisse, comme pour une commande.
  function suivre(soldeAvant: number, tentative = 0) {
    minuteur.current = setTimeout(async () => {
      try {
        await appeler(`/echelonnements/${id}/verifier-paiement`);
        const d = await appeler<{ articles: ArticleSolde[] }>(`/echelonnements/${id}/echeanciers`);
        setArticles(d.articles.filter((a) => restantArticle(a) > 0));
        const apres = d.articles.find((a) => a.echeancierId === choisi);
        if (apres && restantArticle(apres) < soldeAvant) {
          setAttente(false);
          setMessage({ texte: t('echeancier.payer.succes'), type: 'succes' });
          setMontantTexte('');
          return;
        }
      } catch {
        // Erreur réseau ponctuelle : on continue à vérifier.
      }
      if (tentative + 1 < TENTATIVES_MAX) suivre(soldeAvant, tentative + 1);
      else {
        setAttente(false);
        setMessage({ texte: t('echeancier.payer.nonConfirme'), type: 'erreur' });
      }
    }, DELAI_VERIFICATION_MS);
  }

  async function payer() {
    if (!article || montant === null) return;
    setMessage(null);
    setChargement(true);
    try {
      const corps = canal === 'CARTE'
        ? { montantFcfa: montant, echeancierId: article.echeancierId, canal: 'CARTE' }
        : { montantFcfa: montant, echeancierId: article.echeancierId, canal: 'MOBILE_MONEY', operateur: canal, numero };
      const r = await appeler<{ statut: string; urlPaiement: string | null }>(`/echelonnements/${id}/versements`, { methode: 'POST', corps });
      if (canal === 'CARTE' && r.urlPaiement) {
        setMessage({ texte: t('echeancier.payer.carteOuverte'), type: 'succes' });
        await Linking.openURL(r.urlPaiement);
      } else {
        setAttente(true);
        suivre(solde);
      }
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    } finally {
      setChargement(false);
    }
  }

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
        <Text style={styles.titre}>{t('echeancier.payer.titre')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        {articles.length > 1 && <Text style={styles.section}>{t('echeancier.payer.article')}</Text>}
        {articles.length > 1 && articles.map((a) => (
          <Pressable
            key={a.echeancierId}
            onPress={() => { setChoisi(a.echeancierId); setMontantTexte(''); }}
            style={[styles.option, choisi === a.echeancierId && styles.optionActive]}
            accessibilityRole="radio"
          >
            <Text style={[styles.optionTexte, choisi === a.echeancierId && styles.optionTexteActive]}>
              {a.nom} · {formatFcfa(restantArticle(a), langue)}
            </Text>
          </Pressable>
        ))}
        {article && (
          <>
            <Carte style={styles.total}>
              <Text style={styles.secondaire}>{t('echeancier.payer.reste', { m: solde })}</Text>
            </Carte>
            <Champ label={t('echeancier.payer.montant')} valeur={montantTexte} onChangeTexte={setMontantTexte} clavier="number-pad" />
            {montantTexte.length > 0 && montant === null && <Message texte={t('echeancier.payer.montantInvalide', { m: solde })} type="erreur" />}
            <Text style={styles.section}>{t('paiement.canal')}</Text>
            {(['AIRTEL_MONEY', 'MOOV_MONEY', 'CARTE'] as Canal[]).map((c) => (
              <Pressable key={c} onPress={() => setCanal(c)} style={[styles.option, canal === c && styles.optionActive]} accessibilityRole="radio">
                <Text style={[styles.optionTexte, canal === c && styles.optionTexteActive]}>
                  {c === 'AIRTEL_MONEY' ? t('paiement.airtel') : c === 'MOOV_MONEY' ? t('paiement.moov') : t('paiement.carte')}
                </Text>
              </Pressable>
            ))}
            {canalMobile && <Champ label={t('paiement.numero')} valeur={numero} onChangeTexte={setNumero} clavier="phone-pad" />}
          </>
        )}
        {attente && <Message texte={t('echeancier.payer.attente')} type="succes" />}
        {message && <Message texte={message.texte} type={message.type} />}
        {article && (
          <Bouton
            titre={t('echeancier.payer.valider')}
            onPress={payer}
            chargement={chargement}
            desactive={chargement || attente || montant === null || (canalMobile && !numeroValide)}
          />
        )}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s, gap: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  contenu: { padding: espaces.l, gap: espaces.m },
  total: { gap: espaces.xs, alignItems: 'center' },
  secondaire: { color: couleurs.texteSecondaire },
  section: { fontSize: 15, fontWeight: '700', color: couleurs.texte },
  option: { padding: espaces.m, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure },
  optionActive: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  optionTexte: { color: couleurs.texte },
  optionTexteActive: { color: couleurs.violet, fontWeight: '700' },
});
