import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { getTutorialProgress } from "@/lib/step15-api";
import type { GuideKey } from "@/i18n/step15";

/** Opens a role-specific guide on first entry; skipped/completed guides never block the screen. */
export function useAutoTutorial(guideKey: GuideKey) {
  const token = useAuthStore((state) => state.accessToken);
  const launched = useRef(false);

  useEffect(() => {
    if (!token || launched.current) return;
    let cancelled = false;
    launched.current = true;
    void getTutorialProgress(token).then(({ items }) => {
      if (cancelled) return;
      const progress = items.find((item) => item.guideKey === guideKey);
      if (!progress || progress.status === "started") {
        router.push({ pathname: "/tutorial", params: { guide: guideKey } });
      }
    }).catch(() => {
      // L'aide ne doit jamais bloquer l'accès au tableau de bord si l'API est indisponible.
    });
    return () => { cancelled = true; };
  }, [token, guideKey]);
}
