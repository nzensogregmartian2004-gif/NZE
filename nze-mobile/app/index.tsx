import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";

/** Point d'entrée : redirige vers l'accueil si connecté, sinon vers l'inscription. */
export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return <Redirect href={accessToken ? "/(tabs)" : "/(auth)/register"} />;
}
