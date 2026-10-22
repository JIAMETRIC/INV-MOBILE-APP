import { ExpoConfig, ConfigContext } from 'expo/config';
// Single source for the version: also shown in-app under Settings, so a build on a
// phone can be identified. Bump versionCode on every build you hand out.
import appVersion from './app-version.json';

// INTERNET stays available in dev (Metro needs it, plan §12); it is stripped
// only from preview/production builds via blockedPermissions.
const isReleaseLike = !!process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
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
          blockedPermissions: [
            'android.permission.INTERNET',
            'android.permission.ACCESS_NETWORK_STATE',
          ],
        }
      : {}),
  },
  plugins: [
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
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
});
