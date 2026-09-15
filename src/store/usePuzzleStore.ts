/**
 * The puzzle in play, the hints spent, and the days already solved.
 *
 * Three of the paywall's four claims are enforced here — unlimited hints, auto-filled pencil
 * marks with their technique explanation, and the archive — so each takes `isPremium`
 * explicitly at the call site. The fourth (no ads) is the template's.
 *
 * All the rules are in `src/logic/`; this only sequences them and persists the result.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  CELLS,
  type Grid,
  conflicts,
  isSolved,
  parseGrid,
  serialiseGrid,
} from "@/logic/grid";
import { DIFFICULTIES, type Difficulty, generate } from "@/logic/generator";
import {
  archiveDates,
  dailySeed,
  dateKey,
  isPlayable,
  seededRng,
} from "@/logic/daily";
import { type Hint, findHint, pencilMarks } from "@/logic/solver";

export const PUZZLE_CACHE_KEY = "sudokly.state.v1";

/** Hints a free player gets per puzzle. The purchase makes them unlimited. */
export const FREE_HINTS = 3;

export interface SolvedDay {
  difficulty: Difficulty;
  ms: number;
  hintsUsed: number;
}

interface PuzzleState {
  /** The day being played, or null when nothing is loaded. */
  dayKey: string | null;
  difficulty: Difficulty;
  /** The clues as generated. A given may never be overwritten. */
  givens: Grid;
  solution: Grid;
  grid: Grid;
  /** Pencil marks per cell, as the player entered or auto-filled them. */
  marks: Record<number, number[]>;
  hintsUsed: number;
  lastHint: Hint | null;
  startedAt: number | null;
  solved: Record<string, SolvedDay>;

  load: (
    key: string,
    difficulty: Difficulty,
    today: Date,
    isPremium: boolean,
  ) => "loaded" | "locked";
  setCell: (index: number, value: number) => void;
  toggleMark: (index: number, value: number) => void;
  autoFillMarks: (isPremium: boolean) => "filled" | "locked";
  requestHint: (isPremium: boolean) => "given" | "limit-reached" | "none-available";
  applyLastHint: () => void;
  clearHint: () => void;
  conflictIndices: () => number[];
  isSolvedNow: () => boolean;
  recordSolve: (ms: number) => void;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const emptyGrid = (): Grid => new Array<number>(CELLS).fill(0);

function validSolved(value: unknown): Record<string, SolvedDay> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, SolvedDay> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !entry || typeof entry !== "object")
      continue;
    const { difficulty, ms, hintsUsed } = entry as SolvedDay;
    if (!DIFFICULTIES.includes(difficulty)) continue;
    if (typeof ms !== "number" || typeof hintsUsed !== "number") continue;
    out[key] = { difficulty, ms, hintsUsed };
  }
  return out;
}

