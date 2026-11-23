import { apiRequest } from "./api";
import type { GuideKey } from "@/i18n/step15";

export type TutorialProgress = {
  id: string; userId: string; guideKey: GuideKey; status: "started" | "skipped" | "completed";
  currentStep: number; completedAt: string | null; skippedAt: string | null; updatedAt: string;
};
export type NzNotification = {
  id: string; userId: string; type: string; contenu: string; donnees: Record<string, unknown> | null; lue: boolean; creeLe: string;
};
export type NotificationPreferences = {
  userId: string; inAppEnabled: boolean; orderUpdates: boolean; deliveryUpdates: boolean; paymentUpdates: boolean;
  bookingUpdates: boolean; serviceUpdates: boolean; reviewsReportsUpdates: boolean; marketingUpdates: boolean; systemUpdates: boolean; updatedAt: string;
};
export type HelpArticle = { id: string; category: string; roles: string[]; title: string; summary: string; body: string[] };
export type SupportRequest = {
  id: string; userId: string; subject: string; category: string; message: string; status: "ouvert" | "en_cours" | "resolu" | "ferme";
  resolution: string | null; createdAt: string; updatedAt: string;
};

export function getTutorialProgress(token: string) {
  return apiRequest<{ items: TutorialProgress[] }>("/tutorials/progress", { token });
}
export function saveTutorialProgress(token: string, guideKey: GuideKey, currentStep: number, status: TutorialProgress["status"]) {
  return apiRequest<TutorialProgress>(`/tutorials/${guideKey}/progress`, { method: "PUT", token, body: { currentStep, status } });
}
export function listHelpArticles(lang: "fr" | "en", role?: string, q?: string) {
  const params = new URLSearchParams({ lang });
  if (role) params.set("role", role);
  if (q) params.set("q", q);
  return apiRequest<{ language: "fr" | "en"; articles: HelpArticle[] }>(`/help?${params.toString()}`);
}
export function createSupportRequest(token: string, input: { subject: string; category: string; message: string }) {
  return apiRequest<SupportRequest>("/help/requests", { method: "POST", token, body: input });
}
export function listMySupportRequests(token: string) {
  return apiRequest<{ items: SupportRequest[] }>("/help/requests/me", { token });
}
export function listNotifications(token: string) {
  return apiRequest<NzNotification[]>("/notifications", { token });
}
export function getNotificationPreferences(token: string) {
  return apiRequest<NotificationPreferences>("/notifications/preferences", { token });
}
export function updateNotificationPreferences(token: string, input: Partial<NotificationPreferences>) {
  const { userId: _userId, updatedAt: _updatedAt, ...settings } = input;
  return apiRequest<NotificationPreferences>("/notifications/preferences", { method: "PUT", token, body: settings });
}
export function markNotificationRead(token: string, id: string) {
  return apiRequest<NzNotification>(`/notifications/${id}/read`, { method: "PATCH", token });
}
export function markAllNotificationsRead(token: string) {
  return apiRequest<{ message: string }>("/notifications/read-all", { method: "PATCH", token });
}
