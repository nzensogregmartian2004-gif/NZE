import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../src/api/client';
import { lirePanier, type Panier } from '../src/api/panier';
import { useI18n } from '../src/i18n';
import { Bouton, Carte, Champ, Ecran, Message } from '../src/components/ui';
import { formatFcfa } from '../src/lib/format';
import { couleurs, espaces, rayons } from '../src/theme';

type Canal = 'AIRTEL_MONEY' | 'MOOV_MONEY' | 'CARTE';
const DELAI_VERIFICATION_MS = 4000;
const TENTATIVES_MAX = 15;

export default function Paiement() {
  const { t, langue } = useI18n();
  const [panier, setPanier] = useState<Panier | null>(null);
  const [canal, setCanal] = useState<Canal>('AIRTEL_MONEY');
  const [numero, setNumero] = useState('');
  const [chargement, setChargement] = useState(false);
  const [attente, setAttente] = useState(false);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lirePanier().then(setPanier).catch(() => setPanier(null));
    return () => { if (minuteur.current) clearTimeout(minuteur.current); };
  }, []);

  function suivre(commandeId: string, tentative = 0) {
    minuteur.current = setTimeout(async () => {
      try {
        const r = await appeler<{ statut: string }>(`/commandes/${commandeId}/verifier-paiement`, { methode: 'POST' });
        if (r.statut === 'SUCCESS') {
          setAttente(false);
          setMessage({ texte: t('paiement.succes'), type: 'succes' });
          setTimeout(() => router.replace('/(tabs)'), 2000);
          return;
        }
        if (r.statut === 'FAILED') {
          setAttente(false);
          setMessage({ texte: t('paiement.echec'), type: 'erreur' });
          return;
        }
      } catch {
        // Erreur réseau ponctuelle : on continue à vérifier.
      }
      if (tentative + 1 < TENTATIVES_MAX) suivre(commandeId, tentative + 1);
      else setAttente(false);
    }, DELAI_VERIFICATION_MS);
  }

  const [surPlace, setSurPlace] = useState(false);
  const [messageSurPlace, setMessageSurPlace] = useState('');

  async function voirSurPlace() {
    const r = await appeler<{ message: string }>('/reglages/paiement-sur-place', { sansJeton: true }).catch(() => ({ message: '' }));
    setMessageSurPlace(r.message);
    setSurPlace(true);
  }

  // Le choix est enregistré, mais le paiement en ligne reste obligatoire.
  async function continuerSurPlace() {
    if (panier) await appeler(`/commandes/${panier.id}/paiement-sur-place`, { methode: 'POST' }).catch(() => undefined);
    setSurPlace(false);
  }

  async function payer() {
    if (!panier) return;
    setMessage(null);
    setChargement(true);
    try {
      const corps = canal === 'CARTE' ? { canal: 'CARTE' } : { canal: 'MOBILE_MONEY', operateur: canal, numero };
      const r = await appeler<{ statut: string; urlPaiement: string | null }>(`/commandes/${panier.id}/paiement`, { methode: 'POST', corps });
      if (canal === 'CARTE' && r.urlPaiement) {
        setMessage({ texte: t('paiement.carteOuverte'), type: 'succes' });
        await Linking.openURL(r.urlPaiement);
      } else {
        setAttente(true);
        suivre(panier.id);
      }
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    } finally {
      setChargement(false);
    }
  }

  async function verifier() {
    if (!panier) return;
    const r = await appeler<{ statut: string }>(`/commandes/${panier.id}/verifier-paiement`, { methode: 'POST' }).catch(() => ({ statut: 'INCONNU' }));
    if (r.statut === 'SUCCESS') {
      setMessage({ texte: t('paiement.succes'), type: 'succes' });
      setTimeout(() => router.replace('/(tabs)'), 2000);
    } else if (r.statut === 'FAILED') setMessage({ texte: t('paiement.echec'), type: 'erreur' });
  }

  const numeroValide = /^\d{8,12}$/.test(numero);
  const canalMobile = canal !== 'CARTE';

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
        <Text style={styles.titre}>{t('paiement.titre')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        {!panier ? (
          <Text style={styles.vide}>{t('panier.vide')}</Text>
        ) : (
          <>
            <Carte style={styles.total}>
              <Text style={styles.secondaire}>{t('paiement.total')}</Text>
              <Text style={styles.montant}>{formatFcfa(panier.totalFcfa, langue)}</Text>
            </Carte>
            <Text style={styles.section}>{t('paiement.canal')}</Text>
            {(['AIRTEL_MONEY', 'MOOV_MONEY', 'CARTE'] as Canal[]).map((c) => (
              <Pressable key={c} onPress={() => setCanal(c)} style={[styles.option, canal === c && styles.optionActive]} accessibilityRole="radio">
                <Text style={[styles.optionTexte, canal === c && styles.optionTexteActive]}>
                  {c === 'AIRTEL_MONEY' ? t('paiement.airtel') : c === 'MOOV_MONEY' ? t('paiement.moov') : t('paiement.carte')}
                </Text>
              </Pressable>
            ))}
            <Bouton titre={t('paiement.surPlaceBouton')} variante="secondaire" onPress={voirSurPlace} />
            {surPlace && (
              <Carte style={{ gap: espaces.s }}>
                <Text style={styles.secondaire}>{messageSurPlace}</Text>
                <Bouton titre={t('paiement.surPlaceContinuer')} onPress={continuerSurPlace} />
              </Carte>
            )}
            {canalMobile && <Champ label={t('paiement.numero')} valeur={numero} onChangeTexte={setNumero} clavier="phone-pad" />}
            {attente && <Message texte={t('paiement.attente')} type="succes" />}
            {message && <Message texte={message.texte} type={message.type} />}
            <Bouton
              titre={t('paiement.valider')}
              onPress={payer}
              chargement={chargement}
              desactive={chargement || attente || (canalMobile && !numeroValide)}
            />
            {canal === 'CARTE' && message?.type === 'succes' && <Bouton titre={t('paiement.verifier')} variante="secondaire" onPress={verifier} />}
          </>
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
  montant: { fontSize: 24, fontWeight: '800', color: couleurs.violet },
  section: { fontSize: 15, fontWeight: '700', color: couleurs.texte },
  option: { padding: espaces.m, borderRadius: rayons.m, borderWidth: 1, borderColor: couleurs.bordure },
  optionActive: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  optionTexte: { color: couleurs.texte },
  optionTexteActive: { color: couleurs.violet, fontWeight: '700' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
