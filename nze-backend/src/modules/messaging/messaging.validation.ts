import { z } from "zod";

export const createConversationSchema = z.object({
  participantUserIds: z.array(z.string().uuid()).min(1),
});

export const sendMessageSchema = z.object({
  contenu: z.string().min(1).max(2000),
});
