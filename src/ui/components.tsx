import React, { useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, Text, TextInput, View,
  type StyleProp, type ViewStyle, type TextStyle, type PressableProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, layout, motion, radius, shadow, space, statusStyle, touch, type } from './tokens';
import type { Theme } from './tokens';
import type { InvoiceStatus } from '../data/types';
import { useNavInset } from './navMetrics';

// Feather: the line-icon set the design kit asks for (Lucide/Feather).
export type IconName = React.ComponentProps<typeof Feather>['name'];

// Android gets the platform ripple; the web preview tier has no ripple, so it dims instead.
const isWeb = Platform.OS === 'web';
export function ripple(theme: Theme, borderless = false): PressableProps['android_ripple'] {
  return { color: theme.ripple, borderless, foreground: true };
}
const pressedDim = (pressed: boolean) => (isWeb && pressed ? { opacity: 0.7 } : null);
// Kit §8: buttons shrink slightly while pressed.
const pressScale = (pressed: boolean, s: number = motion.pressScale) => (pressed ? { transform: [{ scale: s }] } : null);

type ButtonProps = {
  label: string;
  onPress: () => void;
  theme: Theme;
  // solid = kit primary button · tonal / outline = glass button · ghost = text link.
  variant?: 'solid' | 'tonal' | 'outline' | 'ghost';
  icon?: IconName;
  danger?: boolean;
  destructive?: boolean; // a delete action: red text and icon (theme.destructive)
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function Button({
  label, onPress, theme, variant = 'solid', icon, danger, destructive, disabled, busy, style, labelStyle,
}: ButtonProps) {
  const off = disabled || busy;
  const solid = variant === 'solid';
  const glassBtn = variant === 'tonal' || variant === 'outline';
  const color = solid
    ? (danger ? theme.onError : theme.onFillStrong)
    : destructive ? theme.destructive : danger ? theme.error : glassBtn ? theme.text : theme.link;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      android_ripple={ripple(theme)}
      style={({ pressed }) => [{
        minHeight: solid ? touch.button : glassBtn ? touch.input : touch.min,
        paddingHorizontal: variant === 'ghost' ? space[3] : space[5],
        borderRadius: radius.control,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space[2],
      },
      // Kit primary button: blue fill, no border, large shadow.
      solid && { backgroundColor: danger ? theme.error : theme.fillStrong, boxShadow: off ? undefined : shadow.secondary },
      // Kit social/glass button: glass fill, light border, small shadow.
      glassBtn && {
        backgroundColor: danger ? theme.errorContainer : theme.glassStrong,
        borderWidth: 1, borderColor: theme.glassBorderStrong,
        boxShadow: off ? undefined : theme.tileShadow,
      },
      style, off && { opacity: 0.38 }, pressScale(pressed), pressedDim(pressed)]}
    >
      {busy ? <ActivityIndicator color={color} /> : (
        <>
          {icon ? <Feather name={icon} size={18} color={color} /> : null}
          <Text style={[
            solid ? type.heading : variant === 'ghost' ? { ...type.label, fontFamily: font.semibold } : { ...type.body, fontFamily: font.medium },
            { color }, labelStyle,
          ]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// Kit icon button: 44×44, radius 14, glass "Icon button" recipe, 20px icon.
// `glass` = the kit's glass icon button; default = the kit's ghost button
// (transparent, #666 icon), for row actions and sheet close buttons.
export function IconButton({ icon, label, onPress, theme, color, fill, busy, size = 20, selected, glass }: {
  icon: IconName; label: string; onPress: () => void; theme: Theme;
  color?: string; fill?: string; busy?: boolean; size?: number; selected?: boolean; glass?: boolean;
}) {
  const c = color ?? (glass ? theme.text : theme.textMuted);
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy, selected }}
      android_ripple={ripple(theme, !glass)}
      style={({ pressed }) => [{
        width: touch.min, height: touch.min,
        borderRadius: glass || fill ? radius.control : radius.chip,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: fill ?? (selected ? theme.primaryTint : glass ? theme.glassStrong : 'transparent'),
      },
      glass && { borderWidth: 1, borderColor: theme.glassBorderStrong, boxShadow: theme.tileShadow },
      pressScale(pressed, motion.pressScaleSmall), pressedDim(pressed)]}
    >
      {busy ? <ActivityIndicator color={c} /> : <Feather name={icon} size={size} color={c} />}
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

// Kit text input: label 13/500 above (gap 8), field 50 tall, radius 14,
// padding 0 16, 15/400 text. Focused: blue border + focus ring.
export function Input({
  label, value, onChange, onBlur, theme, placeholder,
  keyboardType = 'default', autoCapitalize, multiline, editable = true, tabular, helper, error, maxLength,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.error : focused ? theme.focus : theme.inputBorder;
  return (
    <View style={{ marginBottom: space[4] }}>
      {label ? (
        <Text style={[type.labelMedium, { color: error ? theme.error : theme.textMuted, marginBottom: space[2] }]}>{label}</Text>
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
        selectionColor={theme.primaryTint}
        style={[
          {
            minHeight: multiline ? 96 : touch.input,
            paddingHorizontal: space[4],
            paddingVertical: multiline ? space[3] : 0,
            borderWidth: 1,
            borderColor,
            borderRadius: radius.control,
            color: editable ? theme.text : theme.textMuted,
            backgroundColor: theme.inputFill,
            textAlignVertical: multiline ? 'top' : 'center',
            boxShadow: focused && !error ? theme.focusRing : undefined,
          },
          tabular ? type.numberField : type.body,
          multiline ? { height: undefined } : null,
        ]}
      />
      {error || helper ? (
        <Text style={[type.caption, { color: error ? theme.error : theme.textMuted, marginTop: space[1] }]}>
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

// Search box on the glass icon-button recipe: 50 tall, radius 14, search glyph, clear button.
export function SearchField({ value, onChange, placeholder, theme, style }: {
  value: string; onChange: (v: string) => void; placeholder: string; theme: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', height: touch.input,
      borderRadius: radius.control, backgroundColor: theme.glassStrong,
      borderWidth: 1, borderColor: theme.glassBorderStrong, boxShadow: theme.tileShadow,
      paddingStart: space[4],
    }, style]}>
      <Feather name="search" size={20} color={theme.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        cursorColor={theme.focus}
        style={[type.body, { flex: 1, color: theme.text, paddingHorizontal: space[3], height: touch.input - 2 }]}
      />
      {value ? (
        <IconButton icon="x" label="Clear search" onPress={() => onChange('')} theme={theme} />
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
        small ? { ...type.number, fontSize: 15, lineHeight: 20 } : type.number,
        // Bebas Neue has one weight, so a strong amount is set larger instead of bold.
        strong ? { fontSize: small ? 18 : 22, lineHeight: 26 } : null,
        { color: theme.text, textAlign: 'right' },
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
      borderTopWidth: strong ? 1 : 0, borderColor: theme.divider, marginTop: strong ? space[1] : 0,
    }}>
      <Text style={[strong ? type.heading : type.bodyMedium, { color: strong ? theme.text : theme.textMuted }]}>
        {label}
      </Text>
      <MoneyText paiseText={value} theme={theme} strong={strong} />
    </View>
  );
}

// Kit badge: pill, padding 4 × 10, 12/600, tinted fill. Status keeps glyph + text (never colour alone).
export function StatusGlyph({ status, theme }: { status: InvoiceStatus; theme: Theme }) {
  const s = statusStyle[status];
  const t = theme.tone[s.tone];
  return (
    <View
      accessibilityLabel={`Status ${s.label}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-end',
        backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: space[1],
      }}
    >
      <Feather name={s.icon} size={12} color={t.icon} />
      <Text style={[type.caption, { fontFamily: font.semibold, color: t.fg }]}>{s.label}</Text>
    </View>
  );
}

export function Badge({ label, tone, theme }: {
  label: string; tone: keyof Theme['tone'] | 'error'; theme: Theme;
}) {
  const t = tone === 'error' ? { bg: theme.errorContainer, fg: theme.onErrorContainer } : theme.tone[tone];
  return (
    <View style={{
      backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: space[1],
      justifyContent: 'center', alignSelf: 'flex-end',
    }}>
      <Text style={[type.caption, { fontFamily: font.semibold, color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export type BarAction = { icon: IconName; label: string; onPress: () => void; busy?: boolean };

// Flat screen header on the screen background (no gradient), following the kit's top bars.
// `large` (top-level screens, Dashboard header): caption above an H2 title, glass
// icon buttons on the right. Otherwise (Weather / Player top bar): glass back
// button · centred title + caption · glass action buttons.
export function TopAppBar({ title, subtitle, onBack, actions, theme, large }: {
  title: string; subtitle?: string; onBack?: () => void; actions?: BarAction[];
  theme: Theme; large?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const buttons = (actions ?? []).map(a => (
    <IconButton key={a.label} glass icon={a.icon} label={a.label} onPress={a.onPress} busy={a.busy} theme={theme} />
  ));
  const pad = { paddingTop: insets.top + layout.top, paddingHorizontal: layout.side, paddingBottom: space[3] };
  if (large) {
    return (
      <View style={[pad, { flexDirection: 'row', alignItems: 'center', gap: space[3] }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {subtitle ? <Text style={[type.bodyMedium, { color: theme.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
          <Text style={[type.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
        </View>
        {buttons.length ? <View style={{ flexDirection: 'row', gap: 10 }}>{buttons}</View> : null}
      </View>
    );
  }
  // Equal side widths keep the title centred.
  const sideCount = Math.max(onBack ? 1 : 0, buttons.length);
  const sideWidth = sideCount ? sideCount * touch.min + (sideCount - 1) * 10 : 0;
  return (
    <View style={[pad, { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: touch.min }]}>
      <View style={{ width: sideWidth }}>
        {onBack ? <IconButton glass icon="chevron-left" label="Navigate up" onPress={onBack} theme={theme} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
        <Text style={[type.heading, { color: theme.text, textAlign: 'center' }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle ? (
          <Text style={[type.caption, { color: theme.textMuted, textAlign: 'center' }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={{ width: sideWidth, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>{buttons}</View>
    </View>
  );
}

// Kit overline (12/600 upper-case, #666) with an optional right slot.
export function SectionTitle({ title, theme, right }: { title: string; theme: Theme; right?: React.ReactNode }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      minHeight: 32, marginBottom: space[2], gap: space[2],
    }}>
      <Text style={[type.overline, { color: theme.textMuted, flexShrink: 1 }]} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

// Kit glass card: 55% white, 1px white border at 85%, radius 24, padding 16.
// `small` = stat tiles / info bars (shadow.primary); default = large cards (shadow.secondary).
// `list` = list card padding (8 vertical × 16 horizontal) for rows with `flush`.
// `variant` is kept for older call sites; both variants are the same glass card.
export function Card({ children, theme, style, small, list }: {
  children: React.ReactNode; theme: Theme; style?: StyleProp<ViewStyle>;
  variant?: 'outlined' | 'filled'; small?: boolean; list?: boolean;
}) {
  return (
    <View style={[{
      backgroundColor: theme.glass,
      borderWidth: 1,
      borderColor: theme.glassBorder,
      borderRadius: radius.card,
      padding: list ? undefined : space[4],
      paddingVertical: list ? space[2] : undefined,
      paddingHorizontal: list ? space[4] : undefined,
      boxShadow: small ? theme.tileShadow : theme.cardShadow,
    }, style]}>
      {children}
    </View>
  );
}

// Kit icon chip: 36×36, radius 12, blue tint, blue 18px icon.
export function IconChip({ icon, theme }: { icon: IconName; theme: Theme }) {
  return (
    <View style={{
      width: 36, height: 36, borderRadius: radius.chip, backgroundColor: theme.primaryTint,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Feather name={icon} size={18} color={theme.accent} />
    </View>
  );
}

// Free-form row for tables (Products): kit list-row spacing and divider.
export function ListRow({ children, onPress, theme, divider = true, flush }: {
  children: React.ReactNode; onPress?: () => void; theme: Theme; divider?: boolean; flush?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? ripple(theme) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [{
        minHeight: touch.min,
        paddingHorizontal: flush ? 0 : space[4],
        paddingVertical: space[3],
        justifyContent: 'center',
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: theme.divider,
      }, pressedDim(pressed)]}
    >
      {children}
    </Pressable>
  );
}

// Avatar initials from a party name: "Delhi Trader" -> "DT", "aSAsda" -> "AS"... first two words.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[1]![0]!;
  return letters.toUpperCase();
}

// Kit list row: gap 12, padding 12 vertical, divider #ebeaea. Leading 36 avatar
// (blue with white initials, or `leadingAlt`: grey with black initials) or a
// 36 icon chip; title 14/500 with a 12 caption; trailing value.
// `flush` drops the horizontal padding when the row sits in a list Card.
export function ListItem({
  title, subtitle, leadingIcon, leadingText, leadingAlt, trailing, onPress, chevron, theme, divider = true, selected, flush,
  titleLines = 1,
}: {
  title: string; subtitle?: string; leadingIcon?: IconName; leadingText?: string; leadingAlt?: boolean;
  trailing?: React.ReactNode; onPress?: () => void; chevron?: boolean; theme: Theme;
  divider?: boolean; selected?: boolean; flush?: boolean;
  titleLines?: number; // let a long title wrap in a narrow pane (default: one line, ellipsis)
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? ripple(theme) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected ? { selected } : undefined}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: space[3],
        minHeight: subtitle ? 60 : touch.min,
        paddingHorizontal: flush ? 0 : space[4], paddingVertical: space[3],
        borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.divider,
        backgroundColor: selected ? theme.primaryTint : 'transparent',
      }, pressedDim(pressed)]}
    >
      {leadingIcon ? <IconChip icon={leadingIcon} theme={theme} /> : null}
      {leadingText !== undefined ? (
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: leadingAlt ? theme.border : theme.primaryContainer,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={[type.label, { fontFamily: font.semibold, color: leadingAlt ? theme.text : theme.onPrimaryContainer },
            leadingText.length > 2 ? { fontSize: 11, letterSpacing: -0.2 } : null]} numberOfLines={1}>
            {leadingText}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[type.label, { color: theme.text }]} numberOfLines={titleLines}>{title}</Text>
        {subtitle ? (
          <Text style={[type.caption, { color: theme.textMuted }]} numberOfLines={2}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Feather name="chevron-right" size={20} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

export function EmptyState({ text, theme, icon, title, action }: {
  text: string; theme: Theme; icon?: IconName; title?: string; action?: React.ReactNode;
}) {
  return (
    <View style={{ paddingVertical: space[6], paddingHorizontal: space[5], alignItems: 'center', gap: space[2] }}>
      {icon ? <Feather name={icon} size={36} color={theme.textMuted} /> : null}
      {title ? <Text style={[type.heading, { color: theme.text, textAlign: 'center' }]}>{title}</Text> : null}
      <Text style={[type.bodyMedium, { color: theme.textMuted, textAlign: 'center' }]}>{text}</Text>
      {action ? <View style={{ marginTop: space[2] }}>{action}</View> : null}
    </View>
  );
}

// Filter chip as a kit pill: glass when off; blue fill, white 14/600 and the small shadow when on.
export function Chip({ label, active, onPress, theme, icon }: {
  label: string; active: boolean; onPress: () => void; theme: Theme; icon?: IconName;
}) {
  const color = active ? theme.onFillStrong : theme.textMuted;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      android_ripple={ripple(theme)}
      style={({ pressed }) => [{
        height: 36,
        paddingHorizontal: space[4],
        marginEnd: space[2],
        marginVertical: space[1],
        borderRadius: radius.pill,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: active ? theme.fillStrong : theme.glassStrong,
        borderWidth: active ? 0 : 1,
        // A white border would vanish on the white sheet, so off chips use the input border.
        borderColor: theme.inputBorder,
        boxShadow: active ? shadow.primary : undefined,
      }, pressedDim(pressed)]}
    >
      {icon ? <Feather name={icon} size={16} color={color} /> : null}
      <Text style={[type.label, { color, fontFamily: active ? font.semibold : font.medium }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Kit segmented control (Day / Week / Month): glass pill container, 4px
// padding, small shadow; tabs 36 tall; the active tab is blue with white 14/600.
export function SegmentedControl<T extends string>({ options, value, onChange, theme, style, label }: {
  options: ReadonlyArray<{ value: T; label: string }>; value: T; onChange: (v: T) => void;
  theme: Theme; style?: StyleProp<ViewStyle>; label: string;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[{
        flexDirection: 'row', padding: space[1], borderRadius: radius.pill,
        backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder,
        boxShadow: theme.tileShadow,
      }, style]}
    >
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            hitSlop={{ top: 4, bottom: 4 }}
            style={{
              flex: 1, height: 36, borderRadius: radius.pill, paddingHorizontal: space[2],
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? theme.fillStrong : 'transparent',
              boxShadow: on ? shadow.primary : undefined,
            }}
          >
            <Text style={[type.label, {
              color: on ? theme.onFillStrong : theme.textMuted, fontFamily: on ? font.semibold : font.medium,
            }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Extended FAB on the kit primary-button recipe (52 tall, radius 14, blue,
// white 16/600, large shadow), floating 16 above the bottom nav.
export function FAB({ icon, label, onPress, theme, extended = true }: {
  icon: IconName; label: string; onPress: () => void; theme: Theme; extended?: boolean;
}) {
  const bottom = useNavInset();
  return (
    <View style={{ position: 'absolute', end: layout.side, bottom, borderRadius: radius.control, boxShadow: shadow.secondary, backgroundColor: theme.fab }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={ripple(theme)}
        style={({ pressed }) => [{
          height: touch.button, minWidth: touch.button, borderRadius: radius.control, overflow: 'hidden',
          paddingHorizontal: extended ? space[5] : 0,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
        }, pressScale(pressed), pressedDim(pressed)]}
      >
        <Feather name={icon} size={20} color={theme.onFab} />
        {extended ? <Text style={[type.heading, { color: theme.onFab }]}>{label}</Text> : null}
      </Pressable>
    </View>
  );
}
