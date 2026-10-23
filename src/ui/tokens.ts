import { Platform } from 'react-native';

// Print greys for the invoice PDF (src/export/pdfTemplate.ts). Not used on screen.
const gray = {
  0: '#FFFFFF', 50: '#F7F7F7', 100: '#EEEEEE', 200: '#DDDDDD',
  300: '#C4C4C4', 400: '#A0A0A0', 500: '#7A7A7A', 600: '#5C5C5C',
  700: '#3D3D3D', 800: '#222222', 900: '#111111', 1000: '#000000',
} as const;

export { gray };

// Flat Glass · Brand Blue (design/DESIGN.md). The five colour tokens; every
// theme value below is one of these or a see-through variant of one (§2.2).
export const brand = {
  primary: '#2596be', // primaryColor: primary buttons, active/selected, icons, data
  secondary: '#666666', // secondaryColor: secondary text, inactive icons
  tertiary: '#ebeaea', // tertiaryColor: light screen background, dividers, empty tracks
  dark: '#000000', // darkColor: main text (light); dark screen background
  light: '#ffffff', // lightColor: text on blue and on dark; glass fill
  link: '#1a6f8e', // linkColor: text links on light screens (darker blue)
} as const;

export const white = brand.light;

// '#2596be', 0.14 -> 'rgba(37,150,190,0.14)'
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// The two shadows (§2.3), both tinted blue. primary: small items (icon
// buttons, tiles, chips, tabs, info bars). secondary: large items (cards,
// bottom nav, big primary buttons).
export const shadow = {
  primary: '0 4px 8px rgba(20, 71, 108, 0.15)',
  secondary: '0 8px 16px rgba(20, 71, 108, 0.2)',
} as const;

// Real status colours (DESIGN.md §11 allows green/red "only for real status").
const status = {
  green: '#2e7d32', greenDark: '#66bb6a',
  red: '#c62828', redDark: '#ef5350',
  delete: '#FF2C2C', // the Delete action (products editor)
} as const;

type Tone = { bg: string; fg: string; icon: string };

export type Theme = {
  bg: string; surface: string; surfaceAlt: string; surfaceContainer: string;
  border: string; borderStrong: string; outline: string;
  text: string; textMuted: string; textDisabled: string;
  inverse: string; fillStrong: string; onFillStrong: string;
  focus: string; overlay: string; ripple: string;
  accent: string; accentDeep: string; accentSoft: string; accentOn: string;
  primaryContainer: string; onPrimaryContainer: string;
  secondaryContainer: string; onSecondaryContainer: string;
  error: string; onError: string; errorContainer: string; onErrorContainer: string;
  destructive: string; // Button destructive: text and icon of a delete action
  // Snackbar: dark container on the light theme and vice versa.
  inverseSurface: string; inverseOnSurface: string; inversePrimary: string;
  // Printed invoice paper: always white, in both themes.
  paper: string;
  // Glass recipes (§2.4): card, icon button, bottom nav, and their borders.
  glass: string; glassStrong: string; glassNav: string;
  glassBorder: string; glassBorderStrong: string;
  // Card shadows: the dark recipe adds a 1px inner highlight.
  cardShadow: string; tileShadow: string;
  primaryTint: string; primaryFill: string; focusRing: string; link: string;
  inputFill: string; inputBorder: string; divider: string; sheet: string;
  kpiSurface: string; navSurface: string; navBorder: string;
  fab: string; onFab: string;
  tone: { info: Tone; success: Tone; warning: Tone; neutral: Tone };
  dark: boolean;
};

const primaryTint = alpha(brand.primary, 0.14);
const glass = alpha(brand.light, 0.55);
const glassStrong = alpha(brand.light, 0.6);
const glassNav = alpha(brand.light, 0.65);
const glassBorder = alpha(brand.light, 0.85);
const glassBorderStrong = alpha(brand.light, 0.9);
const glassDark = alpha(brand.light, 0.08);
const glassDarkBorder = alpha(brand.light, 0.16);
const dividerDark = alpha(brand.light, 0.18);
const focusRing = `0 0 0 3px ${alpha(brand.primary, 0.35)}`;
const darkInset = `inset 0 1px 0 ${alpha(brand.light, 0.2)}`;

