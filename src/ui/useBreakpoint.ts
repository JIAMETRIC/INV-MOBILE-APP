import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export type BP = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const STEPS: ReadonlyArray<readonly [BP, number]> = [
  ['xxl', 1200], ['xl', 960], ['lg', 768], ['md', 600], ['sm', 360], ['xs', 0],
];

const META: Record<BP, { columns: 4 | 8 | 12; panes: 1 | 2 | 3; gutter: number; margin: number }> = {
  xs: { columns: 4, panes: 1, gutter: 12, margin: 16 },
  sm: { columns: 4, panes: 1, gutter: 16, margin: 16 },
  // md (an 8-inch tablet in portrait is 601 dp) keeps the rail but one pane: two
  // panes left the list and detail cramped (tablet check, 2026-10-23).
  md: { columns: 8, panes: 1, gutter: 16, margin: 24 },
  lg: { columns: 8, panes: 2, gutter: 20, margin: 24 },
  xl: { columns: 12, panes: 3, gutter: 24, margin: 32 },
  xxl: { columns: 12, panes: 3, gutter: 24, margin: 32 },
};

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const bp = STEPS.find(([, min]) => width >= min)![0];
    return {
      bp, width, height,
      ...META[bp],
      isLandscape: width > height,
      isPhone: bp === 'xs' || bp === 'sm',
      isTablet: bp !== 'xs' && bp !== 'sm',
      atLeast: (min: BP) => width >= (STEPS.find(([k]) => k === min)?.[1] ?? 0),
    };
  }, [width, height]);
}
