import { useCallback, useEffect, useRef, useState } from "react";
import { View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, radius, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuthStore } from "@/store/auth";
import { listMessages, sendMessage, type Message } from "@/lib/messaging-api";
import { getSocket } from "@/lib/socket";

const POLL_FALLBACK_MS = 15000; // filet de sécurité si le socket se déconnecte

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setMessages(await listMessages(accessToken, id));
  }, [accessToken, id]);

  useEffect(() => {
    load();

    const socket = getSocket();
    socket?.emit("conversation:join", id);

    function handleNewMessage(message: Message) {
      if (message.conversationId !== id) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    }
    socket?.on("message:new", handleNewMessage);

    // Filet de sécurité si le socket est déconnecté (réseau instable)
    const interval = setInterval(load, POLL_FALLBACK_MS);

    return () => {
      socket?.emit("conversation:leave", id);
      socket?.off("message:new", handleNewMessage);
      clearInterval(interval);
    };
  }, [load, id]);

  async function handleSend() {
    if (!accessToken || !draft.trim()) return;
    setSending(true);
    const content = draft;
    setDraft("");
    try {
      await sendMessage(accessToken, id, content);
      await load();
      listRef.current?.scrollToEnd({ animated: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="h2">Conversation</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.senderId === userId;
            return (
              <View
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  backgroundColor: isMine ? colors.primary : colors.bg,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  maxWidth: "80%",
                }}
              >
                <Text variant="body" color={isMine ? colors.white : colors.ink}>
                  {item.contenu}
                </Text>
              </View>
            );
          }}
        />

        <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.lg, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Input placeholder="Écrire un message..." value={draft} onChangeText={setDraft} />
          </View>
          <Button label="Envoyer" onPress={handleSend} loading={sending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
