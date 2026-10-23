import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { layout, touch } from './tokens';
import { useBreakpoint, type BP } from './useBreakpoint';

const ORDER: BP[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

// One row of columns (Three-Slot Screen rule 4). Each child becomes a column
// with `flex` 1, or the matching entry of `weights` (e.g. [1, 1.4]). The row
// stacks into a column when the breakpoint is `stackAt` or narrower, or when
// the cells would come out narrower than `minCell` (44 by default, the touch
// minimum), so no row can squeeze a tappable cell by accident.
export function Columns({ children, gap = layout.grid, weights, minCell = touch.min, stackAt, style }: {
  children: React.ReactNode;
  gap?: number;
  weights?: number[];
  minCell?: number;
  stackAt?: BP;
  style?: StyleProp<ViewStyle>;
}) {
  const bp = useBreakpoint();
  const kids = React.Children.toArray(children).filter(Boolean);
  const n = kids.length;
  const narrow = stackAt !== undefined && ORDER.indexOf(bp.bp) <= ORDER.indexOf(stackAt);
  const cramped = n > 1 && (bp.width - 2 * layout.side - gap * (n - 1)) / n < minCell;
  const stack = narrow || cramped;
  return (
    <View style={[{ flexDirection: stack ? 'column' : 'row', gap }, style]}>
      {kids.map((kid, i) => (
        <View key={i} style={{ flex: stack ? undefined : (weights?.[i] ?? 1), minWidth: 0 }}>{kid}</View>
      ))}
    </View>
  );
}
