/**
 * The 9×9 grid: coordinates, peers, candidates, and what "solved" means.
 *
 * A grid is a flat array of 81 numbers, 0 for empty. Flat rather than nested because every
 * operation in the solver is over peers, which cross rows, columns and boxes — a 2-D array
 * makes that arithmetic harder to read and no easier to reason about.
 *
 * Pure and dependency-free, like the rest of `src/logic/`.
 */

export const SIZE = 9;
export const BOX = 3;
export const CELLS = SIZE * SIZE;

export type Grid = number[];

export const rowOf = (index: number): number => Math.floor(index / SIZE);
export const colOf = (index: number): number => index % SIZE;
export const boxOf = (index: number): number =>
  Math.floor(rowOf(index) / BOX) * BOX + Math.floor(colOf(index) / BOX);
export const cellIndex = (row: number, col: number): number => row * SIZE + col;

/**
 * The 20 cells that constrain a given cell.
 *
 * Twenty, not twenty-four: the row contributes 8, the column 8, and the box only 4 more,
 * because four of the box's eight others are already in that row or column. Computed once at
 * module load — it is called for every cell on every solver step.
 */
const PEERS: number[][] = Array.from({ length: CELLS }, (_, index) => {
  const peers = new Set<number>();
  const row = rowOf(index);
  const col = colOf(index);
  for (let i = 0; i < SIZE; i += 1) {
    peers.add(cellIndex(row, i));
    peers.add(cellIndex(i, col));
  }
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let r = boxRow; r < boxRow + BOX; r += 1) {
    for (let c = boxCol; c < boxCol + BOX; c += 1) peers.add(cellIndex(r, c));
  }
  peers.delete(index);
  return [...peers];
});

export function peersOf(index: number): number[] {
  return PEERS[index] ?? [];
}

/** The nine cells of a unit. `kind` selects row, column or box. */
export function unitCells(kind: "row" | "col" | "box", n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i += 1) {
    const which =
      kind === "row" ? rowOf(i) : kind === "col" ? colOf(i) : boxOf(i);
    if (which === n) out.push(i);
  }
  return out;
}

/** `.` or `0` is empty. Returns null rather than a half-parsed grid. */
export function parseGrid(text: string): Grid | null {
  if (text.length !== CELLS) return null;
  const grid: Grid = [];
  for (const ch of text) {
    if (ch === "." || ch === "0") {
      grid.push(0);
      continue;
    }
    if (ch < "1" || ch > "9") return null;
    grid.push(Number(ch));
  }
  return grid;
}

export function serialiseGrid(grid: Grid): string {
  return grid.map((v) => (v === 0 ? "." : String(v))).join("");
}

/** Values that could legally go in an empty cell. Empty for a cell that is already filled. */
export function candidates(grid: Grid, index: number): number[] {
  if (grid[index] !== 0) return [];
  const used = new Set(peersOf(index).map((p) => grid[p]!));
  const out: number[] = [];
  for (let v = 1; v <= SIZE; v += 1) if (!used.has(v)) out.push(v);
  return out;
}

/** Whether placing `value` at `index` breaks no rule. */
export function isLegal(grid: Grid, index: number, value: number): boolean {
  if (value === 0) return true;
  return !peersOf(index).some((p) => grid[p] === value);
}

/** Every cell filled. Says nothing about whether they are right. */
export function isComplete(grid: Grid): boolean {
  return grid.every((v) => v !== 0);
}

/**
 * Filled **and** correct.
 *
 * Kept separate from `isComplete` on purpose: a game that celebrates on completeness alone
 * celebrates a wrong answer, which is worse than not celebrating at all.
 */
export function isSolved(grid: Grid): boolean {
  if (!isComplete(grid)) return false;
  return grid.every(
    (value, index) => !peersOf(index).some((p) => grid[p] === value),
  );
}

/** Indices whose value conflicts with a peer. What the board highlights in red. */
export function conflicts(grid: Grid): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i += 1) {
    const value = grid[i]!;
    if (value === 0) continue;
    if (peersOf(i).some((p) => grid[p] === value)) out.push(i);
  }
  return out;
}
