/**
 * Solving, counting solutions, and hints that say why.
 *
 * Two things here carry the app's promises.
 *
 * `countSolutions` is what makes "a fair sudoku" true: a puzzle with two solutions cannot be
 * reasoned to an answer, only guessed at, and shipping one is the sudoku equivalent of an
 * unwinnable level. The generator refuses to publish a puzzle this does not return 1 for.
 *
 * `findHint` is what makes "technique explanations" true. A hint that only fills a cell is a
 * cheat; a hint that names the technique and the cells that force it teaches the player
 * something, which is the difference the paywall is describing.
 */
import {
  CELLS,
  SIZE,
  type Grid,
  boxOf,
  candidates,
  colOf,
  isComplete,
  peersOf,
  rowOf,
  unitCells,
} from "./grid";

export type Technique = "nakedSingle" | "hiddenSingle";

export interface Hint {
  index: number;
  value: number;
  technique: Technique;
  /** The cells that force this placement — what the screen highlights. */
  because: number[];
}

/**
 * Backtracking search, always branching on the most constrained cell.
 *
 * Choosing the cell with the fewest candidates rather than the first empty one is what keeps
 * this fast enough to run inside a generation loop: it turns a search that can explore
 * millions of nodes into one that usually explores a few hundred.
 */
function search(grid: Grid, limit: number, found: Grid[]): void {
  if (found.length >= limit) return;

  let target = -1;
  let best: number[] = [];
  for (let i = 0; i < CELLS; i += 1) {
    if (grid[i] !== 0) continue;
    const options = candidates(grid, i);
    // No candidates for an empty cell: this branch is dead.
    if (options.length === 0) return;
    if (target === -1 || options.length < best.length) {
      target = i;
      best = options;
      if (options.length === 1) break;
    }
  }

  if (target === -1) {
    found.push([...grid]);
    return;
  }

  for (const value of best) {
    grid[target] = value;
    search(grid, limit, found);
    grid[target] = 0;
    if (found.length >= limit) return;
  }
}

/**
 * Whether the clues already present break a rule.
 *
 * Checked before searching, not during: the search only ever reasons about *empty* cells, so
 * a grid that arrives with two 5s in one row looks perfectly searchable to it and would come
 * back "solved" while still containing the contradiction it was handed.
 */
function isConsistent(grid: Grid): boolean {
  for (let i = 0; i < CELLS; i += 1) {
    const value = grid[i]!;
    if (value === 0) continue;
    if (peersOf(i).some((p) => grid[p] === value)) return false;
  }
  return true;
}

/** One solution, or null when there is none. Does not modify the grid it is given. */
export function solve(grid: Grid): Grid | null {
  if (!isConsistent(grid)) return null;
  const found: Grid[] = [];
  search([...grid], 1, found);
  return found[0] ?? null;
}

/**
 * How many solutions a grid has, counting no further than `limit`.
 *
 * The cap is not an optimisation, it is a requirement: an empty grid has about 6.7×10^21
 * solutions, and a counter without one never returns. Callers only ever need to know
 * "exactly one or not", so the default of 2 answers that in the cheapest possible way.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  if (!isConsistent(grid)) return 0;
  const found: Grid[] = [];
  search([...grid], limit, found);
  return found.length;
}

export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid, 2) === 1;
}

/**
 * The next move a human could justify, with the justification.
 *
 * Naked singles first because they are the easier thing to see: a cell with exactly one
 * remaining candidate. Then hidden singles: a digit that fits in only one cell of a unit,
 * even though that cell has other candidates of its own.
 *
 * Deliberately does **not** fall back to the solver. A hint that cannot be explained is just
 * the answer, and handing over answers is not what the paywall sells.
 */
export function findHint(grid: Grid): Hint | null {
  if (isComplete(grid)) return null;

  for (let i = 0; i < CELLS; i += 1) {
    if (grid[i] !== 0) continue;
    const options = candidates(grid, i);
    if (options.length === 1) {
      return {
        index: i,
        value: options[0]!,
        technique: "nakedSingle",
        // The filled peers are precisely what eliminated the other eight digits.
        because: peersOf(i).filter((p) => grid[p] !== 0),
      };
    }
  }

  const units: ["row" | "col" | "box", number][] = [];
  for (let n = 0; n < SIZE; n += 1)
    units.push(["row", n], ["col", n], ["box", n]);

  for (const [kind, n] of units) {
    const cells = unitCells(kind, n);
    for (let value = 1; value <= SIZE; value += 1) {
      if (cells.some((c) => grid[c] === value)) continue;
      const fits = cells.filter(
        (c) => grid[c] === 0 && candidates(grid, c).includes(value),
      );
      if (fits.length === 1) {
        return {
          index: fits[0]!,
          value,
          technique: "hiddenSingle",
          // The rest of the unit is what rules out every other cell for this digit.
          because: cells.filter((c) => c !== fits[0]),
        };
      }
    }
  }

  return null;
}

/** Every cell a naked or hidden single can currently justify — the pencil-mark auto-fill. */
export function pencilMarks(grid: Grid): Map<number, number[]> {
  const marks = new Map<number, number[]>();
  for (let i = 0; i < CELLS; i += 1) {
    if (grid[i] !== 0) continue;
    marks.set(i, candidates(grid, i));
  }
  return marks;
}

/** Exported for the generator's difficulty grading. */
export { rowOf, colOf, boxOf };
