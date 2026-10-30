import { ExpoConfig, ConfigContext } from 'expo/config';
// Single source for the version: also shown in-app under Settings, so a build on a
// phone can be identified. Bump versionCode on every build you hand out.
import { withAndroidManifest } from 'expo/config-plugins';
import appVersion from './app-version.json';

// Android 11+: the app may only start WhatsApp if the manifest declares it under <queries>.
const withWhatsAppQueries: (c: ExpoConfig) => ExpoConfig = c => withAndroidManifest(c, cfg => {
  const m = cfg.modResults.manifest as { queries?: { package?: { $: { 'android:name': string } }[] }[] };
  const queries = m.queries?.[0] ?? {};
  queries.package = [
    ...(queries.package ?? []),
    { $: { 'android:name': 'com.whatsapp' } },
    { $: { 'android:name': 'com.whatsapp.w4b' } },
  ];
  m.queries = [queries];
  return cfg;
});

// LAN sync (LAN_SYNC): phones talk to the desktop over plain HTTP on the shop
// network; the bodies are AES-GCM sealed (src/sync/seal.ts), so cleartext
// transport is allowed. Android blocks cleartext by default from API 28.
const withCleartextLan: (c: ExpoConfig) => ExpoConfig = c => withAndroidManifest(c, cfg => {
  const app = cfg.modResults.manifest.application?.[0];
  if (app) app.$['android:usesCleartextTraffic'] = 'true';
  return cfg;
});

// INTERNET is needed for LAN sync with the desktop (owner decision D5,
// 2026-10-30); before that, release builds stripped it. ACCESS_NETWORK_STATE
// is still stripped from preview/production builds.
const isReleaseLike = !!process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'development';

export default ({ config }: ConfigContext): ExpoConfig => withCleartextLan(withWhatsAppQueries({
  ...config,
  name: 'Invoice ERP',
  slug: 'invoice-erp',
  owner: 'jiametrics-team',
  version: appVersion.version,
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'invoiceerp',
  extra: {
    eas: { projectId: '21ed0c0e-a3a6-4bc5-8ac0-f4adfedd5280' },
  },
  android: {
    package: 'com.jiametric.invoiceerp',
    versionCode: appVersion.versionCode,
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    ...(isReleaseLike
      ? {
          blockedPermissions: ['android.permission.ACCESS_NETWORK_STATE'],
        }
      : {}),
  },
  plugins: [
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
    // S7 fingerprint / face unlock (Android: USE_BIOMETRIC comes from the module's manifest).
    ['expo-local-authentication', { faceIDPermission: 'Allow Invoice ERP to use Face ID to unlock the app.' }],
    // Settings → Sync: scan the desktop's pairing QR code. No microphone.
    ['expo-camera', { cameraPermission: 'Allow Invoice ERP to scan the pairing code shown by Invoice ERP Desktop.', recordAudioAndroid: false }],
  ],
  experiments: { typedRoutes: false },
  // expo-sqlite web driver (wa-sqlite worker) needs crossOriginIsolated.
  web: {
    output: 'single',
    bundler: 'metro',
    headers: [
      { value: 'same-origin', key: 'Cross-Origin-Opener-Policy' },
      { value: 'credentialless', key: 'Cross-Origin-Embedder-Policy' },
    ],
  },
}));
