import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { formatDateHeure } from '../../src/lib/format';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { couleurs, espaces } from '../../src/theme';

interface CollecteAdmin {
  id: string;
  reference: string;
  statut: string;
  entrepriseNom: string;
  magasinNom: string;
  magasinAdresse: string | null;
  livreurNom: string | null;
  createdAt: string;
  partenaireConfirmeLe: string | null;
  contesteLe: string | null;
  motifContestation: string | null;
  valideLe: string | null;
  motifRefus: string | null;
  lignes: { id: string; nomArticle: string; quantite: number }[];
}
const FILTRES = [
  { valeur: '', titre: 'collectesAdmin.filtre.toutes' },
  { valeur: 'ATTENTE_PARTENAIRE', titre: 'collectesAdmin.filtre.confirmer' },
  { valeur: 'ATTENTE_VALIDATION_NZE', titre: 'collectesAdmin.filtre.valider' },
  { valeur: 'CONTESTE', titre: 'collectesAdmin.filtre.contestees' },
  { valeur: 'VALIDE', titre: 'collectesAdmin.filtre.validees' },
  { valeur: 'REFUSE', titre: 'collectesAdmin.filtre.refusees' },
];
const STATUTS: Record<string, string> = {
  ATTENTE_PARTENAIRE: 'collectesAdmin.statut.ATTENTE_PARTENAIRE',
  ATTENTE_VALIDATION_NZE: 'collectesAdmin.statut.ATTENTE_VALIDATION_NZE',
  CONTESTE: 'collectesAdmin.statut.CONTESTE',
  VALIDE: 'collectesAdmin.statut.VALIDE',
  REFUSE: 'collectesAdmin.statut.REFUSE',
  ANNULE: 'collectesAdmin.statut.ANNULE',
};

