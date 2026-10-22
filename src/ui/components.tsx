import React, { useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, Text, TextInput, View,
  type StyleProp, type ViewStyle, type TextStyle, type PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevation, radius, space, touch, type, status as statusIcons } from './tokens';
import type { Theme } from './tokens';
import type { InvoiceStatus } from '../data/types';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Android gets the platform ripple; the web preview tier has no ripple, so it dims instead.
const isWeb = Platform.OS === 'web';
export function ripple(theme: Theme, borderless = false): PressableProps['android_ripple'] {
  return { color: theme.ripple, borderless, foreground: true };
}
const pressedDim = (pressed: boolean) => (isWeb && pressed ? { opacity: 0.7 } : null);

type ButtonProps = {
  label: string;
  onPress: () => void;
  theme: Theme;
  // M3: solid = filled, tonal = filled tonal, outline = outlined, ghost = text button.
  variant?: 'solid' | 'tonal' | 'outline' | 'ghost';
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function Button({
  label, onPress, theme, variant = 'solid', icon, danger, disabled, busy, style, labelStyle,
}: ButtonProps) {
  const off = disabled || busy;
  const fill =
    variant === 'solid' ? (danger ? theme.error : theme.fillStrong)
      : variant === 'tonal' ? (danger ? theme.errorContainer : theme.secondaryContainer)
        : 'transparent';
  const color =
    variant === 'solid' ? (danger ? theme.onError : theme.onFillStrong)
      : variant === 'tonal' ? (danger ? theme.onErrorContainer : theme.onSecondaryContainer)
        : danger ? theme.error : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      android_ripple={ripple(theme)}
      style={({ pressed }) => [{
        minHeight: touch.min,
        paddingHorizontal: variant === 'ghost' ? space[3] : space[5],
        borderRadius: radius.pill,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space[2],
        backgroundColor: fill,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: theme.outline,
      }, style, off && { opacity: 0.38 }, pressedDim(pressed)]}
    >
      {busy ? <ActivityIndicator color={color} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
          <Text style={[type.label, { color }, labelStyle]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, theme, color, busy, size = 24, selected }: {
  icon: IconName; label: string; onPress: () => void; theme: Theme;
  color?: string; busy?: boolean; size?: number; selected?: boolean;
}) {
  const c = color ?? theme.textMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy, selected }}
      android_ripple={ripple(theme, true)}
      hitSlop={4}
      style={({ pressed }) => [{
        width: touch.min, height: touch.min, borderRadius: radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: selected ? theme.secondaryContainer : 'transparent',
      }, pressedDim(pressed)]}
    >
      {busy ? <ActivityIndicator color={c} /> : <Ionicons name={icon} size={size} color={c} />}
    </Pressable>
  );
}

type InputProps = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  theme: Theme;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  editable?: boolean;
  tabular?: boolean;
  helper?: string;
  error?: string;
  maxLength?: number;
};

