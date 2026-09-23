/**
 * Puzzle generation.
 *
 * The rule this module exists to enforce: **every puzzle it returns has exactly one
 * solution.** A sudoku with two solutions cannot be reasoned to an answer, only guessed at,
 * and "a fair sudoku every day" would be untrue the first time one shipped. Every removal is
 * therefore provisional — a clue comes out only if the puzzle still has a unique solution
 * afterwards, and goes straight back if it does not.
 *
 * Pure and dependency-free with the random source injected, so a day's puzzle is reproducible
 * from its date and the fairness property is testable from `npm test` alone.
 */
import { CELLS, SIZE, type Grid, candidates } from "./grid";
import { countSolutions, findHint } from "./solver";

export const DIFFICULTIES = [
  "gentle",
  "easy",
  "medium",
  "hard",
  "evil",
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * How many clues each level aims to leave.
 *
 * A target, not a guarantee: removal stops early whenever taking another clue would make the
 * puzzle ambiguous, so a level occasionally lands a few clues above its target. That is the
 * right way round — a slightly easy puzzle is a disappointment, an ambiguous one is broken.
 */
const CLUE_TARGET: Record<Difficulty, number> = {
  gentle: 45,
  easy: 38,
  medium: 32,
  hard: 28,
  evil: 24,
};

/**
 * No proper sudoku exists with fewer than 17 clues — a proven result. Removing past it is
 * guaranteed wasted work, and the uniqueness check would reject every candidate anyway.
 */
const MIN_CLUES = 17;

type Rng = () => number;

export interface Puzzle {
  difficulty: Difficulty;
  grid: Grid;
  solution: Grid;
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

/**
 * Fills an empty grid with a random complete solution.
 *
 * The same most-constrained-cell search as the solver, but trying candidates in a shuffled
 * order so the result is a random grid rather than the same one every time.
 */
function fillComplete(grid: Grid, rng: Rng): boolean {
  let target = -1;
  let best: number[] = [];
  for (let i = 0; i < CELLS; i += 1) {
    if (grid[i] !== 0) continue;
    const options = candidates(grid, i);
    if (options.length === 0) return false;
    if (target === -1 || options.length < best.length) {
      target = i;
      best = options;
      if (options.length === 1) break;
    }
  }
  if (target === -1) return true;

  for (const value of shuffled(best, rng)) {
    grid[target] = value;
    if (fillComplete(grid, rng)) return true;
    grid[target] = 0;
  }
  return false;
}

/**
 * A puzzle of the requested difficulty, and the solution it was carved from.
 *
 * Clues are removed in pairs symmetric about the centre, which is what a hand-made sudoku
 * looks like and costs nothing to do. The pair is restored together when removing it would
 * make the grid ambiguous.
 */
export function generate(
  difficulty: Difficulty,
  rng: Rng = Math.random,
): Puzzle {
  const solution: Grid = new Array<number>(CELLS).fill(0);
  fillComplete(solution, rng);

  const grid = [...solution];
  const target = CLUE_TARGET[difficulty];
  let clues = CELLS;

  for (const index of shuffled(
    Array.from({ length: CELLS }, (_, i) => i),
    rng,
  )) {
    if (clues <= Math.max(target, MIN_CLUES)) break;
    if (grid[index] === 0) continue;

    const mirror = CELLS - 1 - index;
    const removed: number[] = [index];
    const saved: number[] = [grid[index]!];
    grid[index] = 0;
    if (
      mirror !== index &&
      grid[mirror] !== 0 &&
      clues - removed.length > MIN_CLUES
    ) {
      removed.push(mirror);
      saved.push(grid[mirror]!);
      grid[mirror] = 0;
    }

    if (countSolutions(grid, 2) === 1) {
      clues -= removed.length;
    } else {
      // Ambiguous: put it back. This is the check that makes the puzzle fair.
      removed.forEach((cell, i) => {
        grid[cell] = saved[i]!;
      });
    }
  }

  return { difficulty, grid, solution };
}

/**
 * How many steps of the puzzle cannot be reached by singles alone.
 *
 * A rough grade rather than a full technique ladder: it repeatedly applies every naked and
 * hidden single available, and counts what is left over. Zero means a player who knows only
 * those two techniques can finish it; a larger number means they will need to guess or learn
 * something harder. It is used to *describe* a generated puzzle, never to accept one —
 * acceptance is `countSolutions` and nothing else.
 */
export function gradeOf(grid: Grid): number {
  const working = [...grid];
  for (let step = 0; step < CELLS; step += 1) {
    const hint = findHint(working);
    if (!hint) break;
    working[hint.index] = hint.value;
  }
  return working.filter((v) => v === 0).length;
}

/**
 * The level a "Next Level" button lands on after a solve.
 *
 * A puzzle is seeded from `${day}:${difficulty}`, so replaying the same day
 * and difficulty would hand back the exact grid just solved. Stepping
 * forward through DIFFICULTIES — wrapping from the hardest back to the
 * easiest — is what makes "next" actually mean a different puzzle.
 */
export function nextDifficulty(current: Difficulty): Difficulty {
  const i = DIFFICULTIES.indexOf(current);
  return DIFFICULTIES[(i + 1) % DIFFICULTIES.length] as Difficulty;
}

export { SIZE };
