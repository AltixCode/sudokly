import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { SudokuBoard } from "@/components/SudokuBoard";
import { Button, Screen, Text } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n";
import { SIZE, colOf, rowOf } from "@/logic/grid";
import {
  DIFFICULTIES,
  type Difficulty,
  nextDifficulty,
} from "@/logic/generator";
import { dateKey } from "@/logic/daily";
import { FREE_HINTS, usePuzzleStore } from "@/store/usePuzzleStore";
import { usePremiumStore } from "@/store/usePremiumStore";
import { useTheme } from "@/theme";

const MIN_TOUCH_TARGET = 44;

const DIFFICULTY_KEY: Record<Difficulty, TranslationKey> = {
  gentle: "diffGentle",
  easy: "diffEasy",
  medium: "diffMedium",
  hard: "diffHard",
  evil: "diffEvil",
};

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, "0")}`;
}

export default function Game() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const dayKey = usePuzzleStore((s) => s.dayKey);
  const difficulty = usePuzzleStore((s) => s.difficulty);
  const grid = usePuzzleStore((s) => s.grid);
  const givens = usePuzzleStore((s) => s.givens);
  const marks = usePuzzleStore((s) => s.marks);
  const hintsUsed = usePuzzleStore((s) => s.hintsUsed);
  const lastHint = usePuzzleStore((s) => s.lastHint);
  const startedAt = usePuzzleStore((s) => s.startedAt);
  const load = usePuzzleStore((s) => s.load);
  const setCell = usePuzzleStore((s) => s.setCell);
  const toggleMark = usePuzzleStore((s) => s.toggleMark);
  const autoFillMarks = usePuzzleStore((s) => s.autoFillMarks);
  const requestHint = usePuzzleStore((s) => s.requestHint);
  const applyLastHint = usePuzzleStore((s) => s.applyLastHint);
  const recordSolve = usePuzzleStore((s) => s.recordSolve);

  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const announced = useRef(false);

  // `new Date()` once per mount, not during every render — the React Compiler's purity rule
  // and correctness agree here.
  const today = useMemo(() => new Date(), []);

  const conflicts = usePuzzleStore((s) => s.conflictIndices)();
  const isSolvedNow = usePuzzleStore((s) => s.isSolvedNow)();

  // Load today's puzzle on first mount when nothing is in progress.
  useEffect(() => {
    if (dayKey === null) load(dateKey(today), difficulty, today, isPremium);
  }, [dayKey, load, today, difficulty, isPremium]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (!isSolvedNow || announced.current) return;
    announced.current = true;
    const ms = startedAt ? Date.now() - startedAt : elapsed;
    recordSolve(ms);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      t("solvedTitle"),
      t("solvedBody", { time: formatMs(ms), hints: String(hintsUsed) }),
    );
  }, [isSolvedNow, startedAt, elapsed, hintsUsed, recordSolve]);

  const offerUnlock = useCallback(
    (titleKey: TranslationKey) => {
      Alert.alert(t(titleKey), t("unlockBody"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("removeAdsCta"), onPress: () => router.push("/paywall") },
      ]);
    },
    [router],
  );

  const pickDifficulty = useCallback(
    (next: Difficulty) => {
      announced.current = false;
      setSelected(null);
      setElapsed(0);
      load(dayKey ?? dateKey(today), next, today, isPremium);
    },
    [load, dayKey, today, isPremium],
  );

  // Solving a puzzle never hands you today's puzzle again — the seed is
  // `${day}:${difficulty}`, so replaying the same difficulty would just be
  // the grid the player already finished. Stepping to the next difficulty is
  // what makes "Next Level" actually a new puzzle.
  const nextLevel = useCallback(() => {
    pickDifficulty(nextDifficulty(difficulty));
  }, [pickDifficulty, difficulty]);

  // A cell tap or a digit press once the puzzle is solved must be inert, not
  // just visually locked: a tester reported the board still accepted input
  // after the win popup appeared.
  const selectCell = useCallback(
    (index: number) => {
      if (isSolvedNow) return;
      setSelected(index);
    },
    [isSolvedNow],
  );

  const enter = useCallback(
    (value: number) => {
      if (isSolvedNow || selected === null) return;
      if (noteMode) {
        toggleMark(selected, value);
        return;
      }
      setCell(selected, value);
      void Haptics.selectionAsync();
    },
    [isSolvedNow, selected, noteMode, toggleMark, setCell],
  );

  const doHint = useCallback(() => {
    const outcome = requestHint(isPremium);
    if (outcome === "limit-reached") {
      offerUnlock("hintLimitTitle");
      return;
    }
    if (outcome === "none-available") {
      Alert.alert(t("hintNoneTitle"), t("hintNoneBody"));
      return;
    }
    const hint = usePuzzleStore.getState().lastHint;
    if (hint) setSelected(hint.index);
  }, [requestHint, isPremium, offerUnlock]);

  const doAutoNotes = useCallback(() => {
    if (autoFillMarks(isPremium) === "locked") offerUnlock("lockedTitle");
  }, [autoFillMarks, isPremium, offerUnlock]);

  const hintText = lastHint
    ? t(
        lastHint.technique === "nakedSingle"
          ? "hintNakedSingle"
          : "hintHiddenSingle",
        {
          row: String(rowOf(lastHint.index) + 1),
          col: String(colOf(lastHint.index) + 1),
          value: String(lastHint.value),
        },
      )
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* topInset, because this route sets headerShown:false -- with no
          navigation header above it, nothing else pays the notch, and the
          title renders underneath the status bar. */}
      <Screen scroll topInset>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="display">{t("appName")}</Text>
            <Text variant="caption" tone="muted">
              {`${dayKey ?? ""} · ${t(DIFFICULTY_KEY[difficulty])} · ${t("timeLabel")} ${formatMs(elapsed)}`}
            </Text>
          </View>
          <Button
            label={t("archiveTitle")}
            variant="ghost"
            onPress={() => router.push("/archive")}
          />
        </View>

        <View
          style={[styles.chips, { gap: spacing.xs, marginTop: spacing.md }]}
        >
          {DIFFICULTIES.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={t(DIFFICULTY_KEY[option])}
              accessibilityState={{ selected: difficulty === option }}
              onPress={() => pickDifficulty(option)}
              style={{
                minHeight: MIN_TOUCH_TARGET,
                justifyContent: "center",
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                backgroundColor: colors.surfaceAlt,
                borderWidth: difficulty === option ? 2 : 1,
                borderColor:
                  difficulty === option ? colors.accent : colors.border,
              }}
            >
              <Text variant="caption">{t(DIFFICULTY_KEY[option])}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ alignItems: "center", marginTop: spacing.lg }}>
          <SudokuBoard
            grid={grid}
            givens={givens}
            marks={marks}
            conflicts={conflicts}
            selected={selected}
            highlighted={lastHint ? [lastHint.index] : []}
            onSelect={selectCell}
            disabled={isSolvedNow}
          />
        </View>

        {isSolvedNow ? (
          <Button
            label={t("nextLevelCta")}
            onPress={nextLevel}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        ) : null}

        {conflicts.length > 0 ? (
          <Text
            variant="caption"
            tone="danger"
            style={{ marginTop: spacing.sm }}
          >
            {t("conflictNotice")}
          </Text>
        ) : null}

        {hintText ? (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.base,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="caption">{hintText}</Text>
            <Button
              label={t("hintApplyCta")}
              variant="secondary"
              onPress={applyLastHint}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : null}

        <View
          style={[styles.chips, { gap: spacing.xs, marginTop: spacing.lg }]}
        >
          {Array.from({ length: SIZE }, (_, i) => i + 1).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={String(value)}
              onPress={() => enter(value)}
              style={{
                minWidth: MIN_TOUCH_TARGET,
                minHeight: MIN_TOUCH_TARGET,
                flexGrow: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text variant="bodyStrong">{String(value)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.md }]}>
          <Button
            label={t("eraseCta")}
            variant="secondary"
            onPress={() => enter(0)}
            style={{ flex: 1 }}
          />
          <Button
            label={t("notesCta")}
            variant={noteMode ? "primary" : "secondary"}
            onPress={() => setNoteMode((v) => !v)}
            style={{ flex: 1 }}
          />
        </View>

        <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.sm }]}>
          <Button
            label={
              isPremium
                ? t("hintCta")
                : t("hintsLeft", {
                    n: String(Math.max(0, FREE_HINTS - hintsUsed)),
                  })
            }
            variant="secondary"
            onPress={doHint}
            style={{ flex: 1 }}
          />
          <Button
            label={t("autoNotesCta")}
            variant="secondary"
            onPress={doAutoNotes}
            style={{ flex: 1 }}
          />
        </View>

        <Button
          label={t("settingsTitle")}
          variant="ghost"
          fullWidth
          onPress={() => router.push("/settings")}
          style={{ marginTop: spacing.lg }}
        />
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  chips: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
});
