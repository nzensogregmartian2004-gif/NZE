import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import type { Cle } from '../../src/i18n/dictionnaire';
import { dateVersIso, pourcentageVersBps, STATUTS_ENTREPRISE } from '../../src/lib/admin-entreprises';
import { couleurs, espaces, rayons } from '../../src/theme';

interface EntrepriseAdmin { id: string; nom: string; statutPartenariat: string }
type Retour = { texte: string; type: 'erreur' | 'succes' } | null;

export default function EntreprisesAdmin() {
  const { t } = useI18n();
  const [entreprises, setEntreprises] = useState<EntrepriseAdmin[]>([]);
  const [selection, setSelection] = useState<EntrepriseAdmin | null>(null);
  const [retour, setRetour] = useState<Retour>(null);
  // Identité (cahier V3.0 §8.2) : seuls les champs renseignés sont envoyés.
  const [identite, setIdentite] = useState({ nomOfficiel: '', responsableNom: '', responsableRole: '', responsableTelephone: '', telephone: '', email: '' });
  // Statut (cahier V3.0 §8.4) : le serveur valide le passage.
  const [cible, setCible] = useState<string | null>(null);
  const [motifStatut, setMotifStatut] = useState('');
  // Accord commercial : commission, date d'effet, durée, conditions, document.
  const [accord, setAccord] = useState({ taux: '', effet: '', duree: '', conditions: '', documentUrl: '' });

  const charger = useCallback(() => {
    appeler<EntrepriseAdmin[]>('/admin/entreprises').then(setEntreprises).catch(() => setEntreprises([]));
  }, []);
  useFocusEffect(charger);

  const enregistrerIdentite = async () => {
    if (!selection) return;
    const corps = Object.fromEntries(Object.entries(identite).filter(([, v]) => v.trim() !== ''));
    if (Object.keys(corps).length === 0) { setRetour({ texte: t('entreprises.renseignez'), type: 'erreur' }); return; }
    try {
      await appeler(`/admin/entreprises/${selection.id}`, { methode: 'PATCH', corps });
      setRetour({ texte: t('entreprises.identiteOk'), type: 'succes' });
    } catch (e) {
      setRetour({ texte: e instanceof ApiError ? e.message : t('entreprises.identiteKo'), type: 'erreur' });
    }
  };

  const changerStatut = async () => {
    if (!selection || !cible) return;
    try {
      const r = await appeler<{ statut: string }>(`/admin/entreprises/${selection.id}/statut`, { methode: 'PATCH', corps: { statut: cible, motif: motifStatut.trim() || undefined } });
      setSelection({ ...selection, statutPartenariat: r.statut });
      setEntreprises((liste) => liste.map((e) => (e.id === selection.id ? { ...e, statutPartenariat: r.statut } : e)));
      setRetour({ texte: t('entreprises.statutOk'), type: 'succes' });
    } catch (e) {
      setRetour({ texte: e instanceof ApiError ? e.message : t('entreprises.statutKo'), type: 'erreur' });
    }
  };

  const enregistrerAccord = async () => {
    if (!selection) return;
    const bps = pourcentageVersBps(accord.taux);
    if (bps === null) { setRetour({ texte: t('entreprises.commissionAide'), type: 'erreur' }); return; }
    const effet = accord.effet.trim() ? dateVersIso(accord.effet) : null;
    if (accord.effet.trim() && !effet) { setRetour({ texte: t('entreprises.dateAide'), type: 'erreur' }); return; }
    const duree = accord.duree.trim() ? Number(accord.duree) : undefined;
    try {
      await appeler('/admin/commissions', {
        methode: 'POST',
        corps: {
          entrepriseId: selection.id, tauxBps: bps, effetDebut: effet ?? undefined, dureeMois: duree,
          conditions: accord.conditions.trim() || undefined, documentUrl: accord.documentUrl.trim() || undefined,
        },
      });
      setAccord({ taux: '', effet: '', duree: '', conditions: '', documentUrl: '' });
      setRetour({ texte: t('entreprises.accordOk'), type: 'succes' });
    } catch (e) {
      setRetour({ texte: e instanceof ApiError ? e.message : t('entreprises.accordKo'), type: 'erreur' });
    }
  };

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>{t('entreprises.titre')}</Text>
        {entreprises.map((e) => (
          <Pressable key={e.id} onPress={() => { setSelection(e); setCible(null); setRetour(null); }}>
            <Carte style={selection?.id === e.id ? styles.carteActive : undefined}>
              <Text style={styles.nom}>{e.nom}</Text>
              <Text style={styles.detail}>{t((STATUTS_ENTREPRISE.find((s) => s.code === e.statutPartenariat)?.cle ?? e.statutPartenariat) as Cle)}</Text>
            </Carte>
          </Pressable>
        ))}

        {selection ? (
          <>
            <Carte>
              <Text style={styles.sousTitre}>{t('entreprises.identite')}</Text>
              <Champ label={t('entreprises.nomOfficiel')} valeur={identite.nomOfficiel} onChangeTexte={(v) => setIdentite({ ...identite, nomOfficiel: v })} />
              <Champ label={t('entreprises.nomResponsable')} valeur={identite.responsableNom} onChangeTexte={(v) => setIdentite({ ...identite, responsableNom: v })} />
              <Champ label={t('entreprises.roleResponsable')} valeur={identite.responsableRole} onChangeTexte={(v) => setIdentite({ ...identite, responsableRole: v })} />
              <Champ label={t('entreprises.telResponsable')} valeur={identite.responsableTelephone} clavier="phone-pad" onChangeTexte={(v) => setIdentite({ ...identite, responsableTelephone: v })} />
              <Champ label={t('entreprises.telEntreprise')} valeur={identite.telephone} clavier="phone-pad" onChangeTexte={(v) => setIdentite({ ...identite, telephone: v })} />
              <Champ label={t('entreprises.email')} valeur={identite.email} clavier="email-address" onChangeTexte={(v) => setIdentite({ ...identite, email: v })} />
              <Bouton titre={t('entreprises.enregistrerIdentite')} onPress={enregistrerIdentite} />
            </Carte>

            <Carte>
              <Text style={styles.sousTitre}>{t('entreprises.statutTitre')}</Text>
              <View style={styles.ligneChips}>
                {STATUTS_ENTREPRISE.map((s) => (
                  <Pressable key={s.code} onPress={() => setCible(s.code)} style={[styles.chip, cible === s.code && styles.chipActif]}>
                    <Text style={[styles.chipTexte, cible === s.code && styles.chipTexteActif]}>{t(s.cle)}</Text>
                  </Pressable>
                ))}
              </View>
              <Champ label={t('commun.motifFacultatif')} valeur={motifStatut} onChangeTexte={setMotifStatut} />
              <Bouton titre={t('entreprises.changerStatut')} onPress={changerStatut} desactive={!cible} />
            </Carte>

            <Carte>
              <Text style={styles.sousTitre}>{t('entreprises.accordTitre')}</Text>
              <Champ label={t('entreprises.commission')} valeur={accord.taux} clavier="decimal-pad" placeholder={t('entreprises.exemplePourcentage')} onChangeTexte={(v) => setAccord({ ...accord, taux: v })} />
              <Champ label={t('entreprises.dateEffet')} valeur={accord.effet} placeholder={t('entreprises.exempleDate')} onChangeTexte={(v) => setAccord({ ...accord, effet: v })} />
              <Champ label={t('entreprises.duree')} valeur={accord.duree} clavier="number-pad" onChangeTexte={(v) => setAccord({ ...accord, duree: v })} />
              <Champ label={t('entreprises.conditions')} valeur={accord.conditions} multiligne onChangeTexte={(v) => setAccord({ ...accord, conditions: v })} />
              <Champ label={t('entreprises.document')} valeur={accord.documentUrl} clavier="url" onChangeTexte={(v) => setAccord({ ...accord, documentUrl: v })} />
              <Bouton titre={t('entreprises.enregistrerAccord')} onPress={enregistrerAccord} />
            </Carte>
          </>
        ) : null}

        {retour ? <Message texte={retour.texte} type={retour.type} /> : null}
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.m, gap: espaces.m },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
  nom: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  detail: { color: couleurs.texteSecondaire, fontSize: 12 },
  carteActive: { borderWidth: 2, borderColor: couleurs.violet },
  ligneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  chip: { paddingVertical: espaces.s, paddingHorizontal: espaces.m, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.violet },
  chipActif: { backgroundColor: couleurs.violet },
  chipTexte: { color: couleurs.violet, fontWeight: '600' },
  chipTexteActif: { color: couleurs.blanc },
});
