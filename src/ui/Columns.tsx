import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { layout } from './tokens';
import { useBreakpoint, type BP } from './useBreakpoint';
import { CELL_MIN, columnsMode } from './columnsMode';

// One row of columns (Three-Slot Screen rule 4). Each child becomes a column
// with `flex` 1, or the matching entry of `weights` (e.g. [1, 1.4]).
//
// `kind` sets the usable minimum per cell: 'touch' 44 (icon buttons, the
// default), 'input' 128 (labelled fields), 'button' 96; `minCell` overrides it.
// When the cells would come out narrower than that, the row either stacks
// (every cell on its own line) or, with `wrap`, flows onto more lines so a
// 4th input goes down on a phone and comes back up on a tablet. `stackAt`
// forces a stack at that breakpoint and narrower.
export function Columns({ children, gap = layout.grid, weights, kind = 'touch', minCell, stackAt, wrap, style }: {
  children: React.ReactNode;
  gap?: number;
  weights?: number[];
  kind?: keyof typeof CELL_MIN;
  minCell?: number;
  stackAt?: BP;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bp = useBreakpoint();
  const kids = React.Children.toArray(children).filter(Boolean);
  const min = minCell ?? CELL_MIN[kind];
  const mode = columnsMode({ width: bp.width, n: kids.length, gap, side: layout.side, minCell: min, bp: bp.bp, stackAt, wrap });
  return (
    <View style={[{ flexDirection: mode === 'stack' ? 'column' : 'row', flexWrap: mode === 'wrap' ? 'wrap' : 'nowrap', gap }, style]}>
      {kids.map((kid, i) => (
        <View
          key={i}
          style={mode === 'wrap'
            ? { flexGrow: 1, flexBasis: min, minWidth: 0 }
            : { flex: mode === 'stack' ? undefined : (weights?.[i] ?? 1), minWidth: 0 }}
        >
          {kid}
        </View>
      ))}
    </View>
  );
}
