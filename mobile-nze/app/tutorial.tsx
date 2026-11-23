import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";
import { useAuthStore } from "@/store/auth";
import { GUIDES, GUIDE_KEYS, STEP15_COPY, type GuideKey } from "@/i18n/step15";
import { getTutorialProgress, saveTutorialProgress } from "@/lib/step15-api";

export default function TutorialScreen() {
  const params = useLocalSearchParams<{ guide?: string; restart?: string }>();
  const guideKey: GuideKey = GUIDE_KEYS.includes(params.guide as GuideKey) ? params.guide as GuideKey : "client";
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const lang = user?.langue === "en" ? "en" : "fr";
  const copy = STEP15_COPY[lang];
  const guide = GUIDES[lang][guideKey];
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncFailed, setSyncFailed] = useState(false);
  const step = guide.steps[Math.min(stepIndex, guide.steps.length - 1)];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      let start = 0;
      if (token && params.restart !== "1") {
        try {
          const { items } = await getTutorialProgress(token);
          const saved = items.find((item) => item.guideKey === guideKey && item.status === "started");
          if (saved) start = Math.min(saved.currentStep, guide.steps.length - 1);
        } catch { /* Le tutoriel reste utilisable hors ligne. */ }
      }
      if (cancelled) return;
      setStepIndex(start);
      setLoading(false);
      if (token) {
        void saveTutorialProgress(token, guideKey, start, "started").catch(() => setSyncFailed(true));
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [token, guideKey, params.restart, guide.steps.length]);

  async function save(status: "started" | "skipped" | "completed", nextIndex: number) {
    if (!token) return;
    try { await saveTutorialProgress(token, guideKey, nextIndex, status); }
    catch { setSyncFailed(true); }
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function next() {
    if (stepIndex < guide.steps.length - 1) {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      await save("started", nextIndex);
      return;
    }
    await save("completed", stepIndex);
    goBack();
  }

  function skip() {
    Alert.alert(lang === "fr" ? "Passer le tutoriel ?" : "Skip this tutorial?", lang === "fr" ? "Tu pourras le relancer depuis le centre d'aide." : "You can restart it from the help center.", [
      { text: lang === "fr" ? "Continuer le tutoriel" : "Keep learning", style: "cancel" },
      { text: copy.skip, style: "destructive", onPress: () => { void save("skipped", stepIndex).finally(goBack); } },
    ]);
  }

  if (loading) return <Screen style={{ alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /><Text>{copy.loading}</Text></Screen>;

  return <Screen>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="h2">{guide.title}</Text>
        <Pressable onPress={skip}><Text color={colors.primary}>{copy.skip}</Text></Pressable>
      </View>
      <Text color={colors.inkSoft}>{guide.intro}</Text>
      <View style={{ height: 6, borderRadius: 6, backgroundColor: colors.primaryTint, overflow: "hidden" }}>
        <View style={{ width: `${((stepIndex + 1) / guide.steps.length) * 100}%`, height: "100%", backgroundColor: colors.primary }} />
      </View>
      <Text variant="caption" color={colors.inkSoft}>{copy.step} {stepIndex + 1} {copy.of} {guide.steps.length}</Text>
      <Card style={{ gap: spacing.md, minHeight: 220, justifyContent: "center" }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}>
          <Text variant="h2" color={colors.primary}>{stepIndex + 1}</Text>
        </View>
        <Text variant="h3">{step.title}</Text>
        <Text variant="body">{step.body}</Text>
      </Card>
      {syncFailed ? <Text variant="caption" color={colors.warning}>{copy.saveFailed}</Text> : null}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button label={copy.previous} variant="secondary" disabled={stepIndex === 0} onPress={() => { const prev = stepIndex - 1; setStepIndex(prev); void save("started", prev); }} style={{ flex: 1 }} />
        <Button label={stepIndex === guide.steps.length - 1 ? copy.finish : copy.next} onPress={() => void next()} style={{ flex: 1 }} />
      </View>
      <Button label={lang === "fr" ? "Fermer" : "Close"} variant="ghost" onPress={() => { void save("skipped", stepIndex).finally(goBack); }} />
    </ScrollView>
  </Screen>;
}
