import { CELLS, isSolved, parseGrid } from "../grid";
import { DIFFICULTIES, type Difficulty, generate, gradeOf } from "../generator";
import { hasUniqueSolution, solve } from "../solver";
import { seededRng } from "../daily";

describe("generate", () => {
  it.each(DIFFICULTIES)(
    "produces a %s puzzle with exactly one solution",
    (difficulty) => {
      // This is the app's central promise. A puzzle with two solutions cannot be reasoned to an
      // answer, only guessed at — shipping one would make "a fair sudoku" a lie.
      const puzzle = generate(difficulty, seededRng(1234));
      expect(hasUniqueSolution(puzzle.grid)).toBe(true);
    },
  );

  it("gives a solution that actually solves the puzzle", () => {
    const puzzle = generate("easy", seededRng(99));
    expect(isSolved(puzzle.solution)).toBe(true);
    // Every clue must agree with the solution it ships with.
    puzzle.grid.forEach((value, i) => {
      if (value !== 0) expect(puzzle.solution[i]).toBe(value);
    });
  });

  it("is deterministic for a seed — everyone gets the same daily puzzle", () => {
    const a = generate("medium", seededRng(2026));
    const b = generate("medium", seededRng(2026));
    expect(a.grid).toEqual(b.grid);
    expect(a.solution).toEqual(b.solution);
  });

  it("differs between seeds", () => {
    expect(generate("medium", seededRng(1)).grid).not.toEqual(
      generate("medium", seededRng(2)).grid,
    );
  });

  it("gets harder as the difficulty rises, measured in clues", () => {
    const clues = (d: Difficulty) =>
      generate(d, seededRng(7)).grid.filter((v) => v !== 0).length;
    // Not a strict ordering between adjacent levels on a single seed, but the ends must differ.
    expect(clues("easy")).toBeGreaterThan(clues("evil"));
  });

  it("never leaves fewer than 17 clues, below which no unique puzzle exists", () => {
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generate(difficulty, seededRng(55));
      expect(puzzle.grid.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(
        17,
      );
    }
  });

  it("produces a grid of the right size with legal values only", () => {
    const puzzle = generate("hard", seededRng(3));
    expect(puzzle.grid).toHaveLength(CELLS);
    for (const value of puzzle.grid) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it("is solvable by the solver", () => {
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generate(difficulty, seededRng(11));
      expect(solve(puzzle.grid)).not.toBeNull();
    }
  });
});

describe("gradeOf", () => {
  it("calls a puzzle solvable by singles alone easier than one that is not", () => {
    const easy = generate("easy", seededRng(5));
    expect(gradeOf(easy.grid)).toBeLessThanOrEqual(
      gradeOf(generate("evil", seededRng(5)).grid),
    );
  });

  it("is zero for an already-solved grid", () => {
    expect(
      gradeOf(
        parseGrid(
          "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
        )!,
      ),
    ).toBe(0);
  });
});
