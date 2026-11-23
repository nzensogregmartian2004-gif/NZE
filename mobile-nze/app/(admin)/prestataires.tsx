import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, appeler } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import {
  LIBELLE_MOTIF_DEMANDE,
  LIBELLE_STATUT_DEMANDE,
  LIBELLE_STATUT_FICHE,
  ficheValide,
  type MotifDemande,
  type StatutDemande,
  type StatutFiche,
} from '../../src/lib/prestataires';
import { couleurs, espaces } from '../../src/theme';

interface Fiche { id: string; nomPublic: string; activite: string; description: string; zone: string | null; statut: StatutFiche }
interface Demande {
  id: string;
  motif: MotifDemande;
  message: string;
  statut: StatutDemande;
  noteNze: string | null;
  fichePublic: string;
  clientTelephone: string;
}

// Administration des fiches prestataires et des demandes reçues. Réservé aux rôles d'administration (permission publicite.gerer).
export default function AdminPrestataires() {
  const { t } = useI18n();
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [nom, setNom] = useState('');
  const [activite, setActivite] = useState('');
  const [zone, setZone] = useState('');
  const [description, setDescription] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    appeler<Fiche[]>('/admin/prestataires').then(setFiches).catch(() => setFiches([]));
    appeler<Demande[]>('/admin/demandes-prestataire').then(setDemandes).catch(() => setDemandes([]));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Renvoie vrai si l'action a réussi, pour ne vider le formulaire qu'après succès.
  async function action(chemin: string, methode: 'POST' | 'PATCH', corps: unknown): Promise<boolean> {
    try {
      await appeler(chemin, { methode, corps });
      setErreur(null);
      charger();
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : t('commun.erreur'));
      return false;
    }
  }

  async function creer() {
    if (!ficheValide(nom, activite)) return;
    const ok = await action('/admin/prestataires', 'POST', {
      nomPublic: nom.trim(),
      activite: activite.trim(),
      zone: zone.trim() || undefined,
      description: description.trim() || undefined,
    });
    if (ok) { setNom(''); setActivite(''); setZone(''); setDescription(''); }
  }

  const basculer = (f: Fiche) => action(`/admin/prestataires/${f.id}`, 'PATCH', { statut: f.statut === 'PUBLIEE' ? 'SUSPENDUE' : 'PUBLIEE' });
  const traiter = (d: Demande, statut: 'TRAITEE' | 'CLOTUREE') => action(`/admin/demandes-prestataire/${d.id}`, 'PATCH', { statut });

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {erreur ? <Message texte={erreur} /> : null}

        <Text style={styles.titre}>{t('admin.prestataires.demandes')}</Text>
        {demandes.length === 0 ? <Text style={styles.vide}>{t('admin.prestataires.aucuneDemande')}</Text> : null}
        {demandes.map((d) => (
          <Carte key={d.id} style={styles.carte}>
            <Text style={styles.nom}>{d.fichePublic}</Text>
            <Text style={styles.secondaire}>{t('admin.prestataires.client')} : {d.clientTelephone}</Text>
            <Text style={styles.secondaire}>{t(LIBELLE_MOTIF_DEMANDE[d.motif])} · {t(LIBELLE_STATUT_DEMANDE[d.statut])}</Text>
            <Text style={styles.texte}>{d.message}</Text>
            {d.statut === 'NOUVELLE' ? (
              <Bouton titre={t('admin.prestataires.traitee')} variante="secondaire" onPress={() => traiter(d, 'TRAITEE')} />
            ) : null}
            {d.statut !== 'CLOTUREE' ? (
              <Bouton titre={t('admin.prestataires.cloturer')} variante="secondaire" onPress={() => traiter(d, 'CLOTUREE')} />
            ) : null}
          </Carte>
        ))}

        <Text style={styles.titre}>{t('admin.prestataires.fiches')}</Text>
        {fiches.map((f) => (
          <Carte key={f.id} style={styles.carte}>
            <Text style={styles.nom}>{f.nomPublic}</Text>
            <Text style={styles.secondaire}>{f.activite}{f.zone ? ` · ${f.zone}` : ''} · {t(LIBELLE_STATUT_FICHE[f.statut])}</Text>
            <Bouton
              titre={t(f.statut === 'PUBLIEE' ? 'admin.prestataires.suspendre' : 'admin.prestataires.publier')}
              variante="secondaire"
              onPress={() => basculer(f)}
            />
          </Carte>
        ))}

        <Text style={styles.titre}>{t('admin.prestataires.nouvelle')}</Text>
        <Champ label={t('admin.prestataires.nom')} valeur={nom} onChangeTexte={setNom} />
        <Champ label={t('admin.prestataires.activite')} valeur={activite} onChangeTexte={setActivite} />
        <Champ label={t('prestataires.zone')} valeur={zone} onChangeTexte={setZone} />
        <Champ label={t('admin.prestataires.description')} valeur={description} onChangeTexte={setDescription} multiligne />
        <Bouton titre={t('admin.prestataires.creer')} onPress={creer} desactive={!ficheValide(nom, activite)} />
        <View style={styles.espace} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.s },
  titre: { fontSize: 18, fontWeight: '700', color: couleurs.texte, marginTop: espaces.m },
  carte: { gap: espaces.xs },
  nom: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  secondaire: { color: couleurs.texteSecondaire, fontSize: 13 },
  texte: { color: couleurs.texte },
  vide: { color: couleurs.texteSecondaire },
  espace: { height: espaces.xl },
});
