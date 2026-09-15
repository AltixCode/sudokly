import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { Screen, Text } from "@/components/ui";
import { t } from "@/i18n";
import { archiveDates, dateKey, isPlayable } from "@/logic/daily";
import { usePuzzleStore } from "@/store/usePuzzleStore";
import { usePremiumStore } from "@/store/usePremiumStore";
import { useTheme } from "@/theme";

const MIN_TOUCH_TARGET = 44;

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, "0")}`;
}
/** Rows rendered at once. The archive is 365 days; a screen does not need them all. */
const VISIBLE_DAYS = 60;

/**
 * The daily challenge and its archive.
 *
 * Every day's board is derived from its date, so the archive is genuinely playable offline
 * rather than being a list of content that would have to be downloaded. A free player gets
 * today; the purchase opens the rest.
 */
export default function Daily() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const solved = usePuzzleStore((s) => s.solved);
  const difficulty = usePuzzleStore((s) => s.difficulty);
  const load = usePuzzleStore((s) => s.load);

  // `new Date()` during render would be impure and re-read on every re-render; once per mount
  // is both correct and what the React Compiler's purity rule requires.
  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const dates = useMemo(
    () => archiveDates(today).slice(0, VISIBLE_DAYS),
    [today],
  );

  const open = useCallback(
    (key: string) => {
      if (!isPlayable(key, today, isPremium)) {
        router.push("/paywall");
        return;
      }
      load(key, difficulty, today, isPremium);
      router.back();
    },
    [today, isPremium, load, difficulty, router],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <Text variant="display">{t("archiveTitle")}</Text>

        {dates.map((key) => {
          const playable = isPlayable(key, today, isPremium);
          const stat = solved[key];
          const isToday = key === todayKey;
          const label = stat
            ? t("daySolved", { date: key, time: formatMs(stat.ms) })
            : playable
              ? t("playDay", { date: key })
              : t("dayLocked", { date: key });

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => open(key)}
              style={{
                minHeight: MIN_TOUCH_TARGET,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing.base,
                marginTop: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: isToday ? colors.accent : colors.border,
                // A locked row is dimmed but still shown and still tappable — it goes to the
                // paywall. Hiding it would mean nobody knows the archive exists.
                opacity: playable ? 1 : 0.6,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">{isToday ? t("todayLabel") : key}</Text>
                {stat ? (
                  <Text variant="caption" tone="muted">
                    {formatMs(stat.ms)}
                  </Text>
                ) : null}
              </View>
              {!playable ? (
                <Text variant="micro" tone="faint">
                  {t("lockedTitle")}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
