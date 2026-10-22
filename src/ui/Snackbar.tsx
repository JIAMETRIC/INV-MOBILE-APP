import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type } from './tokens';
import type { Theme } from './tokens';

// M3 snackbar: brief, non-blocking confirmation with at most one action.
// Blocking dialogs (ui/alert) stay reserved for errors and destructive confirms.
type Snack = { id: number; message: string; action?: { label: string; onPress: () => void } };
type ShowFn = (message: string, action?: Snack['action']) => void;

const SnackContext = createContext<ShowFn>(() => undefined);

export function useSnackbar(): ShowFn {
  return useContext(SnackContext);
}

export function SnackbarProvider({ children, theme, bottomOffset }: {
  children: React.ReactNode; theme: Theme; bottomOffset: number;
}) {
  const insets = useSafeAreaInsets();
  const [snack, setSnack] = useState<Snack | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setSnack(null));
  }, [anim]);

  const show = useCallback<ShowFn>((message, action) => {
    if (timer.current) clearTimeout(timer.current);
    setSnack({ id: Date.now(), message, action });
    AccessibilityInfo.announceForAccessibility(message);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, action ? 6000 : 4000);
  }, [anim, hide]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => show, [show]);
  const bg = theme.inverseSurface;
  const fg = theme.inverseOnSurface;
  const actionColor = theme.inversePrimary;

  return (
    <SnackContext.Provider value={value}>
      {children}
      {snack ? (
        <Animated.View
          pointerEvents="box-none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute', start: space[4], end: space[4],
            bottom: insets.bottom + bottomOffset + space[2],
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', minHeight: 48, maxWidth: 560, alignSelf: 'center', width: '100%',
            backgroundColor: bg, borderRadius: radius.xs, paddingStart: space[4], paddingEnd: space[2], elevation: 6,
          }}>
            <Text style={[type.bodyMedium, { color: fg, flex: 1, paddingVertical: space[3] }]}>{snack.message}</Text>
            {snack.action ? (
              <Pressable
                onPress={() => { snack.action?.onPress(); hide(); }}
                accessibilityRole="button"
                style={{ minHeight: 48, paddingHorizontal: space[3], justifyContent: 'center' }}
              >
                <Text style={[type.label, { color: actionColor }]}>{snack.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </SnackContext.Provider>
  );
}
