import { useEffect, useState } from 'react';
import { Switch, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { Carte, Ecran, Message } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { enregistrerReglagesMessagerie, lireReglagesMessagerie } from '../../src/lib/reglages-messagerie';
import { couleurs, espaces } from '../../src/theme';

type Retour = { texte: string; type: 'erreur' | 'succes' } | null;

export default function ParametresMessagerie() {
  const { t } = useI18n();
  const [notifMessages, setNotifMessages] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [retour, setRetour] = useState<Retour>(null);

  useEffect(() => {
    lireReglagesMessagerie()
      .then((r) => setNotifMessages(r.notifMessages))
      .catch(() => setRetour({ texte: t('messagerie.reglagesKo'), type: 'erreur' }))
      .finally(() => setChargement(false));
  }, [t]);

  const changer = async (valeur: boolean) => {
    setNotifMessages(valeur);
    try {
      const r = await enregistrerReglagesMessagerie(valeur);
      setNotifMessages(r.notifMessages);
      setRetour({ texte: t('messagerie.reglagesOk'), type: 'succes' });
    } catch (e) {
      setNotifMessages(!valeur);
      setRetour({ texte: e instanceof ApiError ? e.message : t('messagerie.reglagesKo'), type: 'erreur' });
    }
  };

  return (
    <Ecran>
      <View style={styles.contenu}>
        <Text style={styles.titre}>{t('messagerie.parametres')}</Text>
        <Carte>
          <View style={styles.ligne}>
            <View style={styles.texte}>
              <Text style={styles.libelle}>{t('messagerie.notifNouveaux')}</Text>
              <Text style={styles.aide}>{t('messagerie.notifNouveauxAide')}</Text>
            </View>
            <Switch value={notifMessages} disabled={chargement} onValueChange={changer} trackColor={{ true: couleurs.violet }} />
          </View>
        </Carte>
        {retour ? <Message texte={retour.texte} type={retour.type} /> : null}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.m, gap: espaces.m },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  texte: { flex: 1, gap: espaces.s },
  libelle: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  aide: { fontSize: 13, color: couleurs.texteSecondaire },
});
