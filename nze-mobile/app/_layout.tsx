import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/auth/session';
import { I18nProvider } from '../src/i18n';

export default function RacineLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
