import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, TextInput, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";
import { useAuthStore } from "@/store/auth";
import { STEP15_COPY, GUIDE_KEYS, type GuideKey, type HelpArticle } from "@/i18n/step15";
import { createSupportRequest, listHelpArticles, listMySupportRequests, type SupportRequest } from "@/lib/step15-api";

const inputStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, backgroundColor: colors.white, fontSize: 14 } as const;
const roleForActivity: Record<string, GuideKey> = { client: "client", commercant: "store", prestataire: "professional", livreur: "deliverer", proprietaire_vehicule: "vehicle", loueur: "vehicle", hebergeur: "lodging" };
const categories = ["compte", "commande", "paiement", "livraison", "reservation", "prestation", "signalement", "autre"] as const;

export default function HelpScreen() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const lang = user?.langue === "en" ? "en" : "fr";
  const copy = STEP15_COPY[lang];
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("autre");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);

  const activeGuideKeys = useMemo<GuideKey[]>(() => {
    const activeActivities = user?.activities.filter((activity) => activity.statut === "active") ?? [];
    const mapped = activeActivities.map((activity) => roleForActivity[activity.type]).filter((key): key is GuideKey => Boolean(key));
    const restaurantGuide = activeActivities.some((activity) => activity.type === "commercant") ? ["restaurant" as const] : [];
    return Array.from(new Set<GuideKey>(["client", ...mapped, ...restaurantGuide, ...(user?.isAdmin ? ["admin" as const] : [])]));
  }, [user]);

  const load = useCallback(async () => {
    try {
      const { articles: result } = await listHelpArticles(lang);
      setArticles(result);
    } catch {
      setArticles([]);
    }
    if (token) {
      try { const result = await listMySupportRequests(token); setRequests(result.items); } catch { setRequests([]); }
    }
  }, [lang, token]);
  useEffect(() => { void load(); }, [load]);

  const visibleArticles = articles.filter((article) => [article.title, article.summary, article.category, ...article.body].join(" ").toLowerCase().includes(query.trim().toLowerCase()));

  async function sendRequest() {
    if (!token) { Alert.alert(copy.contactTitle, lang === "fr" ? "Connecte-toi pour contacter le support." : "Sign in to contact support."); return; }
    if (subject.trim().length < 3 || message.trim().length < 10) { Alert.alert(copy.contactTitle, lang === "fr" ? "Renseigne un objet et un message suffisamment détaillé." : "Enter a subject and a more detailed message."); return; }
    setSending(true);
    try {
      await createSupportRequest(token, { subject: subject.trim(), category, message: message.trim() });
      setSubject(""); setMessage(""); setShowContact(false);
      await load();
      Alert.alert(copy.contactTitle, copy.requestSent);
    } catch (error) { Alert.alert(copy.contactTitle, error instanceof Error ? error.message : "Error"); }
    finally { setSending(false); }
  }

  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: spacing.xs }}><Text variant="h2">{copy.helpTitle}</Text><Text color={colors.inkSoft}>{copy.helpIntro}</Text></View>
      <Pressable onPress={() => router.back()}><Text color={colors.primary}>{copy.back}</Text></Pressable>
    </View>
    <TextInput value={query} onChangeText={setQuery} placeholder={copy.search} placeholderTextColor={colors.inkFaint} style={inputStyle} />
    {visibleArticles.length === 0 ? <Card><Text color={colors.inkSoft}>{copy.noArticles}</Text></Card> : visibleArticles.map((article) => <Pressable key={article.id} onPress={() => setExpanded((v) => v === article.id ? null : article.id)}>
      <Card style={{ gap: spacing.sm }}>
        <Text variant="caption" color={colors.primary}>{article.category}</Text>
        <Text variant="h3">{article.title}</Text>
        <Text color={colors.inkSoft}>{article.summary}</Text>
        {expanded === article.id ? <View style={{ gap: spacing.sm }}>{article.body.map((paragraph, index) => <Text key={`${article.id}-${index}`}>{paragraph}</Text>)}</View> : null}
      </Card>
    </Pressable>)}
    <Text variant="h3">{copy.guidesTitle}</Text>
    <Text color={colors.inkSoft}>{copy.chooseGuide}</Text>
    <View style={{ gap: spacing.sm }}>{activeGuideKeys.map((guide) => <Button key={guide} label={`${copy.restartGuide} — ${copy.guideNames[guide]}`} variant="secondary" onPress={() => router.push({ pathname: "/tutorial", params: { guide, restart: "1" } })} fullWidth />)}</View>
    <Button label={showContact ? (lang === "fr" ? "Fermer le formulaire" : "Close form") : copy.contactTitle} onPress={() => setShowContact((v) => !v)} fullWidth />
    {showContact ? <Card style={{ gap: spacing.md }}>
      <Text variant="h3">{copy.contactTitle}</Text>
      <Text>{copy.contactSubject}</Text>
      <TextInput value={subject} onChangeText={setSubject} placeholder={copy.contactSubject} style={inputStyle} maxLength={120} />
      <Text>{copy.contactCategory}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{categories.map((value) => <Pressable key={value} onPress={() => setCategory(value)} style={{ padding: 8, borderRadius: 10, borderWidth: 1, borderColor: value === category ? colors.primary : colors.line, backgroundColor: value === category ? colors.primaryTint : colors.white }}><Text variant="caption" color={value === category ? colors.primary : colors.ink}>{copy.categories[value]}</Text></Pressable>)}</View>
      <Text>{copy.contactMessage}</Text>
      <TextInput value={message} onChangeText={setMessage} placeholder={copy.contactMessage} multiline textAlignVertical="top" style={[inputStyle, { minHeight: 110 }]} maxLength={3000} />
      <Button label={copy.sendRequest} loading={sending} onPress={() => void sendRequest()} fullWidth />
    </Card> : null}
    <Text variant="h3">{copy.myRequests}</Text>
    {requests.length === 0 ? <Text color={colors.inkSoft}>{copy.noRequests}</Text> : requests.map((request) => <Card key={request.id} style={{ gap: spacing.xs }}><Text variant="label">{request.subject}</Text><Text color={colors.inkSoft}>{copy.status}: {request.status.replaceAll("_", " ")}</Text><Text>{request.message}</Text>{request.resolution ? <Text color={colors.success}>{request.resolution}</Text> : null}</Card>)}
  </ScrollView></Screen>;
}
