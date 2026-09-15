import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  FREE_HINTS,
  PUZZLE_CACHE_KEY,
  usePuzzleStore,
} from "../usePuzzleStore";
import { CELLS } from "@/logic/grid";
import { dateKey } from "@/logic/daily";

const today = new Date();
const todayKey = dateKey(today);
const yesterdayKey = dateKey(new Date(Date.now() - 86_400_000));

const reset = () =>
  usePuzzleStore.setState({
    dayKey: null,
    difficulty: "easy",
    givens: new Array(CELLS).fill(0),
    solution: new Array(CELLS).fill(0),
    grid: new Array(CELLS).fill(0),
    marks: {},
    hintsUsed: 0,
    lastHint: null,
    startedAt: null,
    solved: {},
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  reset();
});

describe("loading a day", () => {
  it("loads today for a free player", () => {
    expect(usePuzzleStore.getState().load(todayKey, "easy", today, false)).toBe(
      "loaded",
    );
    expect(
      usePuzzleStore.getState().grid.filter((v) => v !== 0).length,
    ).toBeGreaterThan(16);
  });

  it("refuses a past day to a free player and loads nothing", () => {
    expect(
      usePuzzleStore.getState().load(yesterdayKey, "easy", today, false),
    ).toBe("locked");
    expect(usePuzzleStore.getState().dayKey).toBeNull();
  });

  it("opens the archive to a paying player", () => {
    expect(
      usePuzzleStore.getState().load(yesterdayKey, "easy", today, true),
    ).toBe("loaded");
  });

  it("gives a different puzzle per difficulty on the same day", () => {
    // Otherwise "five difficulties deep" is one puzzle with more clues rubbed out.
    usePuzzleStore.getState().load(todayKey, "easy", today, false);
    const easy = [...usePuzzleStore.getState().grid];
    usePuzzleStore.getState().load(todayKey, "evil", today, false);
    expect(usePuzzleStore.getState().grid).not.toEqual(easy);
  });

  it("gives the same puzzle for the same day and difficulty", () => {
    usePuzzleStore.getState().load(todayKey, "medium", today, false);
    const first = [...usePuzzleStore.getState().grid];
    reset();
    usePuzzleStore.getState().load(todayKey, "medium", today, false);
    expect(usePuzzleStore.getState().grid).toEqual(first);
  });
});

describe("entering digits", () => {
  const load = () =>
    usePuzzleStore.getState().load(todayKey, "easy", today, false);
  const firstEmpty = () =>
    usePuzzleStore.getState().grid.findIndex((v) => v === 0);
  const firstGiven = () =>
    usePuzzleStore.getState().givens.findIndex((v) => v !== 0);

  it("fills an empty cell", () => {
    load();
    const i = firstEmpty();
    usePuzzleStore.getState().setCell(i, 5);
    expect(usePuzzleStore.getState().grid[i]).toBe(5);
  });

  it("refuses to overwrite a clue", () => {
    // A clue is part of the puzzle. Overwriting one lets a player solve a different puzzle.
    load();
    const i = firstGiven();
    const original = usePuzzleStore.getState().grid[i];
    usePuzzleStore.getState().setCell(i, 9);
    expect(usePuzzleStore.getState().grid[i]).toBe(original);
  });

  it("ignores a value outside 0..9 and an index off the board", () => {
    load();
    const i = firstEmpty();
    usePuzzleStore.getState().setCell(i, 12);
    expect(usePuzzleStore.getState().grid[i]).toBe(0);
    expect(() => usePuzzleStore.getState().setCell(999, 5)).not.toThrow();
  });

  it("clears pencil marks for a cell once a digit is entered", () => {
    load();
    const i = firstEmpty();
    usePuzzleStore.getState().toggleMark(i, 3);
    usePuzzleStore.getState().setCell(i, 5);
    expect(usePuzzleStore.getState().marks[i]).toEqual([]);
  });

  it("toggles a pencil mark on and off, keeping them sorted", () => {
    load();
    const i = firstEmpty();
    usePuzzleStore.getState().toggleMark(i, 7);
    usePuzzleStore.getState().toggleMark(i, 2);
    expect(usePuzzleStore.getState().marks[i]).toEqual([2, 7]);
    usePuzzleStore.getState().toggleMark(i, 7);
    expect(usePuzzleStore.getState().marks[i]).toEqual([2]);
  });

  it("refuses a pencil mark on a clue", () => {
    load();
    usePuzzleStore.getState().toggleMark(firstGiven(), 4);
    expect(usePuzzleStore.getState().marks[firstGiven()]).toBeUndefined();
  });
});