export default function CollectesAdmin() {
  const { t, langue } = useI18n();
  const { utilisateur } = useSession();
  const [filtre, setFiltre] = useState('');
  const { elements: liste, recharger, chargerPlus, plusDisponible, chargement } = useListePaginee<CollecteAdmin>(filtre ? `/admin/bordereaux?statut=${filtre}` : '/admin/bordereaux');
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [refusOuvert, setRefusOuvert] = useState<string | null>(null);
  const [chargementId, setChargementId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);
  const estPrincipal = utilisateur?.role === 'admin_principal';

  const charger = recharger;
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function decider(id: string, valider: boolean) {
    const motif = motifs[id]?.trim() ?? '';
    if (!valider && motif.length < 5) {
      setMessage({ texte: t('collectesAdmin.motifRefusMin'), type: 'erreur' });
      return;
    }
    setChargementId(id);
    setMessage(null);
    try {
      await appeler(`/admin/bordereaux/${id}/decision`, {
        methode: 'POST',
        corps: valider ? { valider: true } : { valider: false, motif },
      });
      setMessage({ texte: valider ? t('collectesAdmin.valideeOk') : t('collectesAdmin.refuseeOk'), type: 'succes' });
      setRefusOuvert(null);
      setMotifs((m) => ({ ...m, [id]: '' }));
      try { await charger(); } catch { /* La décision est déjà enregistrée côté serveur. */ }
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('collectesAdmin.decisionKo'), type: 'erreur' });
    } finally {
      setChargementId(null);
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('collectesAdmin.titre')}</Text>
        <Text style={styles.intro}>{t('collectesAdmin.intro')}</Text>
        {message && <Message texte={message.texte} type={message.type} />}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtres}>
          {FILTRES.map((f) => (
            <Text key={f.valeur} onPress={() => setFiltre(f.valeur)} style={[styles.filtre, filtre === f.valeur && styles.filtreActif]}>{t(f.titre as Cle)}</Text>
          ))}
        </ScrollView>
        {liste.length === 0 && <Text style={styles.vide}>{t('collectesAdmin.vide')}</Text>}
        {liste.map((c) => (
          <Carte key={c.id} style={styles.carte}>
            <View style={styles.entete}>
              <Text style={styles.reference}>{c.reference}</Text>
              <Text style={styles.statut}>{t((STATUTS[c.statut] ?? c.statut) as Cle)}</Text>
            </View>
            <Text style={styles.magasin}>{c.magasinNom ?? c.entrepriseNom}</Text>
            {!!c.magasinAdresse && <Text style={styles.secondaire}>{c.magasinAdresse}</Text>}
            <Text style={styles.secondaire}>{t('collectesAdmin.commercant', { nom: c.entrepriseNom })}</Text>
            <Text style={styles.secondaire}>{t('collectesAdmin.livreur', { nom: c.livreurNom ?? '—' })}</Text>
            <Text style={styles.secondaire}>{t('collectesAdmin.signaleeLe', { date: formatDateHeure(c.createdAt, langue) })}</Text>
            {c.lignes.map((l) => <Text key={l.id} style={styles.article}>{t('collectesAdmin.article', { nom: l.nomArticle, quantite: l.quantite })}</Text>)}
            {c.partenaireConfirmeLe
              ? <Text style={styles.confirme}>{t('collectesAdmin.confirmeeLe', { date: formatDateHeure(c.partenaireConfirmeLe, langue) })}</Text>
              : c.contesteLe
                ? <Text style={styles.alerte}>{t('collectesAdmin.contesteeLe', { date: formatDateHeure(c.contesteLe, langue) })}</Text>
                : <Text style={styles.secondaire}>{t('collectesAdmin.attenteReponse')}</Text>}
            {!!c.motifContestation && <Text style={styles.alerte}>{t('collectesAdmin.motifContestation', { motif: c.motifContestation ?? '' })}</Text>}
            {!!c.valideLe && <Text style={styles.confirme}>{t('collectesAdmin.valideeLe', { date: formatDateHeure(c.valideLe, langue) })}</Text>}
            {!!c.motifRefus && <Text style={styles.alerte}>{t('collectesAdmin.motifRefus', { motif: c.motifRefus ?? '' })}</Text>}
            {estPrincipal && ['ATTENTE_VALIDATION_NZE', 'CONTESTE'].includes(c.statut) && (
              <View style={styles.actions}>
                <Bouton titre={t('collectesAdmin.boutonValider')} onPress={() => decider(c.id, true)} chargement={chargementId === c.id} desactive={chargementId !== null && chargementId !== c.id} />
                {refusOuvert === c.id ? (
                  <>
                    <TextInput value={motifs[c.id] ?? ''} onChangeText={(v) => setMotifs((m) => ({ ...m, [c.id]: v }))} placeholder="Motif obligatoire du refus" multiline style={styles.champ} />
                    <Bouton titre={t('collectesAdmin.boutonConfirmerRefus')} variante="danger" onPress={() => decider(c.id, false)} chargement={chargementId === c.id} />
                    <Bouton titre={t('commun.annuler')} variante="secondaire" onPress={() => setRefusOuvert(null)} />
                  </>
                ) : <Bouton titre={t('collectesAdmin.boutonRefuser')} variante="danger" onPress={() => setRefusOuvert(c.id)} desactive={chargementId !== null} />}
              </View>
            )}
          </Carte>
        ))}
        <ChargerPlus visible={plusDisponible} chargement={chargement} onPress={chargerPlus} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '800', color: couleurs.texte },
  intro: { color: couleurs.texteSecondaire, lineHeight: 21 },
  filtres: { gap: espaces.s, paddingVertical: espaces.xs },
  filtre: { borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 24, paddingHorizontal: espaces.m, paddingVertical: espaces.s, color: couleurs.texte },
  filtreActif: { borderColor: couleurs.violet, color: couleurs.violet, backgroundColor: couleurs.violetClair, fontWeight: '700' },
  carte: { gap: espaces.s },
  entete: { flexDirection: 'row', justifyContent: 'space-between', gap: espaces.s },
  reference: { color: couleurs.texte, fontWeight: '800' },
  statut: { color: couleurs.violet, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  magasin: { color: couleurs.violet, fontWeight: '800', fontSize: 16 },
  secondaire: { color: couleurs.texteSecondaire },
  article: { color: couleurs.texte, fontWeight: '600' },
  confirme: { color: couleurs.succes, fontWeight: '600' },
  alerte: { color: couleurs.danger, fontWeight: '600' },
  actions: { gap: espaces.s, marginTop: espaces.xs },
  champ: { minHeight: 76, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 10, padding: espaces.m, color: couleurs.texte, textAlignVertical: 'top' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, paddingVertical: espaces.l },
});
