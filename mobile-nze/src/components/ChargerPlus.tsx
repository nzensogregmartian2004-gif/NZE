// Bouton « Charger plus » affiché tant qu'une page suivante existe.
import { useI18n } from '../i18n';
import { Bouton } from './ui';

export function ChargerPlus({ visible, chargement, onPress, titre }: { visible: boolean; chargement: boolean; onPress: () => void; titre?: string }) {
  const { t } = useI18n();
  if (!visible) return null;
  return <Bouton titre={titre ?? t('commun.chargerPlus')} variante="secondaire" onPress={onPress} chargement={chargement} />;
}
