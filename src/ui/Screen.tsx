import React, { createContext, useContext } from 'react';
import { View } from 'react-native';
import { useTheme } from '../shell/providers';
import { layout, space, touch } from './tokens';
import { useNavBottom, useNavInset } from './navMetrics';

// The Three-Slot Screen scaffold (see .claude/skills/three-slot-screen):
//
//   header   fixed; a TopAppBar pads the status-bar inset itself
//   below    optional fixed row under the header (a stepper, a segmented control)
//   Main     the children: exactly one scroller, or a row of panes; flex 1
//   footer   an action bar in the flex column, so Android's adjustResize lets it
//            rise with the keyboard; padded by the gesture inset
//   fab      a floating button over Main (the kit FAB positions itself above the nav)
//
// What floats over Main is the shell's bottom nav and the fab; a footer in the
// column takes its own space and needs no clearance. Main's scroller pads for
// the floating things with useMainInset(); a list card that hugs its rows adds
// useFabClearance() to its content instead.
type ScreenCtx = { fab: boolean; overlay: boolean };
const ScreenContext = createContext<ScreenCtx>({ fab: false, overlay: false });

export function Screen({ header, below, footer, fab, overlay = false, children }: {
  header?: React.ReactNode;
  below?: React.ReactNode;
  footer?: React.ReactNode;
  fab?: React.ReactNode;
  // An overlay (Create invoice, Invoice detail) has no bottom nav under it.
  overlay?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const navBottom = useNavBottom();
  return (
    <ScreenContext.Provider value={{ fab: !!fab, overlay }}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header}
        {below}
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
        {footer ? <View style={{ paddingBottom: navBottom }}>{footer}</View> : null}
        {fab}
      </View>
    </ScreenContext.Provider>
  );
}

// Height the kit FAB (52) plus a block gap; the one place that knows it.
export function useFabClearance(): number {
  const { fab } = useContext(ScreenContext);
  return fab ? touch.button + layout.gap : 0;
}

// Bottom padding for Main's scroller: the floating nav (tab screens on phones)
// and the fab when one floats; an overlay only keeps a block gap at the end.
export function useMainInset(): number {
  const { overlay } = useContext(ScreenContext);
  const navInset = useNavInset();
  const fabClearance = useFabClearance();
  return (overlay ? space[6] : navInset) + fabClearance;
}
