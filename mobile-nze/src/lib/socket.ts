import { io, type Socket } from "socket.io-client";
import Constants from "expo-constants";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:4000";

let socket: Socket | null = null;

/** Ouvre la connexion Socket.IO authentifiée avec le token d'accès courant. */
export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;
  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ["websocket"],
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