// Light screens: #ebeaea background, white glass, black text (§7.1-7.3).
export const light: Theme = {
  bg: brand.tertiary, surface: glass, surfaceAlt: glassStrong, surfaceContainer: glass,
  border: brand.tertiary, borderStrong: brand.primary, outline: alpha(brand.secondary, 0.35),
  text: brand.dark, textMuted: brand.secondary, textDisabled: brand.secondary,
  inverse: brand.light, fillStrong: brand.primary, onFillStrong: brand.light,
  focus: brand.primary, overlay: alpha(brand.dark, 0.45), ripple: primaryTint,
  accent: brand.primary, accentDeep: brand.dark, accentSoft: primaryTint, accentOn: brand.light,
  primaryContainer: brand.primary, onPrimaryContainer: brand.light,
  secondaryContainer: primaryTint, onSecondaryContainer: brand.dark,
  error: status.red, onError: brand.light, errorContainer: alpha(status.red, 0.14), onErrorContainer: brand.dark,
  destructive: status.delete,
  inverseSurface: brand.dark, inverseOnSurface: brand.light, inversePrimary: brand.primary,
  paper: brand.light,
  glass, glassStrong, glassNav, glassBorder, glassBorderStrong,
  cardShadow: shadow.secondary, tileShadow: shadow.primary,
  primaryTint, primaryFill: alpha(brand.primary, 0.12), focusRing, link: brand.link,
  inputFill: glassStrong, inputBorder: alpha(brand.secondary, 0.35), divider: brand.tertiary, sheet: '#ffffff', // modals and solid panels
  kpiSurface: glass, navSurface: glassNav, navBorder: glassBorderStrong,
  fab: brand.primary, onFab: brand.light,
  tone: {
    info: { bg: primaryTint, fg: brand.dark, icon: brand.primary },
    success: { bg: alpha(status.green, 0.14), fg: brand.dark, icon: status.green },
    warning: { bg: primaryTint, fg: brand.dark, icon: brand.primary },
    neutral: { bg: brand.tertiary, fg: brand.dark, icon: brand.secondary },
  },
  dark: false,
};

// Dark screens: black background, dark glass, white text (§7.4 Sign In).
export const dark: Theme = {
  bg: brand.dark, surface: glassDark, surfaceAlt: glassDark, surfaceContainer: glassDark,
  border: dividerDark, borderStrong: brand.primary, outline: alpha(brand.light, 0.2),
  text: brand.light, textMuted: brand.tertiary, textDisabled: alpha(brand.light, 0.6),
  inverse: brand.dark, fillStrong: brand.primary, onFillStrong: brand.light,
  focus: brand.primary, overlay: alpha(brand.dark, 0.6), ripple: primaryTint,
  accent: brand.primary, accentDeep: brand.light, accentSoft: primaryTint, accentOn: brand.light,
  primaryContainer: brand.primary, onPrimaryContainer: brand.light,
  secondaryContainer: alpha(brand.primary, 0.24), onSecondaryContainer: brand.light,
  error: status.redDark, onError: brand.dark, errorContainer: alpha(status.redDark, 0.2), onErrorContainer: brand.light,
  destructive: status.delete,
  inverseSurface: brand.light, inverseOnSurface: brand.dark, inversePrimary: brand.link,
  paper: brand.light,
  glass: glassDark, glassStrong: glassDark, glassNav: alpha(brand.dark, 0.88),
  glassBorder: glassDarkBorder, glassBorderStrong: glassDarkBorder,
  cardShadow: `${shadow.secondary}, ${darkInset}`, tileShadow: `${shadow.primary}, ${darkInset}`,
  primaryTint: alpha(brand.primary, 0.24), primaryFill: alpha(brand.primary, 0.12), focusRing, link: brand.light,
  inputFill: glassDark, inputBorder: alpha(brand.light, 0.2), divider: dividerDark, sheet: brand.dark,
  kpiSurface: glassDark, navSurface: alpha(brand.dark, 0.88), navBorder: glassDarkBorder,
  fab: brand.primary, onFab: brand.light,
  tone: {
    info: { bg: alpha(brand.primary, 0.24), fg: brand.light, icon: brand.primary },
    success: { bg: alpha(status.greenDark, 0.22), fg: brand.light, icon: status.greenDark },
    warning: { bg: alpha(brand.primary, 0.24), fg: brand.light, icon: brand.primary },
    neutral: { bg: alpha(brand.light, 0.12), fg: brand.light, icon: brand.tertiary },
  },
  dark: true,
};

