/** Position of the highlighted card: row index and column within the row. */
export interface Focus {
  row: number;
  col: number;
}

/** Keeps the focus inside the grid, given the number of cards in each row. */
export function clamp(f: Focus, rowSizes: number[]): Focus {
  const row = Math.max(0, Math.min(f.row, rowSizes.length - 1));
  const n = rowSizes[row] ?? 0;
  return {row, col: Math.max(0, Math.min(f.col, Math.max(0, n - 1)))};
}

/**
 * Moves the focus like a TV remote: up/down change row (skipping empty rows),
 * left/right move within the row and stop at the edges.
 */
export function move(
  f: Focus,
  rowSizes: number[],
  dRow: number,
  dCol: number,
): Focus {
  let row = f.row;
  if (dRow) {
    let r = row + dRow;
    while (r >= 0 && r < rowSizes.length && rowSizes[r] === 0) {
      r += dRow;
    }
    if (r >= 0 && r < rowSizes.length) {
      row = r;
    }
  }
  return clamp({row, col: f.col + dCol}, rowSizes);
}
