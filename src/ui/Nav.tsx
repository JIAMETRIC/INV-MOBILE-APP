import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevation, radius, space, touch, type } from './tokens';
import type { Theme } from './tokens';
import { ripple } from './components';

export type Tab = 'dashboard' | 'invoices' | 'products' | 'settings';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const TABS: ReadonlyArray<{ tab: Tab; icon: IconName; iconActive: IconName; label: string }> = [
  { tab: 'dashboard', icon: 'home-outline', iconActive: 'home', label: 'Home' },
  { tab: 'invoices', icon: 'document-text-outline', iconActive: 'document-text', label: 'Invoices' },
  { tab: 'products', icon: 'pricetags-outline', iconActive: 'pricetags', label: 'Products' },
  { tab: 'settings', icon: 'settings-outline', iconActive: 'settings', label: 'Settings' },
];

type Item = { tab: Tab; icon: IconName; iconActive: IconName; label: string };

export const NAV_BAR_HEIGHT = 80;

function Indicator({ active, theme, width, children }: {
  active: boolean; theme: Theme; width: number; children: React.ReactNode;
}) {
  return (
    <View style={{
      width, height: 32, borderRadius: radius.lg,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: active ? theme.secondaryContainer : 'transparent',
    }}>
      {children}
    </View>
  );
}

// M3 navigation bar: 80dp, 64x32 active indicator pill, label under the icon,
// padded by the gesture/3-button nav inset (edge-to-edge on Android 15+).
export function BottomTabs({ active, onSelect, theme }: {
  active: Tab; onSelect: (t: Tab) => void; theme: Theme;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.navSurface,
        borderTopWidth: 1, borderTopColor: theme.navBorder,
        paddingBottom: insets.bottom,
      }}
    >
      {TABS.map((t: Item) => {
        const on = active === t.tab;
        return (
          <Pressable
            key={t.tab}
            onPress={() => onSelect(t.tab)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            android_ripple={ripple(theme, true)}
            style={({ pressed }) => [{
              flex: 1, height: NAV_BAR_HEIGHT, paddingTop: space[3],
              alignItems: 'center', gap: space[1],
            }, Platform.OS === 'web' && pressed ? { opacity: 0.7 } : null]}
          >
            <Indicator active={on} theme={theme} width={64}>
              <Ionicons
                name={on ? t.iconActive : t.icon}
                size={24}
                color={on ? theme.onSecondaryContainer : theme.textMuted}
              />
            </Indicator>
            <Text style={[type.labelMedium, {
              color: on ? theme.text : theme.textMuted, fontWeight: on ? '700' : '500',
            }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// M3 navigation rail: FAB at the top, destinations below with 56x32 indicator pills.
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
        borderRightWidth: 1, borderRightColor: theme.navBorder,
        paddingTop: insets.top + space[3],
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
        style={{
          width: touch.comfortable, height: touch.comfortable, borderRadius: radius.lg, overflow: 'hidden',
          backgroundColor: theme.primaryContainer, ...elevation.fab,
          alignItems: 'center', justifyContent: 'center', marginBottom: space[5],
        }}
      >
        <Ionicons name="add" size={24} color={theme.onPrimaryContainer} />
      </Pressable>
      {TABS.map((t: Item) => {
        const on = active === t.tab;
        return (
          <Pressable
            key={t.tab}
            onPress={() => onSelect(t.tab)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            style={{ minHeight: touch.comfortable, alignItems: 'center', gap: space[1], width: '100%' }}
          >
            <Indicator active={on} theme={theme} width={56}>
              <Ionicons
                name={on ? t.iconActive : t.icon}
                size={24}
                color={on ? theme.onSecondaryContainer : theme.textMuted}
              />
            </Indicator>
            {labels ? (
              <Text style={[type.labelMedium, { color: on ? theme.text : theme.textMuted }]}>{t.label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
