import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/i18n';
import { couleurs } from '../../src/theme';

export default function OngletsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.violet,
        tabBarInactiveTintColor: couleurs.texteSecondaire,
        tabBarStyle: { borderTopColor: couleurs.bordure },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('onglets.accueil'), tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="categories" options={{ title: t('onglets.categories'), tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="panier" options={{ title: t('onglets.panier'), tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="messages" options={{ title: t('onglets.messages'), tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="profil" options={{ title: t('onglets.profil'), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
