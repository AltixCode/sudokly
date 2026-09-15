import { parseGrid, serialiseGrid } from "../grid";
import { countSolutions, findHint, hasUniqueSolution, solve } from "../solver";

const EASY =
  "53..7...." +
  "6..195..." +
  ".98....6." +
  "8...6...3" +
  "4..8.3..1" +
  "7...2...6" +
  ".6....28." +
  "...419..5" +
  "....8..79";

const SOLUTION =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

describe("solve", () => {
  it("solves a standard puzzle", () => {
    expect(serialiseGrid(solve(parseGrid(EASY)!)!)).toBe(SOLUTION);
  });

  it("solves an empty grid — every empty grid has solutions", () => {
    expect(solve(parseGrid(".".repeat(81))!)).not.toBeNull();
  });

  it("returns null for a grid that contradicts itself", () => {
    // Two 5s in the same row: no solution exists and the solver must say so rather than
    // returning a grid that breaks the rules.
    const bad = parseGrid("55" + ".".repeat(79))!;
    expect(solve(bad)).toBeNull();
  });

  it("leaves the given grid alone", () => {
    const grid = parseGrid(EASY)!;
    const copy = [...grid];
    solve(grid);
    expect(grid).toEqual(copy);
  });
});

describe("countSolutions — the property that makes a puzzle fair", () => {
  it("is 1 for a proper puzzle", () => {
    expect(countSolutions(parseGrid(EASY)!)).toBe(1);
  });

  it("is 0 for a contradiction", () => {
    expect(countSolutions(parseGrid("55" + ".".repeat(79))!)).toBe(0);
  });

  it("is more than 1 when a puzzle is under-constrained", () => {
    // One row of clues and nothing else. A puzzle like this cannot be reasoned to an answer,
    // only guessed at, which is precisely what the generator must never publish.
    const sparse = parseGrid(SOLUTION.slice(0, 9) + ".".repeat(72))!;
    expect(countSolutions(sparse)).toBeGreaterThan(1);
  });

  it("stops counting early rather than enumerating everything", () => {
    // An empty grid has 6.67e21 solutions. A counter without a cap never returns.
    const start = Date.now();
    expect(countSolutions(parseGrid(".".repeat(81))!, 2)).toBe(2);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("hasUniqueSolution", () => {
  it("accepts a proper puzzle and rejects an ambiguous one", () => {
    expect(hasUniqueSolution(parseGrid(EASY)!)).toBe(true);
    const ambiguous = parseGrid(SOLUTION.slice(0, 9) + ".".repeat(72))!;
    expect(hasUniqueSolution(ambiguous)).toBe(false);
  });
});

describe("findHint — a hint names its reasoning", () => {
  it("finds a naked single and says which cell and why", () => {
    // One empty cell whose peers use the other eight digits.
    const grid = parseGrid(SOLUTION)!;
    grid[40] = 0;
    const hint = findHint(grid);
    expect(hint).not.toBeNull();
    expect(hint!.index).toBe(40);
    expect(hint!.value).toBe(parseGrid(SOLUTION)![40]);
    expect(hint!.technique).toBe("nakedSingle");
  });

  it("finds a hidden single — the only cell in a unit that can take a digit", () => {
    const grid = parseGrid(EASY)!;
    const hint = findHint(grid);
    expect(hint).not.toBeNull();
    expect(["nakedSingle", "hiddenSingle"]).toContain(hint!.technique);
    // Whatever it claims must actually be right.
    expect(parseGrid(SOLUTION)![hint!.index]).toBe(hint!.value);
  });

  it("carries the peers that justify it, so the screen can show the reasoning", () => {
    const grid = parseGrid(SOLUTION)!;
    grid[40] = 0;
    expect(findHint(grid)!.because.length).toBeGreaterThan(0);
  });

  it("returns null for a finished grid rather than inventing a move", () => {
    expect(findHint(parseGrid(SOLUTION)!)).toBeNull();
  });

  it("never suggests a value that contradicts the solution", () => {
    // Walking a whole puzzle with hints must finish it, and every step must be correct.
    let grid = parseGrid(EASY)!;
    const solution = parseGrid(SOLUTION)!;
    for (let step = 0; step < 81; step += 1) {
      const hint = findHint(grid);
      if (!hint) break;
      expect(hint.value).toBe(solution[hint.index]);
      grid = grid.map((v, i) => (i === hint.index ? hint.value : v));
    }
    expect(serialiseGrid(grid)).toBe(SOLUTION);
  });
});
