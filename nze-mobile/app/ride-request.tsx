import { useEffect, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { colors, radius, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { getCurrentLocation, type Coordinates } from "@/lib/location";
import { createRide } from "@/lib/mobility-api";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";

export default function RideRequestScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [typeService, setTypeService] = useState<"taxi" | "moto">("taxi");
  const [depart, setDepart] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(true);
  const [destinationText, setDestinationText] = useState("");
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getCurrentLocation();
      if (result.status === "ok") setDepart(result.coords);
      else setError("Active la localisation pour demander une course.");
      setLocating(false);
    })();
  }, []);

  async function handleFindDestination() {
    if (!destinationText.trim()) return;
    setGeocoding(true);
    setError(null);
    setDestination(null);
    try {
      const results = await Location.geocodeAsync(destinationText);
      if (results.length === 0) {
        setError("Adresse introuvable — précise le quartier ou un point de repère connu.");
        return;
      }
      setDestination({ latitude: results[0].latitude, longitude: results[0].longitude });
    } catch {
      setError("Recherche d'adresse impossible pour le moment.");
    } finally {
      setGeocoding(false);
    }
  }

  async function handleRequest() {
    if (!accessToken || !depart || !destination) return;
    setRequesting(true);
    setError(null);
    try {
      const ride = await createRide(accessToken, {
        typeService,
        positionDepart: depart,
        positionArrivee: destination,
      });
      router.replace(`/ride/${ride.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de demander la course");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Demander une course</Text>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["taxi", "moto"] as const).map((t) => (
            <Button
              key={t}
              label={t === "taxi" ? "🚕 Taxi" : "🏍️ Moto"}
              variant={typeService === t ? "primary" : "secondary"}
              onPress={() => setTypeService(t)}
            />
          ))}
        </View>

        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.bg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 18 }}>📍</Text>
          {locating ? (
            <Text variant="bodySm" color={colors.inkSoft}>
              Localisation en cours...
            </Text>
          ) : depart ? (
            <Text variant="bodySm" color={colors.inkSoft}>
              Départ : ta position actuelle
            </Text>
          ) : (
            <Text variant="bodySm" color={colors.danger}>
              Position indisponible
            </Text>
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Input
            label="Destination"
            placeholder="Quartier, point de repère..."
            value={destinationText}
            onChangeText={(v) => {
              setDestinationText(v);
              setDestination(null);
            }}
            onSubmitEditing={handleFindDestination}
            returnKeyType="search"
          />
          <Button label="Rechercher l'adresse" variant="secondary" onPress={handleFindDestination} loading={geocoding} />
          {destination && (
            <Text variant="bodySm" color={colors.success}>
              ✓ Destination trouvée
            </Text>
          )}
        </View>

        {error && (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        )}

        <View style={{ flex: 1 }} />

        <Button
          label="Demander la course"
          onPress={handleRequest}
          loading={requesting}
          disabled={!depart || !destination}
          fullWidth
        />
      </View>
    </Screen>
  );
}
