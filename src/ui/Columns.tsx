import React, { useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
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
//
// The decision uses the row's own measured width (so it is right inside a
// tablet pane, not just at full screen width); until the first layout it
// uses the window width minus the screen's side padding.
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
  const [measured, setMeasured] = useState<number | null>(null);
  const kids = React.Children.toArray(children).filter(Boolean);
  const min = minCell ?? CELL_MIN[kind];
  const mode = columnsMode({
    width: measured ?? bp.width, side: measured === null ? layout.side : 0,
    n: kids.length, gap, minCell: min, bp: bp.bp, stackAt, wrap,
  });
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== measured) setMeasured(w);
  };
  return (
    <View
      onLayout={onLayout}
      style={[{ flexDirection: mode === 'stack' ? 'column' : 'row', flexWrap: mode === 'wrap' ? 'wrap' : 'nowrap', gap }, style]}
    >
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
