import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Portefeuille { solde: number; disponible: number; enAttente: number; ventes: { montantFcfa: number; produit: string | null; reference: string }[] }
interface Retrait { id: string; montantFcfa: number; statut: string; createdAt: string }
type Operateur = 'AIRTEL_MONEY' | 'MOOV_MONEY';

interface Vente { id: string; montantFcfa: number; produit: string | null; reference: string; quantite: number | null }

export default function PortefeuillePartenaire() {
  const { t, langue } = useI18n();
  const [solde, setSolde] = useState<Portefeuille | null>(null);
  const { elements: retraits, recharger: rechargerRetraits, chargerPlus: plusRetraits, plusDisponible: plusDispoRetraits, chargement: chargementRetraits } = useListePaginee<Retrait>('/partenaire/retraits');
  const { elements: ventes, recharger: rechargerVentes, chargerPlus: plusVentes, plusDisponible: plusDispoVentes, chargement: chargementVentes } = useListePaginee<Vente>('/partenaire/ventes');
  const [montant, setMontant] = useState('');
  const [operateur, setOperateur] = useState<Operateur>('AIRTEL_MONEY');
  const [numero, setNumero] = useState('');
  const [beneficiaire, setBeneficiaire] = useState('');
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(() => {
    appeler<Portefeuille>('/partenaire/portefeuille').then(setSolde).catch(() => setSolde(null));
    rechargerRetraits();
    rechargerVentes();
  }, [rechargerRetraits, rechargerVentes]);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function demander() {
    setMessage(null);
    try {
      await appeler('/partenaire/retraits', { methode: 'POST', corps: { montantFcfa: Number(montant), operateur, numero, nomBeneficiaire: beneficiaire } });
      setMontant(''); setNumero(''); setBeneficiaire('');
      setMessage({ texte: t('portefeuille.succes'), type: 'succes' });
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  const formulaireValide = Number(montant) > 0 && /^\d{8,12}$/.test(numero) && beneficiaire.trim().length >= 2;

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('portefeuille.titre')}</Text>
        {solde && (
          <Carte style={styles.bloc}>
            <Text style={styles.legende}>{t('portefeuille.solde')}</Text>
            <Text style={styles.gros}>{formatFcfa(solde.solde, langue)}</Text>
            <Text style={styles.legende}>{t('portefeuille.disponible')} : {formatFcfa(solde.disponible, langue)}</Text>
            <Text style={styles.legende}>{t('portefeuille.enAttente')} : {formatFcfa(solde.enAttente, langue)}</Text>
          </Carte>
        )}
        <Carte style={{ gap: espaces.s }}>
          <Text style={styles.sousTitre}>{t('portefeuille.demander')}</Text>
          <Champ label={t('portefeuille.montant')} valeur={montant} onChangeTexte={setMontant} clavier="number-pad" />
          <Text style={styles.legende}>{t('portefeuille.operateur')}</Text>
          <View style={styles.pilules}>
            {(['AIRTEL_MONEY', 'MOOV_MONEY'] as Operateur[]).map((o) => (
              <Pressable key={o} onPress={() => setOperateur(o)} style={[styles.pilule, operateur === o && styles.actif]} accessibilityRole="radio">
                <Text style={[styles.pilulesTexte, operateur === o && styles.actifTexte]}>{o === 'AIRTEL_MONEY' ? t('paiement.airtel') : t('paiement.moov')}</Text>
              </Pressable>
            ))}
          </View>
          <Champ label={t('portefeuille.numero')} valeur={numero} onChangeTexte={setNumero} clavier="phone-pad" />
          <Champ label={t('portefeuille.beneficiaire')} valeur={beneficiaire} onChangeTexte={setBeneficiaire} />
          {message && <Message texte={message.texte} type={message.type} />}
          <Bouton titre={t('portefeuille.demander')} onPress={demander} desactive={!formulaireValide} />
        </Carte>
        <Text style={styles.sousTitre}>{t('portefeuille.retraits')}</Text>
        {retraits.map((r) => (
          <Carte key={r.id} style={styles.ligne}>
            <Text style={styles.nom}>{formatFcfa(r.montantFcfa, langue)}</Text>
            <Text style={styles.legende}>{t(`portefeuille.${r.statut}` as Cle)}</Text>
          </Carte>
        ))}
        <ChargerPlus visible={plusDispoRetraits} chargement={chargementRetraits} onPress={plusRetraits} />
        <Text style={styles.sousTitre}>{t('portefeuille.ventes')}</Text>
        {ventes.map((v) => (
          <Carte key={v.id} style={styles.ligne}>
            <Text style={styles.nom}>{v.produit ?? '—'}</Text>
            <Text style={styles.prix}>{formatFcfa(v.montantFcfa, langue)}</Text>
          </Carte>
        ))}
        <ChargerPlus visible={plusDispoVentes} chargement={chargementVentes} onPress={plusVentes} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  bloc: { gap: espaces.xs },
  gros: { fontSize: 26, fontWeight: '800', color: couleurs.violet },
  legende: { color: couleurs.texteSecondaire },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  pilules: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  actif: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  pilulesTexte: { color: couleurs.texte },
  actifTexte: { color: couleurs.violet, fontWeight: '700' },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { color: couleurs.texte, fontWeight: '500' },
  prix: { color: couleurs.violet, fontWeight: '700' },
});
