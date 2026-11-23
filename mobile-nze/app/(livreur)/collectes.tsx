import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { formatDateHeure } from '../../src/lib/format';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { couleurs, espaces } from '../../src/theme';

interface ArticleARecuperer {
  ligneCommandeId: string;
  produitId: string;
  nomArticle: string;
  quantite: number;
  livraisonId: string;
  commandeId: string;
  commandeReference: string;
  entrepriseId: string;
  magasinId: string | null;
  magasinNom: string | null;
  magasinAdresse: string | null;
  entrepriseNom: string;
}
interface CollecteHistorique {
  id: string;
  reference: string;
  statut: string;
  entrepriseNom: string;
  magasinNom: string;
  magasinAdresse: string | null;
  createdAt: string;
  partenaireConfirmeLe: string | null;
  lignes: { id: string; nomArticle: string; quantite: number }[];
}

const libelleStatut: Record<string, string> = {
  ATTENTE_PARTENAIRE: 'livreurCollectes.statut.ATTENTE_PARTENAIRE',
  ATTENTE_VALIDATION_NZE: 'livreurCollectes.statut.ATTENTE_VALIDATION_NZE',
  CONTESTE: 'livreurCollectes.statut.CONTESTE',
  VALIDE: 'livreurCollectes.statut.VALIDE',
  REFUSE: 'livreurCollectes.statut.REFUSE',
  ANNULE: 'livreurCollectes.statut.ANNULE',
};

export default function CollectesLivreur() {
  const { t, langue } = useI18n();
  const [articles, setArticles] = useState<ArticleARecuperer[]>([]);
  const { elements: historique, recharger, chargerPlus, plusDisponible, chargement: chargementHistorique } = useListePaginee<CollecteHistorique>('/livreur/bordereaux');
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(async () => {
    const a = await appeler<ArticleARecuperer[]>('/livreur/articles-a-recuperer');
    setArticles(a);
    recharger();
  }, [recharger]);

  useFocusEffect(useCallback(() => { charger().catch(() => setMessage({ texte: t('livreurCollectes.erreurCharger'), type: 'erreur' })); }, [charger]));

  async function signaler(article: ArticleARecuperer) {
    setActionId(article.ligneCommandeId);
    setMessage(null);
    try {
      await appeler('/livreur/bordereaux', {
        methode: 'POST',
        corps: {
          entrepriseId: article.entrepriseId,
          etablissementId: article.magasinId ?? undefined,
          commentaire: `Récupération signalée pour la commande ${article.commandeReference}`,
          lignes: [{
            produitId: article.produitId,
            ligneCommandeId: article.ligneCommandeId,
            quantite: article.quantite,
            etat: t('livreurCollectes.recupere'),
            testEffectue: false,
            controle: 'CONFORME',
          }],
        },
      });
      setMessage({ texte: `Récupération de « ${article.nomArticle} » enregistrée. Le commerçant a été notifié.`, type: 'succes' });
      try { await charger(); } catch { /* Le signalement est déjà enregistré côté serveur. */ }
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('livreurCollectes.erreurEnregistrer'), type: 'erreur' });
    } finally {
      setActionId(null);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>Récupérations chez les commerçants</Text>
        <Text style={styles.intro}>Sélectionnez l’article que vous venez de récupérer. La date et l’heure seront enregistrées automatiquement et le commerçant recevra une notification.</Text>
        {message && <Message texte={message.texte} type={message.type} />}

        <Text style={styles.section}>Articles à récupérer</Text>
        {articles.length === 0 && <Text style={styles.vide}>Aucun article affecté à récupérer pour le moment.</Text>}
        {articles.map((a) => (
          <Carte key={a.ligneCommandeId} style={styles.carte}>
            <Text style={styles.article}>{a.nomArticle} · Qté {a.quantite}</Text>
            <Text style={styles.magasin}>{a.magasinNom ?? a.entrepriseNom}</Text>
            {!!a.magasinAdresse && <Text style={styles.secondaire}>{a.magasinAdresse}</Text>}
            <Text style={styles.secondaire}>Commerçant : {a.entrepriseNom}</Text>
            {!a.magasinId && <Text style={styles.alerte}>Magasin non renseigné sur cet article. Contactez NZE.</Text>}
            <Text style={styles.secondaire}>Commande : {a.commandeReference}</Text>
            <Bouton titre={t('livreurCollectes.signaler')} onPress={() => signaler(a)} chargement={actionId === a.ligneCommandeId} desactive={!a.magasinId || (actionId !== null && actionId !== a.ligneCommandeId)} />
          </Carte>
        ))}

        <Text style={styles.section}>Historique des récupérations signalées</Text>
        {historique.length === 0 && <Text style={styles.vide}>Aucune récupération signalée.</Text>}
        {historique.map((c) => (
          <Carte key={c.id} style={styles.carte}>
            <View style={styles.entete}>
              <Text style={styles.article}>{c.reference}</Text>
              <Text style={styles.statut}>{t((libelleStatut[c.statut] ?? c.statut) as Cle)}</Text>
            </View>
            <Text style={styles.magasin}>{c.magasinNom ?? c.entrepriseNom}</Text>
            <Text style={styles.secondaire}>{formatDateHeure(c.createdAt, langue)}</Text>
            {c.lignes.map((l) => <Text key={l.id} style={styles.secondaire}>• {l.nomArticle} · Qté {l.quantite}</Text>)}
            {c.partenaireConfirmeLe && <Text style={styles.confirme}>{t('livreurCollectes.confirmeeRemise', { date: formatDateHeure(c.partenaireConfirmeLe, langue) })}</Text>}
          </Carte>
        ))}
      <ChargerPlus visible={plusDisponible} chargement={chargementHistorique} onPress={chargerPlus} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '800', color: couleurs.texte },
  intro: { color: couleurs.texteSecondaire, lineHeight: 21 },
  section: { fontSize: 16, fontWeight: '800', color: couleurs.texte, marginTop: espaces.s },
  carte: { gap: espaces.s },
  article: { color: couleurs.texte, fontWeight: '700', fontSize: 15 },
  magasin: { color: couleurs.violet, fontWeight: '700' },
  secondaire: { color: couleurs.texteSecondaire },
  statut: { color: couleurs.violet, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', gap: espaces.s },
  confirme: { color: couleurs.succes, fontWeight: '600' },
  alerte: { color: couleurs.danger, fontWeight: '600' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, paddingVertical: espaces.m },
});
