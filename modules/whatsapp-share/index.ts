// Local Expo module (android/…/WhatsAppShareModule.kt): a direct share intent to one app.
import { requireNativeModule } from 'expo-modules-core';

type WhatsAppShareModule = {
  // The first installed package of the list, or null.
  installedPackage(packages: string[]): string | null;
  // Opens that app's share screen with the file (a content:// Uri).
  share(contentUri: string, mimeType: string, packageName: string): Promise<void>;
};

export default requireNativeModule<WhatsAppShareModule>('WhatsAppShare');
