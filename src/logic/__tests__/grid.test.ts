import {
  CELLS,
  SIZE,
  boxOf,
  candidates,
  cellIndex,
  colOf,
  isComplete,
  isSolved,
  parseGrid,
  peersOf,
  rowOf,
  serialiseGrid,
} from "../grid";

/** A completed, valid solution. Used as the base for most of these. */
const SOLVED = parseGrid(
  "534678912" +
    "672195348" +
    "198342567" +
    "859761423" +
    "426853791" +
    "713924856" +
    "961537284" +
    "287419635" +
    "345286179",
)!;

describe("coordinates", () => {
  it("has 81 cells", () => {
    expect(CELLS).toBe(81);
    expect(SIZE).toBe(9);
  });

  it("maps an index to its row, column and box", () => {
    expect(rowOf(0)).toBe(0);
    expect(colOf(0)).toBe(0);
    expect(boxOf(0)).toBe(0);

    expect(rowOf(80)).toBe(8);
    expect(colOf(80)).toBe(8);
    expect(boxOf(80)).toBe(8);

    // Middle box, middle cell.
    expect(boxOf(cellIndex(4, 4))).toBe(4);
  });

  it("round-trips row and column through cellIndex", () => {
    for (let i = 0; i < CELLS; i += 1) {
      expect(cellIndex(rowOf(i), colOf(i))).toBe(i);
    }
  });
});

describe("peersOf", () => {
  it("gives exactly 20 peers — 8 in the row, 8 in the column, 4 more in the box", () => {
    // A cell shares a row, a column and a box; the overlaps are why it is 20 and not 24.
    for (let i = 0; i < CELLS; i += 1) {
      expect(peersOf(i)).toHaveLength(20);
    }
  });

  it("never includes the cell itself", () => {
    for (let i = 0; i < CELLS; i += 1) {
      expect(peersOf(i)).not.toContain(i);
    }
  });

  it("is symmetric — if a is a peer of b then b is a peer of a", () => {
    for (let i = 0; i < CELLS; i += 1) {
      for (const peer of peersOf(i)) {
        expect(peersOf(peer)).toContain(i);
      }
    }
  });
});

describe("parseGrid and serialiseGrid", () => {
  it("round-trips", () => {
    expect(serialiseGrid(SOLVED)).toHaveLength(CELLS);
    expect(parseGrid(serialiseGrid(SOLVED))).toEqual(SOLVED);
  });

  it("treats a dot as an empty cell", () => {
    const grid = parseGrid(".".repeat(CELLS))!;
    expect(grid.every((v) => v === 0)).toBe(true);
  });

  it("refuses a string of the wrong length rather than padding it", () => {
    expect(parseGrid("123")).toBeNull();
    expect(parseGrid("1".repeat(CELLS + 1))).toBeNull();
  });

  it("refuses characters that are not digits or dots", () => {
    expect(parseGrid("x".repeat(CELLS))).toBeNull();
  });
});

describe("candidates", () => {
  it("is empty for a cell that is already filled", () => {
    expect(candidates(SOLVED, 0)).toEqual([]);
  });

  it("excludes every value already used by a peer", () => {
    const grid = [...SOLVED];
    const value = grid[0]!;
    grid[0] = 0;
    // Only the value that was removed can legally go back.
    expect(candidates(grid, 0)).toEqual([value]);
  });

  it("is every digit for an empty grid", () => {
    const empty = parseGrid(".".repeat(CELLS))!;
    expect(candidates(empty, 40)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("isComplete and isSolved", () => {
  it("a full valid grid is both", () => {
    expect(isComplete(SOLVED)).toBe(true);
    expect(isSolved(SOLVED)).toBe(true);
  });

  it("a grid with a hole is complete-false", () => {
    const grid = [...SOLVED];
    grid[5] = 0;
    expect(isComplete(grid)).toBe(false);
    expect(isSolved(grid)).toBe(false);
  });

  it("a full grid with a duplicate is complete but NOT solved", () => {
    // This is the distinction that matters: "every cell filled" is not "correct", and a game
    // that congratulates on completeness alone congratulates a wrong answer.
    const grid = [...SOLVED];
    grid[1] = grid[0]!;
    expect(isComplete(grid)).toBe(true);
    expect(isSolved(grid)).toBe(false);
  });
});
