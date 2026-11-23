import { Image } from "react-native";

type Props = {
  variant?: "full" | "mark";
  height?: number;
};

const sources = {
  full: require("../../assets/images/logo-header.png"),
  mark: require("../../assets/images/mark.png"),
};

const ratios = {
  full: 1200 / 437,
  mark: 365 / 192,
};

/** Logo officiel NZE (tête de panthère + wordmark), en version complète ou mark seul. */
export function Logo({ variant = "full", height = 32 }: Props) {
  return (
    <Image
      source={sources[variant]}
      style={{ height, width: height * ratios[variant] }}
      resizeMode="contain"
      accessibilityLabel="NZE"
    />
  );
}
