import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/i18n';
import { couleurs } from '../../src/theme';

export default function Layout() {
  const { t } = useI18n();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: couleurs.violet, tabBarInactiveTintColor: couleurs.texteSecondaire, tabBarStyle: { borderTopColor: couleurs.bordure } }}>
      <Tabs.Screen name="index" options={{ title: t('onglets.tableau'), tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="collectes" options={{ title: t('onglets.recuperations'), tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="livraisons" options={{ title: t('onglets.livraisons'), tabBarIcon: ({ color, size }) => <Ionicons name="bicycle-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="compte" options={{ title: t('onglets.compte'), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