// 4px base unit (§4). Kit values 20/28/56/88 are in `layout`.
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;
export const layout = {
  side: 20, // screen side padding (Weather, Dashboard)
  sideWide: 24, // Player, Sign In
  gap: 16, // between blocks
  grid: 12, // 2-column grid gap
  top: 8, // below the status bar, before the header row
} as const;
// Radii, tightened from the kit's (§4: 12/14/16/20/24/28/32) by the owner:
// chip 10 · control (buttons, inputs, icon buttons) 12 · item (selected cell,
// active nav item) 14 · bar (info bar, logo) 16 · card 16 · form 18 ·
// frame 16 · pill 999.
export const radius = {
  none: 0, chip: 10, control: 12, item: 14, bar: 16, card: 16, form: 18, frame: 16, pill: 999,
} as const;
export const border = { hairline: 1, strong: 2 } as const;
// Touch sizes (§4): every target >= 44.
export const touch = { min: 44, nav: 48, input: 50, button: 52, comfortable: 56 } as const;
export const maxReadWidth = 720;

const mono = Platform.select({ android: 'monospace', default: 'monospace' });

// Inter 300/400/500/600 (SIL OFL 1.1, @expo-google-fonts/inter) for text, never
// 700+; Bebas Neue (SIL OFL 1.1, @expo-google-fonts/bebas-neue) for displayed
// numbers (owner's exception to the kit). Loaded in shell/App.tsx. Each weight
// is its own family: on Android, fontWeight with a single-weight custom family
// can be synthesised, so styles pick the family, not a weight.
export const font = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  // Condensed display face with one weight; its digits are tabular by default.
  numeric: 'BebasNeue_400Regular',
} as const;

// Kit type scale (§3). Letter-spacing converts the kit's em values to px.
export const type = {
  h1: { fontSize: 28, lineHeight: 34, fontFamily: font.semibold, letterSpacing: -0.56 }, // "Welcome back"
  title: { fontSize: 24, lineHeight: 30, fontFamily: font.semibold, letterSpacing: -0.48 }, // H2 "Alex"
  subtitle: { fontSize: 18, lineHeight: 24, fontFamily: font.medium }, // "Partly cloudy"
  heading: { fontSize: 16, lineHeight: 22, fontFamily: font.semibold }, // Body L 600: location, labels
  bodyLarge: { fontSize: 16, lineHeight: 22, fontFamily: font.regular }, // Body L 400: artist
  body: { fontSize: 15, lineHeight: 21, fontFamily: font.regular }, // Body: inputs, list values
  bodyMedium: { fontSize: 14, lineHeight: 20, fontFamily: font.regular }, // Body S
  label: { fontSize: 14, lineHeight: 20, fontFamily: font.medium }, // Body S 500: list titles
  labelMedium: { fontSize: 13, lineHeight: 18, fontFamily: font.medium }, // Caption 500: field labels
  caption: { fontSize: 12, lineHeight: 16, fontFamily: font.regular }, // list captions
  overline: { // "TODAY", "REVENUE"; render the text upper-case
    fontSize: 12, lineHeight: 16, fontFamily: font.semibold, letterSpacing: 0.72,
    textTransform: 'uppercase' as const,
  },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: font.semibold, letterSpacing: 0.88, textTransform: 'uppercase' as const },
  // Displayed numbers (amounts, quantities, table figures): Bebas Neue.
  number: {
    fontSize: 16, lineHeight: 22, fontFamily: font.numeric, letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  // KPI values and the Create invoice TOTAL bar (kit KPI 26/500, set a touch
  // larger in Bebas so its cap height matches).
  figure: {
    fontSize: 28, lineHeight: 32, fontFamily: font.numeric, letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  // Hero figure (kit Display 40/300, "$48,290").
  hero: {
    fontSize: 44, lineHeight: 48, fontFamily: font.numeric, letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  // Number input fields stay in Inter, so typed values are easy to check.
  numberField: {
    fontSize: 15, lineHeight: 21, fontFamily: font.regular,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  code: { fontSize: 14, lineHeight: 20, fontFamily: mono },
} as const;

// Motion (§8): 150-200ms; press scale.
export const motion = { pressScale: 0.98, pressScaleSmall: 0.96 } as const;

// Feather (line icons, as the kit asks). Status = glyph + text + tint, never colour alone.
export const statusStyle = {
  draft: { icon: 'circle', label: 'Draft', tone: 'neutral' },
  issued: { icon: 'clock', label: 'Issued', tone: 'info' },
  partial: { icon: 'pie-chart', label: 'Partial', tone: 'warning' },
  paid: { icon: 'check-circle', label: 'Paid', tone: 'success' },
  void: { icon: 'x-circle', label: 'Void', tone: 'neutral' },
} as const;
