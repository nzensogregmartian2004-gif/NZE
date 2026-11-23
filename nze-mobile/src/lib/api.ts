import Constants from "expo-constants";

const extraApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const configuredApiUrl = (process.env.EXPO_PUBLIC_API_URL || extraApiUrl || "").trim();
const hostUri = (Constants.expoConfig as unknown as { hostUri?: string } | null)?.hostUri;
const metroHost = hostUri?.split("/")[0]?.replace(/:\d+$/, "");
const developmentFallback = metroHost && metroHost !== "localhost"
  ? `http://${metroHost}:4000`
  : "http://localhost:4000";
const API_URL = (configuredApiUrl || developmentFallback).replace(/\/+$/, "");

if (!configuredApiUrl && process.env.NODE_ENV === "production") {
  console.warn("EXPO_PUBLIC_API_URL n'est pas configurée : l'API locale par défaut ne convient pas à une application publiée.");
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, headers: extraHeaders } = options;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Serveur NZE inaccessible (${API_URL}). Vérifie l'URL API et la connexion réseau.`);
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Une erreur est survenue");
  }

  return data as T;
}
