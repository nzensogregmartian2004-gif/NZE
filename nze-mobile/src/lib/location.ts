import * as Location from "expo-location";

export type Coordinates = { latitude: number; longitude: number };

export type LocationResult =
  | { status: "ok"; coords: Coordinates }
  | { status: "denied" }
  | { status: "error" };

/** Demande l'autorisation puis la position actuelle — point 11 du prompt maître. */
export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { status: "denied" };

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: "ok",
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch {
    return { status: "error" };
  }
}
