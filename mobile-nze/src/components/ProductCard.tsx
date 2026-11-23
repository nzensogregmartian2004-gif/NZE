import { Image, Pressable, View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";
import type { Product } from "@/lib/stores-api";

type Props = { product: Product; onPress?: () => void; width?: number | `${number}%` };

export function ProductCard({ product, onPress, width = 160 }: Props) {
  const imageUrl = product.photos?.[0]?.url;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width, opacity: pressed ? 0.86 : 1 })}>
      <View style={{ borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
        <View style={{ height: 122, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}>
          {imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontSize: 40 }}>📦</Text>}
        </View>
        <View style={{ padding: spacing.md, gap: spacing.xs }}>
          <Text variant="label" numberOfLines={2}>{product.nom}</Text>
          {product.marque && <Text variant="caption" color={colors.inkSoft} numberOfLines={1}>{product.marque}{product.modele ? ` · ${product.modele}` : ""}</Text>}
          <Text variant="body" color={colors.primary} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>{Number(product.prix).toLocaleString("fr-FR")} FCFA</Text>
          {product.store?.nom && <Text variant="caption" color={colors.inkSoft} numberOfLines={1}>{product.store.nom}</Text>}
          {!product.disponible && <Text variant="caption" color={colors.danger}>Indisponible</Text>}
        </View>
      </View>
    </Pressable>
  );
}