describe("hints — three free, then the purchase", () => {
  beforeEach(() => {
    usePuzzleStore.getState().load(todayKey, "easy", today, false);
  });

  it("gives a hint that names its technique", () => {
    expect(usePuzzleStore.getState().requestHint(false)).toBe("given");
    const hint = usePuzzleStore.getState().lastHint!;
    expect(["nakedSingle", "hiddenSingle"]).toContain(hint.technique);
    expect(hint.because.length).toBeGreaterThan(0);
  });

  it("a hint is always correct", () => {
    usePuzzleStore.getState().requestHint(false);
    const hint = usePuzzleStore.getState().lastHint!;
    expect(usePuzzleStore.getState().solution[hint.index]).toBe(hint.value);
  });

  it("stops a free player after three", () => {
    for (let i = 0; i < FREE_HINTS; i += 1) {
      expect(usePuzzleStore.getState().requestHint(false)).toBe("given");
      usePuzzleStore.getState().applyLastHint();
    }
    expect(usePuzzleStore.getState().requestHint(false)).toBe("limit-reached");
  });

  it("does not stop a paying player", () => {
    for (let i = 0; i < FREE_HINTS + 3; i += 1) {
      expect(usePuzzleStore.getState().requestHint(true)).toBe("given");
      usePuzzleStore.getState().applyLastHint();
    }
  });

  it("applying a hint writes the value", () => {
    usePuzzleStore.getState().requestHint(false);
    const hint = usePuzzleStore.getState().lastHint!;
    usePuzzleStore.getState().applyLastHint();
    expect(usePuzzleStore.getState().grid[hint.index]).toBe(hint.value);
  });
});

describe("auto-filled pencil marks", () => {
  beforeEach(() => {
    usePuzzleStore.getState().load(todayKey, "easy", today, false);
  });

  it("is refused to a free player — the paywall sells it", () => {
    expect(usePuzzleStore.getState().autoFillMarks(false)).toBe("locked");
    expect(usePuzzleStore.getState().marks).toEqual({});
  });

  it("fills every empty cell with its candidates for a paying player", () => {
    expect(usePuzzleStore.getState().autoFillMarks(true)).toBe("filled");
    const { grid, marks } = usePuzzleStore.getState();
    const emptyCount = grid.filter((v) => v === 0).length;
    expect(Object.keys(marks)).toHaveLength(emptyCount);
  });
});

describe("solving", () => {
  it("detects a conflict", () => {
    usePuzzleStore.getState().load(todayKey, "easy", today, false);
    const { grid, givens } = usePuzzleStore.getState();
    const empty = grid.findIndex((v) => v === 0);
    // Copy a value from a peer in the same row to force a clash.
    const row = Math.floor(empty / 9);
    const clash = grid.findIndex(
      (v, i) => v !== 0 && Math.floor(i / 9) === row,
    );
    usePuzzleStore.getState().setCell(empty, grid[clash]!);
    expect(usePuzzleStore.getState().conflictIndices().length).toBeGreaterThan(
      0,
    );
    expect(givens).toBeDefined();
  });

  it("knows when the puzzle is finished", () => {
    usePuzzleStore.getState().load(todayKey, "easy", today, false);
    const { solution, givens } = usePuzzleStore.getState();
    for (let i = 0; i < CELLS; i += 1) {
      if (givens[i] === 0) usePuzzleStore.getState().setCell(i, solution[i]!);
    }
    expect(usePuzzleStore.getState().isSolvedNow()).toBe(true);
  });

  it("records a solve, keeping the better time on a replay", () => {
    usePuzzleStore.getState().load(todayKey, "easy", today, false);
    usePuzzleStore.getState().recordSolve(120_000);
    usePuzzleStore.getState().recordSolve(200_000);
    expect(usePuzzleStore.getState().solved[todayKey]!.ms).toBe(120_000);
  });
});

describe("persistence", () => {
  it("round-trips a puzzle in progress", async () => {
    usePuzzleStore.getState().load(todayKey, "medium", today, false);
    const i = usePuzzleStore.getState().grid.findIndex((v) => v === 0);
    usePuzzleStore.getState().setCell(i, 4);
    await usePuzzleStore.getState().persist();

    reset();
    await usePuzzleStore.getState().hydrate();
    expect(usePuzzleStore.getState().dayKey).toBe(todayKey);
    expect(usePuzzleStore.getState().grid[i]).toBe(4);
  });

  it("starts clean on stored rubbish rather than half-restoring a puzzle", async () => {
    await AsyncStorage.setItem(
      PUZZLE_CACHE_KEY,
      '{"dayKey":"2026-09-15","grid":"short"}',
    );
    await usePuzzleStore.getState().hydrate();
    expect(usePuzzleStore.getState().dayKey).toBeNull();
    expect(usePuzzleStore.getState().grid.every((v) => v === 0)).toBe(true);
  });

  it("keeps the solved record even when the puzzle itself is unreadable", async () => {
    await AsyncStorage.setItem(
      PUZZLE_CACHE_KEY,
      JSON.stringify({
        grid: "nope",
        solved: { "2026-09-15": { difficulty: "easy", ms: 1, hintsUsed: 0 } },
      }),
    );
    await usePuzzleStore.getState().hydrate();
    expect(usePuzzleStore.getState().solved["2026-09-15"]).toBeDefined();
  });
});
