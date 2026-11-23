import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { couleurs, espaces } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { fetchLegalDocument, type LegalDocument, type LegalLang } from "@/lib/legal-api";

export default function LegalDocumentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [lang, setLang] = useState<LegalLang>("fr");
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchLegalDocument(String(slug), lang)
      .then((result) => {
        if (active) setDoc(result);
      })
      .catch(() => {
        if (active) {
          setError(lang === "fr"
            ? "Impossible de charger ce document. Vérifie ta connexion et réessaie."
            : "Unable to load this document. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, lang]);

  return (
    <Screen>
      <Stack.Screen options={{ title: doc?.title ?? "NZE" }} />
      <ScrollView contentContainerStyle={{ padding: espaces.l, gap: espaces.l }}>
        <View style={{ flexDirection: "row", gap: espaces.s }}>
          <Button label="Français" variant={lang === "fr" ? "primary" : "secondary"} onPress={() => setLang("fr")} />
          <Button label="English" variant={lang === "en" ? "primary" : "secondary"} onPress={() => setLang("en")} />
        </View>

        {loading && (
          <Text variant="body" color={couleurs.texteSecondaire}>
            {lang === "fr" ? "Chargement…" : "Loading…"}
          </Text>
        )}
        {error && (
          <Text variant="body" color={couleurs.danger}>
            {error}
          </Text>
        )}

        {doc && (
          <>
            <Text variant="caption" color={couleurs.texteSecondaire}>
              {lang === "fr" ? "Version" : "Version"} {doc.version} · {doc.effectiveDate}
            </Text>
            {doc.sections.map((section) => (
              <View key={section.heading} style={{ gap: espaces.s }}>
                <Text variant="h2">{section.heading}</Text>
                {section.paragraphs.map((paragraph, index) => (
                  <Text key={index} variant="body">
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
