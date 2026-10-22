import { Platform } from 'react-native';

const gray = {
  0: '#FFFFFF', 50: '#F7F7F7', 100: '#EEEEEE', 200: '#DDDDDD',
  300: '#C4C4C4', 400: '#A0A0A0', 500: '#7A7A7A', 600: '#5C5C5C',
  700: '#3D3D3D', 800: '#222222', 900: '#111111', 1000: '#000000',
} as const;

export { gray };

type Tone = { bg: string; fg: string };

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
  // M3 inverse roles (snackbar): dark container on the light theme and vice versa.
  inverseSurface: string; inverseOnSurface: string; inversePrimary: string;
  headerFrom: string; headerTo: string; onHeader: string; onHeaderMuted: string;
  // Printed invoice paper: always white, in both themes.
  paper: string;
  // Dashboard KPI tiles (S1.1).
  kpiSurface: string;
  // Bottom navigation bar and rail, plus the hairline that separates them from content.
  navSurface: string; navBorder: string;
  // Floating action button ("+ New invoice", "Add product").
  fab: string; onFab: string;
  tone: { info: Tone; success: Tone; warning: Tone; neutral: Tone };
  dark: boolean;
};

// Root brand colours. Both themes below are built from these, so a rebrand
// starts here. Source brand: JIAMETRIC blue #2596be, cyan #5bc1da, navy #0c476f.
// The raw blue and cyan fail WCAG AA as text or fills under text, so the
// themes use the AA-tuned variants. Re-check contrast after changing any of
// them (measured ratios: MOBILE_APP_CONVERSION_TRACKING.md, Prompt 21).
export const brand = {
  navy: '#0C476F', // brand navy: light header start, strong borders
  navyDeep: '#0A2236', // dark header start
  blue: '#1F7FA6', // light header end
  primary: '#00668B', // brand blue darkened for AA on white
  primaryDark: '#7FCFF3', // brand cyan lightened for AA on dark surfaces
  primaryDarkSoft: '#9BDCF0', // dark-theme deep accent
  onPrimaryDark: '#003549', // text on primaryDark fills
  container: '#C4E7FF', // light primary container / info badge
  onContainer: '#001E2C', // text on container
  containerDark: '#004C69', // dark primary container / info badge
  action: '#25BDC3', // FAB fill; needs dark text (white is only 2.3:1)
  onAction: '#001E2C', // text and icon on action (7.5:1)
} as const;

export const white = gray[0];

// '#00668B', 0.14 -> 'rgba(0,102,139,0.14)'
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// U2 — the brand mapped onto Material 3 colour roles. Every text/fill pair is
// >= 4.5:1 (WCAG AA).
export const light: Theme = {
  bg: '#F1F5F9', surface: white, surfaceAlt: '#E6EEF4', surfaceContainer: '#E2E8F0',
  border: '#DBE7EE', borderStrong: brand.navy, outline: '#71787E',
  text: '#10232F', textMuted: '#53606A', textDisabled: '#A9B1B6',
  inverse: white, fillStrong: brand.primary, onFillStrong: white,
  focus: brand.primary, overlay: 'rgba(12,30,44,0.45)', ripple: alpha(brand.primary, 0.14),
  accent: brand.primary, accentDeep: brand.navy, accentSoft: '#E3F3F9', accentOn: white,
  primaryContainer: brand.container, onPrimaryContainer: brand.onContainer,
  secondaryContainer: '#D3E5F2', onSecondaryContainer: '#0C1D29',
  error: '#BA1A1A', onError: white, errorContainer: '#FFDAD6', onErrorContainer: '#410002',
  inverseSurface: '#26343E', inverseOnSurface: '#EEF4F8', inversePrimary: brand.primaryDark,
  headerFrom: brand.navy, headerTo: brand.blue, onHeader: white, onHeaderMuted: alpha(white, 0.85),
  paper: white, kpiSurface: white, navSurface: white, navBorder: '#DBE7EE',
  fab: brand.action, onFab: brand.onAction,
  tone: {
    info: { bg: brand.container, fg: brand.onContainer },
    success: { bg: '#D7F5DD', fg: '#0F5223' },
    warning: { bg: '#FFE7C2', fg: '#5C3A00' },
    neutral: { bg: '#E3E8EC', fg: '#41484D' },
  },
  dark: false,
};

export const dark: Theme = {
  bg: '#0C1520', surface: '#101C2B', surfaceAlt: '#1A2A3C', surfaceContainer: '#142233',
  border: '#2A3A4C', borderStrong: brand.primaryDark, outline: '#8B9297',
  text: '#DCE7F0', textMuted: '#A6B6C4', textDisabled: '#5A6C7D',
  inverse: '#0C1520', fillStrong: brand.primaryDark, onFillStrong: brand.onPrimaryDark,
  focus: brand.primaryDark, overlay: 'rgba(0,0,0,0.6)', ripple: alpha(brand.primaryDark, 0.16),
  accent: brand.primaryDark, accentDeep: brand.primaryDarkSoft, accentSoft: '#123A4A', accentOn: '#04121A',
  primaryContainer: brand.containerDark, onPrimaryContainer: brand.container,
  secondaryContainer: '#24425A', onSecondaryContainer: '#D3E5F2',
  error: '#FFB4AB', onError: '#690005', errorContainer: '#93000A', onErrorContainer: '#FFDAD6',
  inverseSurface: '#DCE7F0', inverseOnSurface: '#10232F', inversePrimary: brand.primary,
  headerFrom: brand.navyDeep, headerTo: brand.navy, onHeader: white, onHeaderMuted: alpha(white, 0.85),
  paper: white, kpiSurface: '#142233', navSurface: '#142233', navBorder: 'transparent',
  fab: brand.action, onFab: brand.onAction,
  tone: {
    info: { bg: brand.containerDark, fg: brand.container },
    success: { bg: '#1E4D2B', fg: '#B6F0C1' },
    warning: { bg: '#5A4100', fg: '#FFDDA6' },
    neutral: { bg: '#2C3740', fg: '#C2CCD4' },
  },
  dark: true,
};

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;
// M3 shape scale: extra-small 4 / small 8 / medium 12 / large 16 / extra-large 28.
export const radius = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 28, pill: 999 } as const;
export const border = { hairline: 1, strong: 2 } as const;
export const touch = { min: 48, comfortable: 56 } as const;
export const maxReadWidth = 720;

const mono = Platform.select({ android: 'monospace', default: 'monospace' });

// M3 type scale under the legacy key names: display = headlineMedium,
// title = titleLarge, heading = titleMedium, body = bodyLarge,
// label = labelLarge, caption = bodySmall.
export const type = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '600' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  heading: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.15 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
  number: {
    fontSize: 16, lineHeight: 24, fontWeight: '500' as const,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  code: { fontSize: 14, lineHeight: 20, fontFamily: mono },
} as const;

// Depth comes from tonal surfaces and borders; the FAB is the one elevated element (M3 level 3).
export const elevation = {
  flat: { borderWidth: border.hairline },
  raised: { borderWidth: border.strong },
  fab: { elevation: 6 },
} as const;

// Ionicons names (I1 hairline set). Status = glyph + text + tonal colour, never colour alone.
export const status = {
  draft: { icon: 'ellipse-outline', label: 'Draft', tone: 'neutral' },
  issued: { icon: 'time-outline', label: 'Issued', tone: 'info' },
  partial: { icon: 'contrast-outline', label: 'Partial', tone: 'warning' },
  paid: { icon: 'checkmark-circle', label: 'Paid', tone: 'success' },
  void: { icon: 'close-circle-outline', label: 'Void', tone: 'neutral' },
} as const;
