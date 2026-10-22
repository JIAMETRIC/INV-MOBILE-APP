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
  error: string; errorContainer: string; onErrorContainer: string;
  headerFrom: string; headerTo: string; onHeader: string;
  tone: { info: Tone; success: Tone; warning: Tone; neutral: Tone };
  dark: boolean;
};

// U2 — JIAMETRIC brand (#2596be / #5bc1da / navy #0c476f) mapped onto Material 3
// colour roles. Every text/fill pair is >= 4.5:1 (WCAG AA); measured ratios are
// in MOBILE_APP_CONVERSION_TRACKING.md (Prompt 21).
export const light: Theme = {
  bg: '#F2F7FB', surface: '#FFFFFF', surfaceAlt: '#E6EEF4', surfaceContainer: '#EBF2F7',
  border: '#DBE7EE', borderStrong: '#0C476F', outline: '#71787E',
  text: '#10232F', textMuted: '#53606A', textDisabled: '#A9B1B6',
  inverse: '#FFFFFF', fillStrong: '#00668B', onFillStrong: '#FFFFFF',
  focus: '#00668B', overlay: 'rgba(12,30,44,0.45)', ripple: 'rgba(0,102,139,0.14)',
  accent: '#00668B', accentDeep: '#0C476F', accentSoft: '#E3F3F9', accentOn: '#FFFFFF',
  primaryContainer: '#C4E7FF', onPrimaryContainer: '#001E2C',
  secondaryContainer: '#D3E5F2', onSecondaryContainer: '#0C1D29',
  error: '#BA1A1A', errorContainer: '#FFDAD6', onErrorContainer: '#410002',
  headerFrom: '#0C476F', headerTo: '#1F7FA6', onHeader: '#FFFFFF',
  tone: {
    info: { bg: '#C4E7FF', fg: '#001E2C' },
    success: { bg: '#D7F5DD', fg: '#0F5223' },
    warning: { bg: '#FFE7C2', fg: '#5C3A00' },
    neutral: { bg: '#E3E8EC', fg: '#41484D' },
  },
  dark: false,
};

export const dark: Theme = {
  bg: '#0C1520', surface: '#101C2B', surfaceAlt: '#1A2A3C', surfaceContainer: '#142233',
  border: '#2A3A4C', borderStrong: '#7FCFF3', outline: '#8B9297',
  text: '#DCE7F0', textMuted: '#A6B6C4', textDisabled: '#5A6C7D',
  inverse: '#0C1520', fillStrong: '#7FCFF3', onFillStrong: '#003549',
  focus: '#7FCFF3', overlay: 'rgba(0,0,0,0.6)', ripple: 'rgba(127,207,243,0.16)',
  accent: '#7FCFF3', accentDeep: '#9BDCF0', accentSoft: '#123A4A', accentOn: '#04121A',
  primaryContainer: '#004C69', onPrimaryContainer: '#C4E7FF',
  secondaryContainer: '#24425A', onSecondaryContainer: '#D3E5F2',
  error: '#FFB4AB', errorContainer: '#93000A', onErrorContainer: '#FFDAD6',
  headerFrom: '#0A2236', headerTo: '#0C476F', onHeader: '#FFFFFF',
  tone: {
    info: { bg: '#004C69', fg: '#C4E7FF' },
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
