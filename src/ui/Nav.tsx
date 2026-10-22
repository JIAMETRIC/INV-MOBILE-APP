import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, layout, radius, shadow, space, touch, type } from './tokens';
import type { Theme } from './tokens';
import { ripple, type IconName } from './components';
import { NAV_HEIGHT, useNavBottom } from './navMetrics';

export type Tab = 'dashboard' | 'invoices' | 'products' | 'settings';

export const TABS: ReadonlyArray<{ tab: Tab; icon: IconName; label: string }> = [
  { tab: 'dashboard', icon: 'home', label: 'Home' },
  { tab: 'invoices', icon: 'file-text', label: 'Invoices' },
  { tab: 'products', icon: 'tag', label: 'Products' },
  { tab: 'settings', icon: 'settings', label: 'Settings' },
];

// Kit nav item: 48×48, radius 16. Active: blue fill, white icon, small shadow.
// Inactive: #666 icon. Icons only, as in the reference; the label is spoken.
function NavItem({ on, icon, label, onPress, theme }: {
  on: boolean; icon: IconName; label: string; onPress: () => void; theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      android_ripple={ripple(theme, true)}
      style={({ pressed }) => [{
        width: touch.nav, height: touch.nav, borderRadius: radius.item,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? theme.fillStrong : 'transparent',
        boxShadow: on ? shadow.primary : undefined,
      }, Platform.OS === 'web' && pressed ? { opacity: 0.7 } : null]}
    >
      <Feather name={icon} size={22} color={on ? theme.onFillStrong : theme.textMuted} />
    </Pressable>
  );
}

// Kit floating bottom nav: 20 from the left, right and bottom edges, 68 tall,
// radius 24, glass "Bottom nav" recipe, 4 items evenly spread.
export function BottomTabs({ active, onSelect, theme }: {
  active: Tab; onSelect: (t: Tab) => void; theme: Theme;
}) {
  const bottom = useNavBottom();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: 'absolute', left: layout.side, right: layout.side, bottom,
        height: NAV_HEIGHT, borderRadius: radius.card,
        backgroundColor: theme.navSurface, borderWidth: 1, borderColor: theme.navBorder,
        boxShadow: shadow.secondary,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
      }}
    >
      {TABS.map(t => (
        <NavItem key={t.tab} on={active === t.tab} icon={t.icon} label={t.label} onPress={() => onSelect(t.tab)} theme={theme} />
      ))}
    </View>
  );
}

// Tablet rail on the same recipe: glass column, "New invoice" primary button
// on top, then the 48×48 nav items (labels below them at xl+).
export function Rail({ active, onSelect, theme, labels, onNew }: {
  active: Tab; onSelect: (t: Tab) => void; theme: Theme; labels: boolean;
  onNew: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: 88,
        backgroundColor: theme.navSurface,
        borderRightWidth: 1, borderColor: theme.navBorder,
        boxShadow: shadow.secondary,
        paddingTop: insets.top + space[4],
        paddingBottom: insets.bottom,
        alignItems: 'center',
        gap: space[3],
      }}
    >
      <Pressable
        onPress={onNew}
        accessibilityRole="button"
        accessibilityLabel="New invoice"
        android_ripple={ripple(theme)}
        style={({ pressed }) => [{
          width: touch.button, height: touch.button, borderRadius: radius.control, overflow: 'hidden',
          backgroundColor: theme.fab, boxShadow: shadow.secondary,
          alignItems: 'center', justifyContent: 'center', marginBottom: space[5],
        }, pressed ? { transform: [{ scale: 0.96 }] } : null]}
      >
        <Feather name="plus" size={22} color={theme.onFab} />
      </Pressable>
      {TABS.map(t => {
        const on = active === t.tab;
        return (
          <View key={t.tab} style={{ alignItems: 'center', gap: space[1] }}>
            <NavItem on={on} icon={t.icon} label={t.label} onPress={() => onSelect(t.tab)} theme={theme} />
            {labels ? (
              <Text style={[type.caption, { color: on ? theme.text : theme.textMuted, fontFamily: on ? font.semibold : font.medium }]}>
                {t.label}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
