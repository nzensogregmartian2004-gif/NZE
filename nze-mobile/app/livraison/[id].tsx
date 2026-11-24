import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { CarteLivraison } from '../../src/components/CarteLivraison';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Ligne { id: string; nomArticle: string; quantiteDemandee: number; quantiteLivree: number | null }
interface Livraison {
  id: string; reference: string; statut: string; lignes: Ligne[];
  destination?: { latitude: number; longitude: number; clientNom: string | null; clientTelephone: string | null };
}
const MOTIFS = ['CLIENT_ABSENT', 'REFUS_CLIENT', 'ADRESSE_INTROUVABLE', 'AUTRE'] as const;
const INTERVALLE_POSITION_MS = 30000;

export default function DetailLivraison() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [livraison, setLivraison] = useState<Livraison | null>(null);
  const [quantites, setQuantites] = useState<Record<string, string>>({});
  const [code, setCode] = useState('');
  const [signature, setSignature] = useState(false);
  const [commentaire, setCommentaire] = useState('');
  const [motif, setMotif] = useState<(typeof MOTIFS)[number]>('CLIENT_ABSENT');
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);
  const [positionLivreur, setPositionLivreur] = useState<{ latitude: number; longitude: number } | null>(null);

  const charger = useCallback(() => {
    appeler<Livraison>(`/livreur/livraisons/${id}`).then((l) => {
      setLivraison(l);
      setQuantites(Object.fromEntries(l.lignes.map((x) => [x.id, String(x.quantiteDemandee)])));
    }).catch(() => setLivraison(null));
  }, [id]);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  // Position envoyée pendant le trajet, tant que la livraison est en route.
  useEffect(() => {
    if (livraison?.statut !== 'EN_ROUTE') return;
    const envoyer = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPositionLivreur({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      await appeler(`/livreur/livraisons/${id}/position`, { methode: 'POST', corps: { latitude: p.coords.latitude, longitude: p.coords.longitude } }).catch(() => undefined);
    };
    envoyer();
    const minuteur = setInterval(envoyer, INTERVALLE_POSITION_MS);
    return () => clearInterval(minuteur);
  }, [livraison?.statut, id]);

  async function action(chemin: string, corps?: unknown) {
    setMessage(null);
    try {
      await appeler(chemin, { methode: 'POST', corps: corps ?? {} });
      setMessage({ texte: t('livreur.succes'), type: 'succes' });
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  function confirmer() {
    if (!livraison) return;
    action(`/livreur/livraisons/${id}/confirmer`, {
      code,
      signaturePapierRecue: true,
      lignes: livraison.lignes.map((l) => ({ ligneId: l.id, quantiteLivree: Number(quantites[l.id] ?? l.quantiteDemandee) })),
      commentaire: commentaire || undefined,
    });
  }

  const codeValide = /^\d{6}$/.test(code) && signature;
  const d = livraison?.destination;

  return (
    <Ecran>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.retour}>{t('commun.retour')}</Text></Pressable>
      </View>
      {!livraison ? (
        <Text style={styles.vide}>{t('commun.chargement')}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.contenu}>
          <Text style={styles.titre}>{livraison.reference}</Text>
          <Text style={styles.statut}>{t(`livreur.statut.${livraison.statut}` as Cle)}</Text>

          {d && (
            <Carte style={{ gap: espaces.s }}>
              <Text style={styles.sousTitre}>{t('livreur.client')}</Text>
              <Text style={styles.texte}>{d.clientNom ?? '—'}</Text>
              {d.clientTelephone && (
                <Pressable onPress={() => Linking.openURL(`tel:${d.clientTelephone}`)} accessibilityRole="button">
                  <Text style={styles.lien}>{t('livreur.appeler')} · {d.clientTelephone}</Text>
                </Pressable>
              )}
              {d.latitude !== null && d.longitude !== null ? (
                <CarteLivraison destination={{ latitude: d.latitude, longitude: d.longitude }} livreur={positionLivreur} />
              ) : null}
            </Carte>
          )}

          <Carte style={{ gap: espaces.s }}>
            <Text style={styles.sousTitre}>{t('livreur.articles')}</Text>
            {livraison.lignes.map((l) => (
              <View key={l.id} style={styles.ligne}>
                <Text style={[styles.texte, { flex: 1 }]}>{l.nomArticle} × {l.quantiteDemandee}</Text>
                {livraison.statut === 'ARRIVE' && (
                  <Champ label={t('livreur.quantiteLivree')} valeur={quantites[l.id] ?? ''} onChangeTexte={(v) => setQuantites({ ...quantites, [l.id]: v })} clavier="number-pad" />
                )}
              </View>
            ))}
          </Carte>

          {message && <Message texte={message.texte} type={message.type} />}

          {livraison.statut === 'ASSIGNEE' && <Bouton titre={t('livreur.demarrer')} onPress={() => action(`/livreur/livraisons/${id}/demarrer`)} />}

          {livraison.statut === 'EN_ROUTE' && (
            <>
              <Bouton titre={t('livreur.arrivee')} onPress={() => action(`/livreur/livraisons/${id}/arrivee`)} />
              <Text style={styles.legende}>{t('livreur.positionEnvoyee')}</Text>
            </>
          )}

          {livraison.statut === 'ARRIVE' && (
            <Carte style={{ gap: espaces.s }}>
              <Champ label={t('livreur.code')} valeur={code} onChangeTexte={setCode} clavier="number-pad" />
              <Pressable onPress={() => setSignature(!signature)} style={[styles.coche, signature && styles.cocheActive]} accessibilityRole="checkbox">
                <Text style={[styles.texte, signature && styles.cocheTexte]}>{signature ? '☑' : '☐'} {t('livreur.signature')}</Text>
              </Pressable>
              <Champ label={t('livreur.commentaire')} valeur={commentaire} onChangeTexte={setCommentaire} />
              <Bouton titre={t('livreur.confirmer')} onPress={confirmer} desactive={!codeValide} />
              <Text style={styles.sousTitre}>{t('livreur.motif')}</Text>
              <View style={styles.pilules}>
                {MOTIFS.map((m) => (
                  <Pressable key={m} onPress={() => setMotif(m)} style={[styles.pilule, motif === m && styles.actif]} accessibilityRole="radio">
                    <Text style={[styles.pilulesTexte, motif === m && styles.actifTexte]}>{t(`livreur.motif.${m}` as Cle)}</Text>
                  </Pressable>
                ))}
              </View>
              <Bouton titre={t('livreur.echec')} variante="danger" onPress={() => action(`/livreur/livraisons/${id}/echec`, { motif })} />
            </Carte>
          )}
        </ScrollView>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { paddingHorizontal: espaces.l, paddingVertical: espaces.s },
  retour: { color: couleurs.violet, fontWeight: '600' },
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  statut: { color: couleurs.violet, fontWeight: '700' },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  texte: { color: couleurs.texte },
  lien: { color: couleurs.violet, fontWeight: '600' },
  legende: { color: couleurs.texteSecondaire, textAlign: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  coche: { padding: espaces.s },
  cocheActive: { backgroundColor: couleurs.violetClair, borderRadius: rayons.s },
  cocheTexte: { color: couleurs.violet, fontWeight: '700' },
  pilules: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  actif: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  pilulesTexte: { color: couleurs.texte },
  actifTexte: { color: couleurs.violet, fontWeight: '700' },
  vide: { textAlign: 'center', color: couleurs.texteSecondaire, marginTop: espaces.xl },
});
