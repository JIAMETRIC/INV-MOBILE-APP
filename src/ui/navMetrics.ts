import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from './useBreakpoint';
import { layout } from './tokens';

// Kit floating bottom nav (§6): 68 tall, 20 from the left, right and bottom
// edges (or above the system gesture / button bar when that is taller).
export const NAV_HEIGHT = 68;

export function useNavBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, layout.side);
}

// Space a phone screen keeps clear at the bottom so its last item and the FAB
// sit above the floating nav (kit: "bottom padding 112"). Tablets have no
// bottom nav, so it is just the gesture inset plus a block gap.
export function useNavInset(): number {
  const insets = useSafeAreaInsets();
  const { isPhone } = useBreakpoint();
  const bottom = useNavBottom();
  return isPhone ? bottom + NAV_HEIGHT + layout.gap : insets.bottom + layout.gap;
}

// Bottom padding for a scrolling screen: clears the nav, plus the FAB when one floats there.
export function useContentInset(withFab = false): number {
  return useNavInset() + (withFab ? 52 + layout.gap : 0);
}
