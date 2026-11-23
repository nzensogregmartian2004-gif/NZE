import { useListePaginee } from '../../src/lib/use-liste-paginee';
import { ChargerPlus } from '../../src/components/ChargerPlus';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appeler, ApiError } from '../../src/api/client';
import { useI18n } from '../../src/i18n';
import { Bouton, Carte, Champ, Ecran, Message } from '../../src/components/ui';
import { formatFcfa } from '../../src/lib/format';
import { couleurs, espaces, rayons } from '../../src/theme';

interface ProduitAdmin { id: string; nom: string; prixFcfa: number; statut: string; disponible: number | null }
interface Entreprise { id: string; nom: string }
type Statut = 'BROUILLON' | 'PUBLIE';

// Lignes « Nom : valeur » → caractéristiques
function lireCaracteristiques(texte: string): { nom: string; valeur: string }[] {
  return texte.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(':');
    return i > 0 ? { nom: l.slice(0, i).trim(), valeur: l.slice(i + 1).trim() } : { nom: l, valeur: '-' };
  }).filter((c) => c.nom.length > 0 && c.valeur.length > 0);
}

export default function ProduitsAdmin() {
  const { t, langue } = useI18n();
  const { elements: produits, recharger, chargerPlus, plusDisponible, chargement: chargementListe } = useListePaginee<ProduitAdmin>('/admin/produits');
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');
  const [garantie, setGarantie] = useState('');
  const [description, setDescription] = useState('');
  const [caracteristiques, setCaracteristiques] = useState('');
  const [commentaires, setCommentaires] = useState('');
  const [statut, setStatut] = useState<Statut>('PUBLIE');
  const [stock, setStock] = useState('');
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<{ texte: string; type: 'erreur' | 'succes' } | null>(null);

  const charger = useCallback(() => {
    recharger();
    appeler<Entreprise[]>('/admin/entreprises').then((l) => { setEntreprises(l); setEntrepriseId((c) => c ?? l[0]?.id ?? null); }).catch(() => setEntreprises([]));
  }, [recharger]);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  async function publier() {
    if (!entrepriseId) return;
    setMessage(null);
    setChargement(true);
    try {
      const p = await appeler<{ id: string }>('/admin/produits', {
        methode: 'POST',
        corps: {
          entrepriseId, nom, prixFcfa: Number(prix), garantieJours: garantie ? Number(garantie) : undefined,
          description: description || undefined, caracteristiques: lireCaracteristiques(caracteristiques),
          commentaires: commentaires || undefined, statut,
        },
      });
      const quantite = Number(stock);
      if (quantite > 0) await appeler(`/admin/produits/${p.id}/ajustements`, { methode: 'POST', corps: { delta: quantite, motif: t('produits.stockInitial') } });
      setNom(''); setPrix(''); setGarantie(''); setDescription(''); setCaracteristiques(''); setCommentaires(''); setStock('');
      setOuvert(false);
      setMessage({ texte: t('admin.produitCree'), type: 'succes' });
      charger();
    } catch (e) {
      setMessage({ texte: e instanceof ApiError ? e.message : t('commun.erreur'), type: 'erreur' });
    } finally {
      setChargement(false);
    }
  }

  async function basculer(p: ProduitAdmin) {
    const suivant = p.statut === 'PUBLIE' ? 'SUSPENDU' : 'PUBLIE';
    await appeler(`/admin/produits/${p.id}`, { methode: 'PATCH', corps: { statut: suivant } }).catch(() => undefined);
    charger();
  }

  const valide = nom.trim().length >= 2 && Number(prix) > 0 && !!entrepriseId;

  return (
    <Ecran>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.titre}>{t('admin.produitsTitre')}</Text>
        {message && <Message texte={message.texte} type={message.type} />}

        {!ouvert ? (
          <Bouton titre={t('admin.nouveauProduit')} onPress={() => setOuvert(true)} />
        ) : (
          <Carte style={{ gap: espaces.s }}>
            <Text style={styles.sousTitre}>{t('admin.entreprise')}</Text>
            <View style={styles.pilules}>
              {entreprises.map((e) => (
                <Pressable key={e.id} onPress={() => setEntrepriseId(e.id)} style={[styles.pilule, entrepriseId === e.id && styles.actif]} accessibilityRole="radio">
                  <Text style={[styles.pilulesTexte, entrepriseId === e.id && styles.actifTexte]}>{e.nom}</Text>
                </Pressable>
              ))}
            </View>
            <Champ label={t('admin.nomProduit')} valeur={nom} onChangeTexte={setNom} />
            <Champ label={t('admin.prix')} valeur={prix} onChangeTexte={setPrix} clavier="number-pad" />
            <Champ label={t('admin.stockInitial')} valeur={stock} onChangeTexte={setStock} clavier="number-pad" />
            <Champ label={t('admin.garantie')} valeur={garantie} onChangeTexte={setGarantie} clavier="number-pad" />
            <Champ label={t('admin.descriptionProduit')} valeur={description} onChangeTexte={setDescription} multiligne />
            <Champ label={t('admin.caracteristiquesAide')} valeur={caracteristiques} onChangeTexte={setCaracteristiques} multiligne />
            <Champ label={t('admin.commentairesProduit')} valeur={commentaires} onChangeTexte={setCommentaires} multiligne />
            <Text style={styles.sousTitre}>{t('admin.statutProduit')}</Text>
            <View style={styles.pilules}>
              {(['PUBLIE', 'BROUILLON'] as Statut[]).map((s) => (
                <Pressable key={s} onPress={() => setStatut(s)} style={[styles.pilule, statut === s && styles.actif]} accessibilityRole="radio">
                  <Text style={[styles.pilulesTexte, statut === s && styles.actifTexte]}>{s === 'PUBLIE' ? t('admin.statutPublie') : t('admin.statutBrouillon')}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.legende}>{t('admin.photos')} : {t('admin.photosBientot')}</Text>
            <Bouton titre={t('admin.enregistrerProduit')} onPress={publier} chargement={chargement} desactive={!valide} />
          </Carte>
        )}

        {produits.map((p) => (
          <Carte key={p.id} style={styles.ligne}>
            <View style={{ flex: 1, gap: espaces.xs }}>
              <Text style={styles.nom}>{p.nom}</Text>
              <Text style={styles.legende}>{formatFcfa(p.prixFcfa, langue)} · {p.disponible ?? 0} · {p.statut}</Text>
            </View>
            <Pressable onPress={() => basculer(p)} accessibilityRole="button"><Text style={styles.lien}>{t('admin.publierBascule')}</Text></Pressable>
          </Carte>
        ))}
      <ChargerPlus visible={plusDisponible} chargement={chargementListe} onPress={chargerPlus} />
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontWeight: '700', color: couleurs.texte },
  legende: { color: couleurs.texteSecondaire },
  pilules: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.s },
  pilule: { paddingHorizontal: espaces.m, paddingVertical: espaces.s, borderRadius: rayons.pilule, borderWidth: 1, borderColor: couleurs.bordure },
  actif: { borderColor: couleurs.violet, backgroundColor: couleurs.violetClair },
  pilulesTexte: { color: couleurs.texte },
  actifTexte: { color: couleurs.violet, fontWeight: '700' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  nom: { fontWeight: '600', color: couleurs.texte },
  lien: { color: couleurs.violet, fontWeight: '600' },
});