// M3 outlined text field: label above, 1dp outline, 2dp primary outline + primary label on focus.
export function Input({
  label, value, onChange, onBlur, theme, placeholder,
  keyboardType = 'default', autoCapitalize, multiline, editable = true, tabular, helper, error, maxLength,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const accent = error ? theme.error : focused ? theme.focus : theme.outline;
  return (
    <View style={{ marginBottom: space[3] }}>
      {label ? (
        <Text style={[type.labelMedium, {
          color: error ? theme.error : focused ? theme.focus : theme.textMuted, marginBottom: space[1],
        }]}>{label}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        placeholder={placeholder}
        placeholderTextColor={theme.textDisabled}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        editable={editable}
        maxLength={maxLength}
        accessibilityLabel={label ?? placeholder}
        cursorColor={theme.focus}
        selectionColor={theme.ripple}
        style={[
          {
            minHeight: multiline ? 96 : touch.comfortable,
            paddingHorizontal: space[4] - (focused || error ? 1 : 0),
            paddingVertical: multiline ? space[3] : 0,
            borderWidth: focused || error ? 2 : 1,
            borderColor: accent,
            borderRadius: radius.xs,
            color: editable ? theme.text : theme.textMuted,
            backgroundColor: editable ? theme.surface : theme.surfaceAlt,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          tabular ? type.number : type.body,
          multiline ? { height: undefined } : null,
        ]}
      />
      {error || helper ? (
        <Text style={[type.caption, { color: error ? theme.error : theme.textMuted, marginTop: space[1], marginStart: space[4] }]}>
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
}

// Rupee field bound to integer paise. It keeps the typed text, so "1" is not
// re-rendered as "1.00" mid-keystroke, and resyncs only when the value changes from outside.
export function MoneyInput({ valuePaise, onChangePaise, ...rest }: Omit<InputProps, 'value' | 'onChange' | 'keyboardType' | 'tabular'> & {
  valuePaise: number; onChangePaise: (p: number) => void;
}) {
  const fmt = (p: number) => (p === 0 ? '' : (p / 100).toFixed(2));
  const [text, setText] = useState(() => fmt(valuePaise));
  const toPaise = (t: string) => Math.max(0, Math.round((Number(t) || 0) * 100));
  React.useEffect(() => {
    setText(t => (toPaise(t) === valuePaise ? t : fmt(valuePaise)));
  }, [valuePaise]);
  return (
    <Input
      {...rest}
      value={text}
      placeholder={rest.placeholder ?? '0.00'}
      keyboardType="decimal-pad"
      tabular
      onChange={v => {
        const clean = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        setText(clean);
        onChangePaise(toPaise(clean));
      }}
    />
  );
}

// M3 search bar: full-pill container, leading search glyph, trailing clear.
export function SearchField({ value, onChange, placeholder, theme, style }: {
  value: string; onChange: (v: string) => void; placeholder: string; theme: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', minHeight: touch.comfortable,
      borderRadius: radius.pill, backgroundColor: theme.surfaceAlt, paddingStart: space[4],
    }, style]}>
      <Ionicons name="search" size={22} color={theme.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        cursorColor={theme.focus}
        style={[type.body, { flex: 1, color: theme.text, paddingHorizontal: space[3], minHeight: touch.min }]}
      />
      {value ? (
        <IconButton icon="close" label="Clear search" onPress={() => onChange('')} theme={theme} />
      ) : <View style={{ width: space[2] }} />}
    </View>
  );
}

export function MoneyText({ paiseText, theme, strong, small }: {
  paiseText: string; theme: Theme; strong?: boolean; small?: boolean;
}) {
  return (
    <Text
      style={[
        small ? { ...type.number, fontSize: 14, lineHeight: 20 } : type.number,
        strong ? { fontWeight: '700', color: theme.accentDeep } : { color: theme.text },
        { textAlign: 'right' },
      ]}
    >
      {paiseText}
    </Text>
  );
}

export function TotalRow({ label, value, theme, strong }: {
  label: string; value: string; theme: Theme; strong?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: strong ? space[2] : space[1],
      borderTopWidth: strong ? 1 : 0, borderColor: theme.border, marginTop: strong ? space[1] : 0,
    }}>
      <Text style={[strong ? type.heading : type.bodyMedium, { color: strong ? theme.text : theme.textMuted }]}>
        {label}
      </Text>
      <MoneyText paiseText={value} theme={theme} strong={strong} />
    </View>
  );
}

// Status badge: glyph + text on a tonal container (plan §7 rule 4 keeps glyph + text).
export function StatusGlyph({ status, theme }: { status: InvoiceStatus; theme: Theme }) {
  const s = statusIcons[status];
  const t = theme.tone[s.tone];
  return (
    <View
      accessibilityLabel={`Status ${s.label}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end',
        backgroundColor: t.bg, borderRadius: radius.sm, paddingHorizontal: space[2], height: 24,
      }}
    >
      <Ionicons name={s.icon} size={14} color={t.fg} />
      <Text style={[type.labelMedium, { color: t.fg }]}>{s.label}</Text>
    </View>
  );
}

export function Badge({ label, tone, theme }: {
  label: string; tone: keyof Theme['tone'] | 'error'; theme: Theme;
}) {
  const t = tone === 'error' ? { bg: theme.errorContainer, fg: theme.onErrorContainer } : theme.tone[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.sm, paddingHorizontal: space[2], height: 24, justifyContent: 'center', alignSelf: 'flex-end' }}>
      <Text style={[type.labelMedium, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export type BarAction = { icon: IconName; label: string; onPress: () => void; busy?: boolean };

// M3 top app bar in the brand gradient, drawn edge-to-edge under the status bar.
// `large` = the medium-flexible variant used on top-level destinations.
export function TopAppBar({ title, subtitle, onBack, actions, theme, large }: {
  title: string; subtitle?: string; onBack?: () => void; actions?: BarAction[];
  theme: Theme; large?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[theme.headerFrom, theme.headerTo]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{
        paddingTop: insets.top,
        paddingStart: onBack ? space[1] : space[4],
        paddingEnd: space[1],
        paddingBottom: large ? space[4] : 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64 }}>
        {onBack ? (
          <IconButton icon="arrow-back" label="Navigate up" onPress={onBack} theme={theme} color={theme.onHeader} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0, marginStart: onBack ? space[1] : 0 }}>
          {!large ? (
            <>
              <Text style={[type.title, { color: theme.onHeader }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
              {subtitle ? (
                <Text style={[type.caption, { color: theme.onHeaderMuted }]} numberOfLines={1}>{subtitle}</Text>
              ) : null}
            </>
          ) : null}
        </View>
        {actions?.map(a => (
          <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress}
            busy={a.busy} theme={theme} color={theme.onHeader} />
        ))}
      </View>
      {large ? (
        <View style={{ paddingEnd: space[3] }}>
          <Text style={[type.display, { color: theme.onHeader }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
          {subtitle ? (
            <Text style={[type.bodyMedium, { color: theme.onHeaderMuted, marginTop: 2 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </LinearGradient>
  );
}

export function SectionTitle({ title, theme, right }: { title: string; theme: Theme; right?: React.ReactNode }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      minHeight: touch.min, marginBottom: space[1],
    }}>
      <Text style={[type.heading, { color: theme.text, flexShrink: 1 }]} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

// M3 cards: outlined (default) or filled (tonal surface, no outline).
export function Card({ children, theme, style, variant = 'outlined' }: {
  children: React.ReactNode; theme: Theme; style?: StyleProp<ViewStyle>; variant?: 'outlined' | 'filled';
}) {
  return (
    <View style={[{
      backgroundColor: variant === 'filled' ? theme.surfaceContainer : theme.surface,
      borderWidth: variant === 'filled' ? 0 : 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: space[4],
    }, style]}>
      {children}
    </View>
  );
}

export function ListRow({ children, onPress, theme, divider = true }: {
  children: React.ReactNode; onPress?: () => void; theme: Theme; divider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? ripple(theme) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [{
        minHeight: touch.comfortable,
        paddingHorizontal: space[4],
        paddingVertical: space[2],
        justifyContent: 'center',
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: theme.border,
      }, pressedDim(pressed)]}
    >
      {children}
    </Pressable>
  );
}

// M3 list item: leading icon/avatar, headline + supporting text, trailing content or chevron.
export function ListItem({
  title, subtitle, leadingIcon, leadingText, trailing, onPress, chevron, theme, divider = true, selected,
}: {
  title: string; subtitle?: string; leadingIcon?: IconName; leadingText?: string;
  trailing?: React.ReactNode; onPress?: () => void; chevron?: boolean; theme: Theme;
  divider?: boolean; selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? ripple(theme) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected ? { selected } : undefined}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: space[4],
        minHeight: subtitle ? 72 : touch.comfortable,
        paddingStart: space[4], paddingEnd: chevron ? space[3] : space[4], paddingVertical: space[2],
        borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.border,
        backgroundColor: selected ? theme.secondaryContainer : 'transparent',
      }, pressedDim(pressed)]}
    >
      {leadingIcon ? <Ionicons name={leadingIcon} size={24} color={theme.textMuted} /> : null}
      {leadingText !== undefined ? (
        <View style={{
          width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primaryContainer,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={[type.label, { color: theme.onPrimaryContainer }]} numberOfLines={1}>{leadingText}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[type.bodyMedium, { color: theme.textMuted }]} numberOfLines={2}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Ionicons name="chevron-forward" size={20} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

export function EmptyState({ text, theme, icon, title, action }: {
  text: string; theme: Theme; icon?: IconName; title?: string; action?: React.ReactNode;
}) {
  return (
    <View style={{ paddingVertical: space[6], paddingHorizontal: space[5], alignItems: 'center', gap: space[2] }}>
      {icon ? <Ionicons name={icon} size={40} color={theme.textMuted} /> : null}
      {title ? <Text style={[type.heading, { color: theme.text, textAlign: 'center' }]}>{title}</Text> : null}
      <Text style={[type.bodyMedium, { color: theme.textMuted, textAlign: 'center' }]}>{text}</Text>
      {action ? <View style={{ marginTop: space[2] }}>{action}</View> : null}
    </View>
  );
}

// M3 filter chip: 32dp visual height, 48dp touch via hitSlop, check glyph when selected.
export function Chip({ label, active, onPress, theme, icon }: {
  label: string; active: boolean; onPress: () => void; theme: Theme; icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      android_ripple={ripple(theme)}
      style={({ pressed }) => [{
        height: 32,
        paddingStart: active || icon ? space[2] : space[4],
        paddingEnd: space[4],
        marginEnd: space[2],
        marginVertical: space[2],
        borderRadius: radius.sm,
        overflow: 'hidden',
        borderWidth: active ? 0 : 1,
        borderColor: theme.outline,
        backgroundColor: active ? theme.secondaryContainer : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
      }, pressedDim(pressed)]}
    >
      {active ? <Ionicons name="checkmark" size={18} color={theme.onSecondaryContainer} />
        : icon ? <Ionicons name={icon} size={18} color={theme.textMuted} /> : null}
      <Text style={[type.label, { color: active ? theme.onSecondaryContainer : theme.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Compact extended FAB: 48dp tall (the minimum touch target, matching the
// app's buttons), radius 12, anchored 16dp from the bottom-end corner of its parent.
export function FAB({ icon, label, onPress, theme, extended = true }: {
  icon: IconName; label: string; onPress: () => void; theme: Theme; extended?: boolean;
}) {
  return (
    <View style={{ position: 'absolute', end: space[4], bottom: space[4], borderRadius: radius.md, ...elevation.fab, backgroundColor: theme.fab }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={ripple(theme)}
        style={({ pressed }) => [{
          height: touch.min, minWidth: touch.min, borderRadius: radius.md, overflow: 'hidden',
          paddingHorizontal: extended ? space[4] : 0,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
        }, pressedDim(pressed)]}
      >
        <Ionicons name={icon} size={20} color={theme.onFab} />
        {extended ? <Text style={[type.label, { color: theme.onFab }]}>{label}</Text> : null}
      </Pressable>
    </View>
  );
}
