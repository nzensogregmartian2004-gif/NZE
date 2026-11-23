import { apiRequest } from "./api";

export type Conversation = { id: string; type: string; creeLe: string };
export type Message = { id: string; conversationId: string; senderId: string; contenu: string; envoyeLe: string };
export type NotificationItem = {
  id: string;
  type: string;
  contenu: string;
  lue: boolean;
  creeLe: string;
  donnees?: Record<string, unknown> | null;
};

export function listConversations(token: string) {
  return apiRequest<Conversation[]>("/conversations", { token });
}

export function createConversation(token: string, participantUserIds: string[]) {
  return apiRequest<Conversation>("/conversations", {
    method: "POST",
    body: { participantUserIds },
    token,
  });
}

export function listMessages(token: string, conversationId: string) {
  return apiRequest<Message[]>(`/conversations/${conversationId}/messages`, { token });
}

export function sendMessage(token: string, conversationId: string, contenu: string) {
  return apiRequest<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { contenu },
    token,
  });
}

export function listNotifications(token: string) {
  return apiRequest<NotificationItem[]>("/notifications", { token });
}