export const usePuzzleStore = create<PuzzleState>((set, get) => ({
  dayKey: null,
  difficulty: "easy",
  givens: emptyGrid(),
  solution: emptyGrid(),
  grid: emptyGrid(),
  marks: {},
  hintsUsed: 0,
  lastHint: null,
  startedAt: null,
  solved: {},

  load(key, difficulty, today, isPremium) {
    if (!isPlayable(key, today, isPremium)) return "locked";
    // Seeded by day AND difficulty, so the five levels are five different puzzles rather than
    // the same one carved five ways.
    const puzzle = generate(
      difficulty,
      seededRng(dailySeed(`${key}:${difficulty}`)),
    );
    set({
      dayKey: key,
      difficulty,
      givens: [...puzzle.grid],
      solution: puzzle.solution,
      grid: [...puzzle.grid],
      marks: {},
      hintsUsed: 0,
      lastHint: null,
      startedAt: Date.now(),
    });
    void get().persist();
    return "loaded";
  },

  setCell(index, value) {
    const { givens, grid } = get();
    if (index < 0 || index >= CELLS) return;
    // A clue is part of the puzzle, not the player's answer. Overwriting one would let a
    // player "solve" a different puzzle from the one they were given.
    if (givens[index] !== 0) return;
    if (value < 0 || value > 9) return;

    const next = [...grid];
    next[index] = value;
    set((s) => ({
      grid: next,
      // Entering a digit clears that cell's pencil marks: they were notes about what it might
      // be, and it is no longer a question.
      marks: value === 0 ? s.marks : { ...s.marks, [index]: [] },
      lastHint: null,
    }));
    void get().persist();
  },

  toggleMark(index, value) {
    const { givens, grid } = get();
    if (givens[index] !== 0 || grid[index] !== 0) return;
    if (value < 1 || value > 9) return;
    set((s) => {
      const current = s.marks[index] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value].sort((a, b) => a - b);
      return { marks: { ...s.marks, [index]: next } };
    });
    void get().persist();
  },

  autoFillMarks(isPremium) {
    if (!isPremium) return "locked";
    const marks: Record<number, number[]> = {};
    for (const [index, values] of pencilMarks(get().grid))
      marks[index] = values;
    set({ marks });
    void get().persist();
    return "filled";
  },

  requestHint(isPremium) {
    const { grid, hintsUsed } = get();
    if (!isPremium && hintsUsed >= FREE_HINTS) return "limit-reached";
    const hint = findHint(grid);
    // No naked or hidden single available. Saying so is honest; falling back to the solver
    // would hand over an answer with no reasoning attached, which is not what is being sold.
    if (!hint) return "none-available";
    set({ lastHint: hint, hintsUsed: hintsUsed + 1 });
    void get().persist();
    return "given";
  },

  applyLastHint() {
    const { lastHint } = get();
    if (!lastHint) return;
    get().setCell(lastHint.index, lastHint.value);
  },

  clearHint() {
    set({ lastHint: null });
  },

  conflictIndices() {
    return conflicts(get().grid);
  },

  isSolvedNow() {
    return isSolved(get().grid);
  },

  recordSolve(ms) {
    const { dayKey, difficulty, hintsUsed } = get();
    if (!dayKey) return;
    set((s) => {
      const existing = s.solved[dayKey];
      // A replay keeps the better time rather than the most recent.
      if (existing && existing.ms <= ms) return s;
      return {
        solved: { ...s.solved, [dayKey]: { difficulty, ms, hintsUsed } },
      };
    });
    void get().persist();
  },

  async persist() {
    const {
      dayKey,
      difficulty,
      givens,
      solution,
      grid,
      marks,
      hintsUsed,
      solved,
    } = get();
    try {
      await AsyncStorage.setItem(
        PUZZLE_CACHE_KEY,
        JSON.stringify({
          dayKey,
          difficulty,
          givens: serialiseGrid(givens),
          solution: serialiseGrid(solution),
          grid: serialiseGrid(grid),
          marks,
          hintsUsed,
          solved,
        }),
      );
    } catch {
      // A lost puzzle is survivable; a failed launch is not.
    }
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(PUZZLE_CACHE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as Record<string, unknown>;

      const givens =
        typeof record.givens === "string" ? parseGrid(record.givens) : null;
      const solution =
        typeof record.solution === "string" ? parseGrid(record.solution) : null;
      const grid =
        typeof record.grid === "string" ? parseGrid(record.grid) : null;
      const usable = givens && solution && grid;

      set({
        solved: validSolved(record.solved),
        // Anything short of all three grids parsing means there is no coherent puzzle to
        // resume, and half a restored puzzle is worse than none.
        dayKey:
          usable && typeof record.dayKey === "string" ? record.dayKey : null,
        difficulty: DIFFICULTIES.includes(record.difficulty as Difficulty)
          ? (record.difficulty as Difficulty)
          : "easy",
        givens: usable ? givens : emptyGrid(),
        solution: usable ? solution : emptyGrid(),
        grid: usable ? grid : emptyGrid(),
        marks:
          usable && record.marks && typeof record.marks === "object"
            ? (record.marks as Record<number, number[]>)
            : {},
        hintsUsed:
          usable && typeof record.hintsUsed === "number" ? record.hintsUsed : 0,
        lastHint: null,
        // The clock restarts rather than restoring: a resumed puzzle's elapsed time would
        // include however long the app was closed, and the recorded time would be wrong.
        startedAt: usable ? Date.now() : null,
      });
    } catch {
      // Unreadable storage starts clean rather than preventing launch.
    }
  },
}));

export { archiveDates, dateKey };
