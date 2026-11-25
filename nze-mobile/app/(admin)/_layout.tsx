import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/i18n';
import { couleurs } from '../../src/theme';

export default function Layout() {
  const { t } = useI18n();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: couleurs.violet, tabBarInactiveTintColor: couleurs.texteSecondaire, tabBarStyle: { borderTopColor: couleurs.bordure } }}>
      <Tabs.Screen name="index" options={{ title: t('onglets.tableau'), tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="collectes" options={{ title: t('onglets.collectes'), tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="produits" options={{ title: t('onglets.produits'), tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="promotions" options={{ title: t('onglets.promotions'), tabBarIcon: ({ color, size }) => <Ionicons name="pricetag-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="photos" options={{ title: t('onglets.photos'), tabBarIcon: ({ color, size }) => <Ionicons name="images-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="retraits" options={{ title: t('onglets.retraits'), tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="commandes" options={{ title: t('onglets.commandes'), tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="reclamations" options={{ title: t('onglets.reclamations'), tabBarIcon: ({ color, size }) => <Ionicons name="alert-circle-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="entreprises" options={{ title: t('onglets.entreprises'), tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="stock" options={{ title: t('onglets.stock'), tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="registres" options={{ title: t('onglets.registres'), tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="prestataires" options={{ title: t('admin.prestataires.onglet'), tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="compte" options={{ title: t('onglets.compte'), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
