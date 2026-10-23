import type { BP } from './useBreakpoint';

const ORDER: BP[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

// Pure layout decision for <Columns>, kept apart from React so it can be unit-tested.
//   row   : all cells side by side (flex weights)
//   wrap  : cells flow onto more lines, each at least minCell wide (4 inputs → 2 + 2 on a phone)
//   stack : every cell on its own line
export type ColumnsMode = 'row' | 'wrap' | 'stack';

export function columnsMode({ width, n, gap, side, minCell, bp, stackAt, wrap }: {
  width: number; n: number; gap: number; side: number; minCell: number;
  bp: BP; stackAt?: BP; wrap?: boolean;
}): ColumnsMode {
  if (n <= 1) return 'row';
  if (stackAt !== undefined && ORDER.indexOf(bp) <= ORDER.indexOf(stackAt)) return 'stack';
  const cell = (width - 2 * side - gap * (n - 1)) / n;
  if (cell >= minCell) return 'row';
  if (!wrap) return 'stack';
  // Wrapping only helps if at least two cells fit on a line; otherwise stack.
  const perLine = Math.floor((width - 2 * side + gap) / (minCell + gap));
  return perLine >= 2 ? 'wrap' : 'stack';
}

// Usable minimum widths by content. 44 is the touch floor (icon buttons);
// a labelled input needs room for about ten characters.
export const CELL_MIN = { touch: 44, input: 128, button: 96 } as const;
