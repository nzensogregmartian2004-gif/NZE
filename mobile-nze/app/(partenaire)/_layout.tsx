import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/i18n';
import { couleurs } from '../../src/theme';

export default function PartenaireLayout() {
  const { t } = useI18n();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: couleurs.violet, tabBarInactiveTintColor: couleurs.texteSecondaire, tabBarStyle: { borderTopColor: couleurs.bordure } }}>
      <Tabs.Screen name="index" options={{ title: t('onglets.tableau'), tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="stock" options={{ title: t('onglets.stock'), tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="historique" options={{ title: t('onglets.historique'), tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="portefeuille" options={{ title: t('onglets.portefeuille'), tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="compte" options={{ title: t('onglets.compte'), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
