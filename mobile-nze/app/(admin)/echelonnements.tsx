import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { Bouton, Carte, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces, rayons } from '../../src/theme';

interface Synthese { actifs: number; soldes: number; proposes: number; enRetard: number; totalRestantFcfa: number; totalEncaisseFcfa: number }
interface Ligne {
  id: string; commandeReference: string; client: { nom: string | null; telephone: string }; statut: string;
  totalFcfa: number; payeFcfa: number; restantFcfa: number; dueCetteEcheanceFcfa: number; enRetard: boolean;
}
const STATUT: Record<string, Cle> = { PROPOSE: 'echelon.statut.PROPOSE', ACTIF: 'echelon.statut.ACTIF', SOLDE: 'echelon.statut.SOLDE', ANNULE: 'echelon.statut.ANNULE' };

export default function EchelonnementsAdmin() {
  const { t, langue } = useI18n();
  const [synthese, setSynthese] = useState<Synthese | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [actif, setActif] = useState<boolean | null>(null);
  const [aAnnuler, setAAnnuler] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(() => {
    appeler<Synthese>('/admin/echelonnements/synthese').then(setSynthese).catch(() => setSynthese(null));
    appeler<Ligne[]>('/admin/echelonnements').then(setLignes).catch(() => setLignes([]));
    appeler<{ actif: boolean }>('/admin/reglages/echelonnement').then((r) => setActif(r.actif)).catch(() => setActif(null));
  }, []);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function agir(action: () => Promise<unknown>, succes: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ texte: succes, type: 'succes' });
      setAAnnuler(null);
      setMotif('');
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    }
  }

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titrePage}>{t('admin.echelon.titre')}</Text>
        {message ? <Message texte={message.texte} type={message.type} /> : null}

        {synthese ? (
          <Carte>
            <Text style={styles.ligne}>{t('admin.echelon.actifs')} : {synthese.actifs} · {t('admin.echelon.retard')} : {synthese.enRetard}</Text>
            <Text style={styles.ligne}>{t('admin.echelon.encours')} : {formatFcfa(synthese.totalRestantFcfa, langue)}</Text>
            <Text style={styles.ligne}>{t('admin.echelon.encaisse')} : {formatFcfa(synthese.totalEncaisseFcfa, langue)}</Text>
          </Carte>
        ) : null}

        <Carte>
          <Text style={styles.ligne}>{actif === false ? t('admin.echelon.suspendu') : t('admin.echelon.actif')}</Text>
          <Bouton
            variante={actif === false ? 'primaire' : 'secondaire'}
            titre={actif === false ? t('admin.echelon.reactiver') : t('admin.echelon.suspendre')}
            onPress={() => agir(() => appeler('/admin/reglages/echelonnement', { methode: 'PUT', corps: { actif: actif === false } }), t('admin.echelon.actif'))}
          />
          <Bouton variante="secondaire" titre={t('admin.echelon.relancer')} onPress={() => agir(() => appeler('/admin/echelonnements/relances', { methode: 'POST' }), t('admin.echelon.relancer'))} />
        </Carte>

        {lignes.length === 0 ? <Text style={styles.texteSecondaire}>{t('admin.echelon.vide')}</Text> : null}

        {lignes.map((l) => (
          <Carte key={l.id}>
            <Text style={styles.titre}>{l.commandeReference} · {t(STATUT[l.statut])}{l.enRetard ? ' · ⚠' : ''}</Text>
            <Text style={styles.ligne}>{t('admin.echelon.client')} : {l.client.nom ?? '—'} · {l.client.telephone}</Text>
            <Text style={styles.ligne}>{formatFcfa(l.payeFcfa, langue)} / {formatFcfa(l.totalFcfa, langue)}</Text>
            {l.statut === 'ACTIF' || l.statut === 'PROPOSE' ? (
              aAnnuler === l.id ? (
                <>
                  <TextInput style={styles.champ} placeholder={t('admin.echelon.motif')} value={motif} onChangeText={setMotif} />
                  <Bouton
                    variante="secondaire"
                    titre={t('admin.echelon.annuler')}
                    desactive={motif.trim().length < 5}
                    onPress={() => agir(() => appeler(`/admin/echelonnements/${l.id}/annulation`, { methode: 'POST', corps: { motif } }), t('admin.echelon.annuler'))}
                  />
                </>
              ) : (
                <Pressable onPress={() => setAAnnuler(l.id)}><Text style={styles.lien}>{t('admin.echelon.annuler')}</Text></Pressable>
              )
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
  lien: { color: couleurs.violet, fontWeight: '600' },
  champ: { borderWidth: 1, borderColor: couleurs.bordure, borderRadius: rayons.m, padding: espaces.s, color: couleurs.texte, backgroundColor: couleurs.blanc },
});
