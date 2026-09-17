import React from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { Text } from "@/components/ui";
import { t } from "@/i18n";
import { BOX, CELLS, SIZE, type Grid, colOf, rowOf } from "@/logic/grid";
import { useTheme, withAlpha } from "@/theme";

interface BoardProps {
  grid: Grid;
  givens: Grid;
  marks: Record<number, number[]>;
  conflicts: number[];
  selected: number | null;
  /** Cells the current hint is pointing at. */
  highlighted: number[];
  onSelect: (index: number) => void;
}

/**
 * The 9×9 board.
 *
 * Box boundaries are drawn with thicker borders rather than with gaps, because a gap changes
 * the cell size and the grid stops being square on narrow screens. The board is sized from the
 * smaller of width and a cap so it never overflows.
 */
export function SudokuBoard({
  grid,
  givens,
  marks,
  conflicts,
  selected,
  highlighted,
  onSelect,
}: BoardProps) {
  const { colors, spacing, radius } = useTheme();
  const { width, height } = useWindowDimensions();

  // 420 on every device put a phone-sized grid in the middle of a 13" iPad.
  // The height term leaves room for the number pad below, which a square board
  // sized only from width would push off a short window.
  const isTablet = width >= 700;
  const side = Math.min(width - spacing.xl * 2, height * 0.55, isTablet ? 700 : 420);
  const cell = side / SIZE;
  const selectedRow = selected === null ? -1 : rowOf(selected);
  const selectedCol = selected === null ? -1 : colOf(selected);

  return (
    <View
      style={{
        width: side,
        height: side,
        borderRadius: radius.sm,
        borderWidth: 2,
        borderColor: colors.textMuted,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: SIZE }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: SIZE }, (_, col) => {
            const index = row * SIZE + col;
            const value = grid[index] ?? 0;
            const given = (givens[index] ?? 0) !== 0;
            const clashing = conflicts.includes(index);
            const isSelected = selected === index;
            // The row, column and box of the selection are tinted: it is how a player checks
            // a candidate without counting squares by eye.
            const related =
              selected !== null &&
              (rowOf(index) === selectedRow ||
                colOf(index) === selectedCol ||
                (Math.floor(rowOf(index) / BOX) ===
                  Math.floor(selectedRow / BOX) &&
                  Math.floor(colOf(index) / BOX) ===
                    Math.floor(selectedCol / BOX)));

            // Tints derived from the palette rather than new tokens: these are states of a
            // cell, not colours of their own, and deriving them keeps both themes consistent.
            const background = clashing
              ? withAlpha(colors.danger, 0.18)
              : isSelected
                ? withAlpha(colors.accent, 0.22)
                : highlighted.includes(index)
                  ? withAlpha(colors.success, 0.18)
                  : related
                    ? colors.surfaceAlt
                    : colors.surface;

            const label = given
              ? t("cellGiven", {
                  row: String(row + 1),
                  col: String(col + 1),
                  value: String(value),
                })
              : t("cellLabel", {
                  row: String(row + 1),
                  col: String(col + 1),
                  value: value === 0 ? t("cellEmpty") : String(value),
                });

            return (
              <Pressable
                key={col}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(index)}
                style={{
                  width: cell,
                  height: cell,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: background,
                  // Thick lines on box edges, hairlines elsewhere.
                  borderRightWidth:
                    col % BOX === BOX - 1 && col !== SIZE - 1
                      ? 2
                      : StyleSheet.hairlineWidth,
                  borderBottomWidth:
                    row % BOX === BOX - 1 && row !== SIZE - 1
                      ? 2
                      : StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                }}
              >
                {value !== 0 ? (
                  <Text
                    variant="numeric"
                    tone={clashing ? "danger" : given ? "default" : "accent"}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {String(value)}
                  </Text>
                ) : (marks[index]?.length ?? 0) > 0 ? (
                  <Text
                    variant="micro"
                    tone="faint"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {marks[index]!.join("")}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export const TOTAL_CELLS = CELLS;

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
});
