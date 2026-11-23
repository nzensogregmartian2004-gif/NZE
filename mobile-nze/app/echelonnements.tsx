import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { appeler, ApiError } from '../src/api/client';
import { lirePanier, type Panier } from '../src/api/panier';
import { useI18n } from '../src/i18n';
import type { Cle } from '../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran, Message } from '../src/components/ui';
import { formatFcfa } from '../src/lib/format';
import { couleurs, espaces, rayons } from '../src/theme';

interface Versement { id: string; type: string; montantFcfa: number; statut: string }
interface Plan {
  id: string; commandeReference: string; statut: string; totalFcfa: number; payeFcfa: number; restantFcfa: number;
  dueCetteEcheanceFcfa: number; enRetard: boolean; versements: Versement[];
}
type Operateur = 'AIRTEL_MONEY' | 'MOOV_MONEY';
const STATUT: Record<string, Cle> = { PROPOSE: 'echelon.statut.PROPOSE', ACTIF: 'echelon.statut.ACTIF', SOLDE: 'echelon.statut.SOLDE', ANNULE: 'echelon.statut.ANNULE' };

export default function Echelonnements() {
  const { t, langue } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [panier, setPanier] = useState<Panier | null>(null);
  const [actif, setActif] = useState(false);
  const [mensualite, setMensualite] = useState('');
  const [montant, setMontant] = useState('');
  const [numero, setNumero] = useState('');
  const [operateur, setOperateur] = useState<Operateur>('AIRTEL_MONEY');
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(() => {
    appeler<Plan[]>('/echelonnements').then(setPlans).catch(() => setPlans([]));
    appeler<{ actif: boolean }>('/echelonnement/etat').then((etat) => setActif(etat.actif)).catch(() => setActif(false));
    lirePanier().then(setPanier).catch(() => setPanier(null));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function agir(action: () => Promise<unknown>, succes: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ texte: succes, type: 'succes' });
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }
  const paiementMobile = { canal: 'MOBILE_MONEY', operateur, numero };

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titrePage}>{t('echelon.titre')}</Text>
        {message ? <Message texte={message.texte} type={message.type} /> : null}

        {panier && panier.lignes.length > 0 && !actif ? <Text style={styles.texteSecondaire}>{t('echelon.indisponible')}</Text> : null}
        {panier && panier.lignes.length > 0 && actif ? (
          <Carte>
            <Text style={styles.titre}>{t('echelon.panierTitre')}</Text>
            <Text style={styles.texteSecondaire}>{t('echelon.panierInfo')}</Text>
            <TextInput style={styles.champ} keyboardType="number-pad" placeholder={t('echelon.mensualite')} value={mensualite} onChangeText={setMensualite} />
            <Bouton
              titre={t('echelon.proposer')}
              onPress={() => agir(() => appeler(`/commandes/${panier.id}/echelonnement`, { methode: 'POST', corps: { mensualiteFcfa: Number(mensualite) } }), t('echelon.proposeOk'))}
            />
          </Carte>
        ) : null}

        {plans.length === 0 ? <Text style={styles.texteSecondaire}>{t('echelon.vide')}</Text> : null}

        {plans.map((p) => (
          <Carte key={p.id}>
            <Text style={styles.titre}>{p.commandeReference} · {t(STATUT[p.statut])}</Text>
            <Text style={styles.ligne}>{t('echelon.total')} : {formatFcfa(p.totalFcfa, langue)}</Text>
            <Text style={styles.ligne}>{t('echelon.paye')} : {formatFcfa(p.payeFcfa, langue)}</Text>
            {p.statut === 'ACTIF' || p.statut === 'SOLDE' ? (
              <>
                <Text style={styles.ligne}>{t('echelon.reste')} : {formatFcfa(p.restantFcfa, langue)}</Text>
                {p.dueCetteEcheanceFcfa > 0 ? <Text style={styles.ligne}>{t('echelon.echeance')} : {formatFcfa(p.dueCetteEcheanceFcfa, langue)}</Text> : null}
                {p.enRetard ? <Text style={styles.alerte}>{t('echelon.enRetard')}</Text> : null}
                {p.statut === 'SOLDE' ? <Text style={styles.succes}>{t('echelon.soldeOk')}</Text> : null}
              </>
            ) : null}

            {p.statut === 'PROPOSE' ? (
              <>
                <View style={styles.rangee}>
                  {(['AIRTEL_MONEY', 'MOOV_MONEY'] as Operateur[]).map((o) => (
                    <Pressable key={o} onPress={() => setOperateur(o)} style={[styles.choix, operateur === o && styles.choixActif]}>
                      <Text style={styles.choixTexte}>{o === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput style={styles.champ} keyboardType="phone-pad" placeholder={t('echelon.numero')} value={numero} onChangeText={setNumero} />
                <Bouton titre={t('echelon.payerAvance')} onPress={() => agir(() => appeler(`/echelonnements/${p.id}/avance`, { methode: 'POST', corps: paiementMobile }), t('echelon.payeOk'))} />
              </>
            ) : null}

            {p.statut === 'ACTIF' ? (
              <>
                <TextInput style={styles.champ} keyboardType="number-pad" placeholder={t('echelon.montant')} value={montant} onChangeText={setMontant} />
                <TextInput style={styles.champ} keyboardType="phone-pad" placeholder={t('echelon.numero')} value={numero} onChangeText={setNumero} />
                <Bouton
                  titre={t('echelon.payerVersement')}
                  onPress={() => agir(() => appeler(`/echelonnements/${p.id}/versements`, { methode: 'POST', corps: { montantFcfa: Number(montant), ...paiementMobile } }), t('echelon.payeOk'))}
                />
              </>
            ) : null}

            {p.statut === 'PROPOSE' || p.statut === 'ACTIF' ? (
              <Bouton variante="secondaire" titre={t('echelon.verifier')} onPress={() => agir(() => appeler(`/echelonnements/${p.id}/verifier-paiement`), t('echelon.verifieOk'))} />
            ) : null}
          </Carte>
        ))}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.m, gap: espaces.m },
  titrePage: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  titre: { fontWeight: '600', color: couleurs.texte, fontSize: 16 },
  texteSecondaire: { color: couleurs.texteSecondaire },
  ligne: { color: couleurs.texte },
  alerte: { color: couleurs.danger },
  succes: { color: couleurs.succes },
  champ: { borderWidth: 1, borderColor: couleurs.bordure, borderRadius: rayons.m, padding: espaces.s, color: couleurs.texte, backgroundColor: couleurs.blanc },
  rangee: { flexDirection: 'row', gap: espaces.s },
  choix: { flex: 1, padding: espaces.s, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure, alignItems: 'center' },
  choixActif: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  choixTexte: { color: couleurs.texte },
});
